/**
 * Module for the IOT legacy IOT KASA protocol.
 */

import { BaseProtocol, maskMac, redactData } from './protocol.js';
import { XorTransport, XorEncryption } from '../transports/xortransport.js';
import { DeviceConfig } from '../deviceconfig.js';
import { 
  AuthenticationError, 
  KasaException, 
  TimeoutError, 
  ConnectionError, 
  RetryableError 
} from '../exceptions.js';

const LOGGER = console; // Using console as logger for now

/**
 * Mask children device information
 * @param {Array} children - Array of child devices
 * @returns {Array} Masked children array
 */
function maskChildren(children) {
  const maskChild = (child, index) => {
    const result = {
      ...child,
      id: `SCRUBBED_CHILD_DEVICE_ID_${index + 1}`,
    };
    // Will leave empty aliases as blank
    if (child.alias) {
      result.alias = `#MASKED_NAME# ${index + 1}`;
    }
    return result;
  };

  return children.map((child, index) => maskChild(child, index));
}

/**
 * Data redactors for sensitive information
 */
const REDACTORS = {
  latitude: () => 0,
  longitude: () => 0,
  latitude_i: () => 0,
  longitude_i: () => 0,
  deviceId: (x) => 'REDACTED_' + x.slice(9),
  children: maskChildren,
  alias: (x) => x ? '#MASKED_NAME#' : '',
  mac: maskMac,
  mic_mac: maskMac,
  ssid: (x) => x ? '#MASKED_SSID#' : '',
  oemId: (x) => 'REDACTED_' + x.slice(9),
  username: () => 'user@example.com', // cnCloud
  hwId: (x) => 'REDACTED_' + x.slice(9),
};

/**
 * Class for the legacy TPLink IOT KASA Protocol
 */
export class IotProtocol extends BaseProtocol {
  static BACKOFF_SECONDS_AFTER_TIMEOUT = 1;

  /**
     * Create a protocol object
     * @param {Object} options - Protocol options
     * @param {BaseTransport} options.transport - Transport instance
     */
  constructor({ transport }) {
    super({ transport });
    this._queryLock = false; // Simple lock mechanism for JavaScript
    this._redactData = true;
  }

  /**
     * Query the device retrying for retryCount on failure
     * @param {string|Object} request - Request to send
     * @param {number} [retryCount=3] - Number of retries
     * @returns {Promise<Object>} Response from device
     */
  async query(request, retryCount = 3) {
    if (typeof request === 'object') {
      request = JSON.stringify(request);
    }

    // Simple lock mechanism
    while (this._queryLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this._queryLock = true;

    try {
      return await this._query(request, retryCount);
    } finally {
      this._queryLock = false;
    }
  }

  /**
     * Internal query method with retry logic
     * @private
     * @param {string} request - Request string
     * @param {number} retryCount - Number of retries
     * @returns {Promise<Object>} Response from device
     */
  async _query(request, retryCount = 3) {
    for (let retry = 0; retry <= retryCount; retry++) {
      try {
        return await this._executeQuery(request, retry);
      } catch (error) {
        if (error instanceof ConnectionError) {
          if (retry >= retryCount) {
            throw error;
          }
          continue;
        } else if (error instanceof AuthenticationError) {
          await this._transport.reset();
          throw error;
        } else if (error instanceof RetryableError) {
          await this._transport.reset();
          if (retry >= retryCount) {
            throw error;
          }
          continue;
        } else if (error instanceof TimeoutError) {
          await this._transport.reset();
          if (retry >= retryCount) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, IotProtocol.BACKOFF_SECONDS_AFTER_TIMEOUT * 1000));
          continue;
        } else if (error instanceof KasaException) {
          await this._transport.reset();
          throw error;
        }
      }
    }

    // make this should never be reached
    throw new KasaException('Query reached somehow to unreachable');
  }

  /**
     * Execute a single query
     * @private
     * @param {string} request - Request string
     * @param {number} retryCount - Current retry count
     * @returns {Promise<Object>} Response from device
     */
  async _executeQuery(request, retryCount) {
    const resp = await this._transport.send(request);
    return resp;
  }

  /**
     * Close the underlying transport
     * @returns {Promise<void>}
     */
  async close() {
    await this._transport.close();
  }
}

/**
 * Deprecated TPLinkSmartHomeProtocol class for backward compatibility
 * @deprecated Use IotProtocol with appropriate transport instead
 */
export class _deprecated_TPLinkSmartHomeProtocol extends IotProtocol {
  /**
     * Create a protocol object
     * @param {string|null} [host] - Device host
     * @param {Object} options - Protocol options
     * @param {number} [options.port] - Device port
     * @param {number} [options.timeout] - Connection timeout
     * @param {BaseTransport} [options.transport] - Transport instance
     */
  constructor(host = null, { port, timeout, transport } = {}) {
    if (!host && !transport) {
      throw new KasaException('host or transport must be supplied');
    }
    if (!transport) {
      const config = new DeviceConfig({
        host,
        portOverride: port,
        timeout: timeout || XorTransport.DEFAULT_TIMEOUT,
      });
      transport = new XorTransport({ config });
    }
    super({ transport });
  }

  /**
     * Encrypt a request for a TP-Link Smart Home Device
     * @param {string} request - Plaintext request data
     * @returns {Buffer} Ciphertext to be sent over wire, in bytes
     * @static
     */
  static encrypt(request) {
    return XorEncryption.encrypt(request);
  }

  /**
     * Decrypt a response of a TP-Link Smart Home Device
     * @param {Buffer} ciphertext - Encrypted response data
     * @returns {string} Plaintext response
     * @static
     */
  static decrypt(ciphertext) {
    return XorEncryption.decrypt(ciphertext);
  }
}