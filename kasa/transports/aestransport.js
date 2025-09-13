/**
 * Implementation of the TP-Link AES transport.
 *
 * Based on the work of https://github.com/petretiandrea/plugp100
 * under compatible GNU GPL3 license.
 */

import { createHash, createCipheriv, createDecipheriv, generateKeyPair, privateDecrypt, constants } from 'crypto';
// Note: Using Node.js built-in fetch (available since Node.js 18)
// If fetch is needed, it's available globally
import { URL } from 'url';
import { BaseTransport } from './basetransport.js';
import { DEFAULT_CREDENTIALS, Credentials, getDefaultCredentials } from '../credentials.js';
import { DeviceConfig } from '../deviceconfig.js';
import {
  AuthenticationError,
  DeviceError,
  KasaException,
  SmartErrorCode,
  TimeoutError,
  ConnectionError,
  RetryableError,
} from '../exceptions.js';

// Smart error code sets (would be imported from exceptions.js)
const SMART_RETRYABLE_ERRORS = new Set([
  SmartErrorCode.SESSION_EXPIRED,
  SmartErrorCode.DEVICE_BUSY,
  SmartErrorCode.TRANSPORT_UNKNOWN_CREDENTIALS_ERROR,
]);

const SMART_AUTHENTICATION_ERRORS = new Set([
  SmartErrorCode.LOGIN_ERROR,
  SmartErrorCode.TRANSPORT_UNKNOWN_CREDENTIALS_ERROR,
]);
import { HttpClient } from '../httpclient.js';

const LOGGER = console; // Using console as logger for now

const ONE_DAY_SECONDS = 86400;
const SESSION_EXPIRE_BUFFER_SECONDS = 60 * 20;

/**
 * Generate SHA1 hash of payload
 * @param {Buffer} payload - Payload to hash
 * @returns {string} SHA1 hash in hex
 */
function sha1(payload) {
  return createHash('sha1').update(payload).digest('hex');
}

/**
 * Transport state enum
 */
const TransportState = {
  HANDSHAKE_REQUIRED: 'handshake_required',  // Handshake needed
  LOGIN_REQUIRED: 'login_required',          // Login needed
  ESTABLISHED: 'established',                // Ready to send requests
};

/**
 * Implementation of the AES encryption protocol.
 *
 * AES is the name used in device discovery for TP-Link's TAPO encryption
 * protocol, sometimes used by newer firmware versions on kasa devices.
 */
export class AesTransport extends BaseTransport {
  static DEFAULT_PORT = 80;
  static SESSION_COOKIE_NAME = 'TP_SESSIONID';
  static TIMEOUT_COOKIE_NAME = 'TIMEOUT';
  static COMMON_HEADERS = {
    'Content-Type': 'application/json',
    'requestByApp': 'true',
    'Accept': 'application/json',
  };
  static CONTENT_LENGTH = 'Content-Length';
  static KEY_PAIR_CONTENT_LENGTH = 314;

  /**
     * Create an AesTransport instance
     * @param {Object} options - Transport options
     * @param {DeviceConfig} options.config - Device configuration
     */
  constructor({ config }) {
    super({ config });

    this._loginVersion = config.connectionType.loginVersion;
    if ((!this._credentials || this._credentials.username === null) && 
            !this._credentialsHash) {
      this._credentials = new Credentials();
    }
    if (this._credentials) {
      this._loginParams = this._getLoginParams(this._credentials);
    } else {
      this._loginParams = JSON.parse(
        Buffer.from(this._credentialsHash, 'base64').toString('utf8')
      );
    }
    this._defaultCredentials = null;
    this._httpClient = new HttpClient(config);

    this._state = TransportState.HANDSHAKE_REQUIRED;

    this._encryptionSession = null;
    this._sessionExpireAt = null;

    this._sessionCookie = null;

    this._keyPair = null;
    if (config.aesKeys) {
      const aesKeys = config.aesKeys;
      this._keyPair = KeyPair.createFromDerKeys(
        aesKeys.private, aesKeys.public
      );
    }
    this._appUrl = new URL(`http://${this._host}:${this._port}/app`);
    this._tokenUrl = null;

  }

  /**
     * Default port for the transport
     * @returns {number} Default port
     */
  get defaultPort() {
    if (this._config.connectionType.httpPort) {
      return this._config.connectionType.httpPort;
    }
    return AesTransport.DEFAULT_PORT;
  }

