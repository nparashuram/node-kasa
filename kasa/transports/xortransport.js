/**
 * Implementation of the legacy TP-Link Smart Home Protocol.
 *
 * Encryption/Decryption methods based on the works of
 * Lubomir Stroetmann and Tobias Esser
 *
 * https://www.softscheck.com/en/reverse-engineering-tp-link-hs110/
 * https://github.com/softScheck/tplink-smartplug/
 *
 * which are licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

import { createConnection } from 'net';
// Network error constants - these are errno values
const ECONNREFUSED = 'ECONNREFUSED';
const EHOSTDOWN = 'EHOSTDOWN';
const EHOSTUNREACH = 'EHOSTUNREACH';

import { BaseTransport } from './basetransport.js';
import { DeviceConfig } from '../deviceconfig.js';
import { HttpClient } from '../httpclient.js';
import { KasaException, TimeoutError, RetryableError } from '../exceptions.js';

const LOGGER = console; // Using console as logger for now
const NO_RETRY_ERRORS = new Set([EHOSTDOWN, EHOSTUNREACH, ECONNREFUSED]);

/**
 * XorTransport class for legacy TP-Link devices
 */
export class XorTransport extends BaseTransport {
  static DEFAULT_PORT = 9999;
  static DEFAULT_TIMEOUT = 5;
  static BLOCK_SIZE = 4;

  /**
     * Create an XorTransport instance
     * @param {Object} options - Transport options
     * @param {DeviceConfig} options.config - Device configuration
     */
  constructor({ config }) {
    super({ config });
    this.socket = null;
    this.queryLock = false; // Simple lock mechanism
    this._httpClient = null; // For HTTP-based communication (port 80 devices)
  }

  /**
     * Default port for the transport
     * @returns {number} Default port
     */
  get defaultPort() {
    // Check for httpPort in connection type first (for port 80 devices)
    if (this._config && this._config.connectionType && this._config.connectionType.httpPort) {
      return this._config.connectionType.httpPort;
    }
    return XorTransport.DEFAULT_PORT;
  }

  /**
     * The hashed credentials used by the transport
     * @returns {null} XOR transport doesn't use credentials
     */
  get credentialsHash() {
    return null;
  }

  /**
     * Check if this transport should use HTTP instead of raw TCP
     * @returns {boolean} True if HTTP should be used
     * @private
     */
  _shouldUseHttp() {
    // Use HTTP for port 80 devices (like HS200 with newer firmware)
    return this._port === 80;
  }