  /**
     * The hashed credentials used by the transport
     * @returns {string|null} Credentials hash
     */
  get credentialsHash() {
    if (this._credentials && this._credentials.equals(new Credentials())) {
      return null;
    }
    return Buffer.from(JSON.stringify(this._loginParams), 'utf8').toString('base64');
  }

  /**
     * Get the login parameters based on the login_version
     * @private
     * @param {Credentials} credentials - Credentials object
     * @returns {Object} Login parameters
     */
  _getLoginParams(credentials) {
    const [un, pw] = AesTransport.hashCredentials(this._loginVersion === 2, credentials);
    const passwordFieldName = this._loginVersion === 2 ? 'password2' : 'password';
    return { [passwordFieldName]: pw, username: un };
  }

  /**
     * Hash the credentials
     * @static
     * @param {boolean} loginV2 - Whether using login version 2
     * @param {Credentials} credentials - Credentials to hash
     * @returns {Array<string>} [username_hash, password_hash]
     */
  static hashCredentials(loginV2, credentials) {
    const un = Buffer.from(sha1(Buffer.from(credentials.username, 'utf8')), 'utf8').toString('base64');
    let pw;
    if (loginV2) {
      pw = Buffer.from(sha1(Buffer.from(credentials.password, 'utf8')), 'utf8').toString('base64');
    } else {
      pw = Buffer.from(credentials.password, 'utf8').toString('base64');
    }
    return [un, pw];
  }

  /**
     * Handle response error codes
     * @private
     * @param {Object} respDict - Response dictionary
     * @param {string} msg - Error message prefix
     */
  _handleResponseErrorCode(respDict, msg) {
    const errorCodeRaw = respDict.error_code;
    let errorCode;
    try {
      errorCode = SmartErrorCode.fromInt(errorCodeRaw);
    } catch (error) {
      errorCode = SmartErrorCode.INTERNAL_UNKNOWN_ERROR;
    }
    if (errorCode === SmartErrorCode.SUCCESS) {
      return;
    }
    const message = `${msg}: ${this._host}: ${errorCode.name}(${errorCode.value})`;
    if (SMART_RETRYABLE_ERRORS.has(errorCode)) {
      throw new RetryableError(message, { errorCode });
    }
    if (SMART_AUTHENTICATION_ERRORS.has(errorCode)) {
      this._state = TransportState.HANDSHAKE_REQUIRED;
      throw new AuthenticationError(message, { errorCode });
    }
    throw new DeviceError(message, { errorCode });
  }

  /**
     * Send encrypted message as passthrough
     * @param {string} request - Request string
     * @returns {Promise<Object>} Response object
     */
  async sendSecurePassthrough(request) {
    const url = this._state === TransportState.ESTABLISHED && this._tokenUrl ? 
      this._tokenUrl : this._appUrl;

    const encryptedPayload = this._encryptionSession.encrypt(Buffer.from(request, 'utf8'));
    const passthroughRequest = {
      method: 'securePassthrough',
      params: { request: encryptedPayload.toString('utf8') },
    };

    const [statusCode, respDict] = await this._httpClient.post(
      url,
      { json: passthroughRequest, headers: AesTransport.COMMON_HEADERS, cookiesDict: this._sessionCookie }
    );

    if (statusCode !== 200) {
      throw new KasaException(
        `${this._host} responded with an unexpected status code ${statusCode} to passthrough`
      );
    }

    this._handleResponseErrorCode(
      respDict, 'Error sending secure_passthrough message'
    );

    const rawResponse = respDict.result.response;

    try {
      const response = this._encryptionSession.decrypt(Buffer.from(rawResponse, 'utf8'));
      return JSON.parse(response);
    } catch (ex) {
      try {
        const retVal = JSON.parse(rawResponse);
        return retVal;
      } catch {
        throw new KasaException(
          `Unable to decrypt response from ${this._host}, error: ${ex.message}, response: ${rawResponse}`
        );
      }
    }
  }

  /**
     * Login to the device
     * @returns {Promise<void>}
     */
  async performLogin() {
    try {
      await this.tryLogin(this._loginParams);
    } catch (aex) {
      if (!(aex instanceof AuthenticationError)) {
        throw aex;
      }
      try {
        if (aex.errorCode !== SmartErrorCode.LOGIN_ERROR) {
          throw aex;
        }
        if (this._defaultCredentials === null) {
          this._defaultCredentials = getDefaultCredentials(DEFAULT_CREDENTIALS.TAPO);
        }
        await this.performHandshake();
        await this.tryLogin(this._getLoginParams(this._defaultCredentials));
      } catch (ex) {
        if (ex instanceof AuthenticationError || 
                    ex instanceof ConnectionError || 
                    ex instanceof TimeoutError) {
          throw ex;
        }
        throw new KasaException(
          `Unable to login and trying default login raised another exception: ${ex.message}`
        );
      }
    }
  }

  /**
     * Try to login with supplied login_params
     * @param {Object} loginParams - Login parameters
     * @returns {Promise<void>}
     */
  async tryLogin(loginParams) {
    const loginRequest = {
      method: 'login_device',
      params: loginParams,
      request_time_milis: Math.round(Date.now()),
    };
    const request = JSON.stringify(loginRequest);

    const respDict = await this.sendSecurePassthrough(request);
    this._handleResponseErrorCode(respDict, 'Error logging in');
    const loginToken = respDict.result.token;
    this._tokenUrl = new URL(this._appUrl);
    this._tokenUrl.searchParams.set('token', loginToken);
    this._state = TransportState.ESTABLISHED;
  }

  /**
     * Generate the request body and return an async generator
     * @private
     * @returns {AsyncGenerator<Buffer>}
     */
  async* _generateKeyPairPayload() {
    if (!this._keyPair) {
      const kp = KeyPair.createKeyPair();
      this._config.aesKeys = {
        private: kp.privateKeyDerB64,
        public: kp.publicKeyDerB64,
      };
      this._keyPair = kp;
    }

    const pubKey = 
            '-----BEGIN PUBLIC KEY-----\n' +
            this._keyPair.publicKeyDerB64 +
            '\n-----END PUBLIC KEY-----\n';
    const handshakeParams = { key: pubKey };
    const requestBody = { method: 'handshake', params: handshakeParams };
    yield Buffer.from(JSON.stringify(requestBody), 'utf8');
  }

  /**
     * Perform the handshake
     * @returns {Promise<void>}
     */
  async performHandshake() {
    this._tokenUrl = null;
    this._sessionExpireAt = null;
    this._sessionCookie = null;

    // Device needs the content length or it will response with 500
    const headers = {
      ...AesTransport.COMMON_HEADERS,
      [AesTransport.CONTENT_LENGTH]: String(AesTransport.KEY_PAIR_CONTENT_LENGTH),
    };

    const [statusCode, respDict] = await this._httpClient.post(
      this._appUrl,
      { 
        json: this._generateKeyPairPayload(), 
        headers, 
        cookiesDict: this._sessionCookie 
      }
    );


    if (statusCode !== 200) {
      throw new KasaException(
        `${this._host} responded with an unexpected status code ${statusCode} to handshake`
      );
    }

    this._handleResponseErrorCode(respDict, 'Unable to complete handshake');

    const handshakeKey = respDict.result.key;

    let cookie = this._httpClient.getCookie(AesTransport.SESSION_COOKIE_NAME);
    if (!cookie) {
      cookie = this._httpClient.getCookie('SESSIONID');
    }
    if (cookie) {
      this._sessionCookie = { [AesTransport.SESSION_COOKIE_NAME]: cookie };
    }

    const timeout = parseInt(
      this._httpClient.getCookie(AesTransport.TIMEOUT_COOKIE_NAME) || String(ONE_DAY_SECONDS)
    );
    // There is a 24 hour timeout on the session cookie
    // but the clock on the device is not always accurate
    // so we set the expiry to 24 hours from now minus a buffer
    this._sessionExpireAt = Date.now() + (timeout * 1000) - (SESSION_EXPIRE_BUFFER_SECONDS * 1000);
        
    this._encryptionSession = AesEncryptionSession.createFromKeypair(handshakeKey, this._keyPair);

    this._state = TransportState.LOGIN_REQUIRED;
  }

  /**
     * Return true if session has expired
     * @private
     * @returns {boolean} Whether session has expired
     */
  _handshakeSessionExpired() {
    return this._sessionExpireAt === null || this._sessionExpireAt - Date.now() <= 0;
  }

  /**
     * Send the request
     * @param {string} request - Request string
     * @returns {Promise<Object>} Response object
     */
  async send(request) {
    if (this._state === TransportState.HANDSHAKE_REQUIRED || this._handshakeSessionExpired()) {
      await this.performHandshake();
    }
    if (this._state !== TransportState.ESTABLISHED) {
      try {
        await this.performLogin();
      } catch (ex) {
        // After a login failure handshake needs to
        // be redone or a 9999 error is received.
        if (ex instanceof AuthenticationError) {
          this._state = TransportState.HANDSHAKE_REQUIRED;
        }
        throw ex;
      }
    }

    return await this.sendSecurePassthrough(request);
  }