  /**
     * Try to connect or reconnect to the device
     * @private
     * @param {number} timeout - Connection timeout
     * @returns {Promise<void>}
     */
  async _connect(timeout) {
    if (this.socket && !this.socket.destroyed) {
      return;
    }
    this.socket = null;

    return new Promise((resolve, reject) => {
      const socket = createConnection(this._port, this._host);
      let timeoutId;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        socket.removeAllListeners();
      };

      timeoutId = setTimeout(() => {
        cleanup();
        socket.destroy();
        reject(new Error('Connection timeout'));
      }, timeout * 1000);

      socket.once('connect', () => {
        cleanup();
        // Ensure our packets get sent without delay as we do all
        // our writes in a single go and we do not want any buffering
        // which would needlessly delay the request or risk overloading
        // the buffer on the device
        socket.setNoDelay(true);
        this.socket = socket;
        resolve();
      });

      socket.once('error', (error) => {
        cleanup();
        reject(error);
      });
    });
  }

  /**
     * Execute a query on the device and wait for the response
     * @private
     * @param {string} request - Request string
     * @returns {Promise<Object>} Response object
     */
  async _executeSend(request) {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      const encryptedRequest = XorEncryption.encrypt(request);
      let responseBuffer = Buffer.alloc(0);
      let expectedLength = null;

      const onData = (data) => {
        responseBuffer = Buffer.concat([responseBuffer, data]);

        // First, read the length header (4 bytes)
        if (expectedLength === null && responseBuffer.length >= XorTransport.BLOCK_SIZE) {
          expectedLength = responseBuffer.readUInt32BE(0);
        }

        // Then read the full response
        if (expectedLength !== null && 
                    responseBuffer.length >= XorTransport.BLOCK_SIZE + expectedLength) {
                    
          this.socket.removeListener('data', onData);
          this.socket.removeListener('error', onError);

          const responseData = responseBuffer.slice(
            XorTransport.BLOCK_SIZE, 
            XorTransport.BLOCK_SIZE + expectedLength
          );
                    
          try {
            const decryptedResponse = XorEncryption.decrypt(responseData);
            const jsonPayload = JSON.parse(decryptedResponse);
            resolve(jsonPayload);
          } catch (error) {
            reject(new KasaException(`Failed to parse response: ${error.message}`));
          }
        }
      };

      const onError = (error) => {
        this.socket.removeListener('data', onData);
        this.socket.removeListener('error', onError);
        reject(error);
      };

      this.socket.on('data', onData);
      this.socket.once('error', onError);
            
      this.socket.write(encryptedRequest);
    });
  }

  /**
     * Close the connection
     * @returns {Promise<void>}
     */
  async close() {
    if (this.socket && !this.socket.destroyed) {
      return new Promise((resolve) => {
        this.socket.once('close', resolve);
        this.socket.destroy();
        this.socket = null;
      });
    }
  }

  /**
     * Close the connection without waiting for the connection to close
     */
  closeWithoutWait() {
    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  /**
     * Reset the transport
     * The transport cannot be reset so we must close instead
     * @returns {Promise<void>}
     */
  async reset() {
    await this.close();
  }

  /**
     * Send a message via HTTP (for port 80 devices)
     * @param {string} request - Request string
     * @returns {Promise<Object>} Response object
     * @private
     */
  async _sendHttp(request) {
    if (!this._httpClient) {
      this._httpClient = new HttpClient(this._config);
    }

    try {

      // For HTTP on port 80, send plain JSON (not XOR encrypted)
      const [statusCode, responseData] = await this._httpClient.post(
        `http://${this._host}:${this._port}/`,
        {
          json: JSON.parse(request),
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (statusCode !== 200) {
        throw new KasaException(`HTTP request failed with status ${statusCode}`);
      }


      if (!responseData) {
        throw new KasaException('No HTTP response data received');
      }

      // Handle different response types from HttpClient
      let responseString;
      if (typeof responseData === 'string') {
        responseString = responseData;
      } else if (Buffer.isBuffer(responseData)) {
        responseString = responseData.toString();
      } else if (typeof responseData === 'object') {
        // HttpClient might have already parsed JSON
        return responseData;
      } else {
        throw new KasaException(`Unexpected HTTP response data type: ${typeof responseData}`);
      }

      return JSON.parse(responseString);
    } catch (error) {
      throw new RetryableError(
        `Unable to query the device via HTTP ${this._host}:${this._port}: ${error.message}`
      );
    }
  }

  /**
     * Send a message to the device and return a response
     * @param {string} request - Request string
     * @returns {Promise<Object>} Response object
     */
  async send(request) {
    // Use HTTP for port 80 devices, TCP for others
    if (this._shouldUseHttp()) {
      return await this._sendHttp(request);
    }

    // Original TCP-based implementation
    try {
      await this._connect(this._timeout);
    } catch (error) {
      await this.reset();

      if (error.message === 'Connection timeout') {
        throw new TimeoutError(
          `Timeout after ${this._timeout} seconds connecting to the device: ${this._host}:${this._port}: ${error.message}`
        );
      } else if (error.code === 'ECONNREFUSED') {
        throw new KasaException(
          `Unable to connect to the device: ${this._host}:${this._port}: ${error.message}`
        );
      } else if (NO_RETRY_ERRORS.has(error.errno)) {
        throw new KasaException(
          `Unable to connect to the device: ${this._host}:${this._port}: ${error.message}`
        );
      } else {
        throw new RetryableError(
          `Unable to connect to the device: ${this._host}:${this._port}: ${error.message}`
        );
      }
    }

    try {
      if (!this.socket || this.socket.destroyed) {
        throw new Error('Socket not connected after connection attempt');
      }

      return await Promise.race([
        this._executeSend(request),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Send timeout')), this._timeout * 1000);
        })
      ]);
    } catch (error) {
      await this.reset();

      if (error.message === 'Send timeout') {
        throw new TimeoutError(
          `Timeout after ${this._timeout} seconds sending request to the device ${this._host}:${this._port}: ${error.message}`
        );
      } else {
        throw new RetryableError(
          `Unable to query the device ${this._host}:${this._port}: ${error.message}`
        );
      }
    }
  }
}

/**
 * XorEncryption class for handling XOR encryption/decryption
 */
export class XorEncryption {
  static INITIALIZATION_VECTOR = 171;

  /**
     * XOR payload generator
     * @private
     * @param {Buffer} unencrypted - Unencrypted data
     * @returns {Generator<number>} XOR key generator
     */
  static* _xorPayload(unencrypted) {
    let key = XorEncryption.INITIALIZATION_VECTOR;
    for (const unencryptedByte of unencrypted) {
      key = key ^ unencryptedByte;
      yield key;
    }
  }

  /**
     * Encrypt a request for a TP-Link Smart Home Device
     * @param {string} request - Plaintext request data
     * @returns {Buffer} Ciphertext to be sent over wire, in bytes
     * @static
     */
  static encrypt(request) {
    const plainBytes = Buffer.from(request, 'utf8');
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(plainBytes.length, 0);
        
    const encryptedBytes = Buffer.from(Array.from(XorEncryption._xorPayload(plainBytes)));
        
    return Buffer.concat([lengthBuffer, encryptedBytes]);
  }

  /**
     * XOR encrypted payload generator
     * @private
     * @param {Buffer} ciphertext - Encrypted data
     * @returns {Generator<number>} Decrypted bytes generator
     */
  static* _xorEncryptedPayload(ciphertext) {
    let key = XorEncryption.INITIALIZATION_VECTOR;
    for (const cipherByte of ciphertext) {
      const plainByte = key ^ cipherByte;
      key = cipherByte;
      yield plainByte;
    }
  }

  /**
     * Decrypt a response of a TP-Link Smart Home Device
     * @param {Buffer} ciphertext - Encrypted response data
     * @returns {string} Plaintext response
     * @static
     */
  static decrypt(ciphertext) {
    const decryptedBytes = Buffer.from(Array.from(XorEncryption._xorEncryptedPayload(ciphertext)));
    return decryptedBytes.toString('utf8');
  }
}