  /**
     * Close the http client and reset internal state
     * @returns {Promise<void>}
     */
  async close() {
    await this.reset();
    await this._httpClient.close();
  }

  /**
     * Reset internal handshake and login state
     * @returns {Promise<void>}
     */
  async reset() {
    this._state = TransportState.HANDSHAKE_REQUIRED;
  }
}

/**
 * Class for an AES encryption session
 */
export class AesEncryptionSession {
  /**
     * Create the encryption session from keypair
     * @static
     * @param {string} handshakeKey - Handshake key from device
     * @param {KeyPair} keypair - Key pair object
     * @returns {AesEncryptionSession} Encryption session
     */
  static createFromKeypair(handshakeKey, keypair) {
    const handshakeKeyBytes = Buffer.from(handshakeKey, 'base64');
    const keyAndIv = keypair.decryptHandshakeKey(handshakeKeyBytes);
    if (!keyAndIv) {
      throw new Error('Decryption failed!');
    }
    return new AesEncryptionSession(keyAndIv.slice(0, 16), keyAndIv.slice(16));
  }

  /**
     * Create an AES encryption session
     * @param {Buffer} key - AES key
     * @param {Buffer} iv - Initialization vector
     */
  constructor(key, iv) {
    this.key = key;
    this.iv = iv;
  }

  /**
     * Encrypt the message
     * @param {Buffer} data - Data to encrypt
     * @returns {Buffer} Encrypted data (base64 encoded)
     */
  encrypt(data) {
    const cipher = createCipheriv('aes-128-cbc', this.key, this.iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return Buffer.from(encrypted.toString('base64'), 'utf8');
  }

  /**
     * Decrypt the message
     * @param {Buffer} data - Data to decrypt (base64 encoded)
     * @returns {string} Decrypted string
     */
  decrypt(data) {
    const decipher = createDecipheriv('aes-128-cbc', this.key, this.iv);
    const encryptedData = Buffer.from(data.toString('utf8'), 'base64');
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }
}

/**
 * Class for generating key pairs
 */
export class KeyPair {
  /**
     * Create a key pair
     * @static
     * @param {number} [keySize=1024] - Key size in bits
     * @returns {KeyPair} Key pair object
     */
  static createKeyPair(keySize = 1024) {
    const { publicKey, privateKey } = generateKeyPair('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    });
    return new KeyPair(privateKey, publicKey);
  }

  /**
     * Create a key pair from DER keys
     * @static
     * @param {string} privateKeyDerB64 - Base64 encoded private key DER
     * @param {string} publicKeyDerB64 - Base64 encoded public key DER
     * @returns {KeyPair} Key pair object
     */
  static createFromDerKeys(privateKeyDerB64, publicKeyDerB64) {
    const privateKeyBytes = Buffer.from(privateKeyDerB64, 'base64');
    const publicKeyBytes = Buffer.from(publicKeyDerB64, 'base64');
    return new KeyPair(privateKeyBytes, publicKeyBytes);
  }

  /**
     * Create a KeyPair instance
     * @param {Buffer} privateKey - Private key DER bytes
     * @param {Buffer} publicKey - Public key DER bytes
     */
  constructor(privateKey, publicKey) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.privateKeyDerB64 = privateKey.toString('base64');
    this.publicKeyDerB64 = publicKey.toString('base64');
  }

  /**
     * Get public key in PEM encoding
     * @returns {Buffer} Public key in PEM format
     */
  getPublicPem() {
    return Buffer.concat([
      Buffer.from('-----BEGIN PUBLIC KEY-----\n', 'utf8'),
      Buffer.from(this.publicKeyDerB64, 'utf8'),
      Buffer.from('\n-----END PUBLIC KEY-----\n', 'utf8')
    ]);
  }

  /**
     * Decrypt an AES handshake key
     * @param {Buffer} encryptedKey - Encrypted key
     * @returns {Buffer} Decrypted key
     */
  decryptHandshakeKey(encryptedKey) {
    return privateDecrypt({
      key: this.privateKey,
      padding: constants.RSA_PKCS1_PADDING
    }, encryptedKey);
  }

  /**
     * Decrypt an AES discovery key
     * @param {Buffer} encryptedKey - Encrypted key
     * @returns {Buffer} Decrypted key
     */
  decryptDiscoveryKey(encryptedKey) {
    return privateDecrypt({
      key: this.privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha1'
    }, encryptedKey);
  }
}