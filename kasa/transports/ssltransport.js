/**
 * Implementation of the clear-text passthrough ssl transport.
 *
 * This transport does not encrypt the passthrough payloads at all, but requires a login.
 * This has been seen on some devices (like robovacs).
 */

import { createHash } from 'crypto';
import { URL } from 'url';
import { BaseTransport } from './basetransport.js';
import { DEFAULT_CREDENTIALS, Credentials, getDefaultCredentials } from '../credentials.js';
import {
  AuthenticationError,
  DeviceError,
  KasaException,
  SmartErrorCode,
  RetryableError,
  SMART_AUTHENTICATION_ERRORS,
  SMART_RETRYABLE_ERRORS
} from '../exceptions.js';
import { HttpClient } from '../httpclient.js';

const LOGGER = console; // Using console as logger for now

const ONE_DAY_SECONDS = 86400;
const SESSION_EXPIRE_BUFFER_SECONDS = 60 * 20;

/**
 * Generate MD5 hash of payload in hex uppercase
 * @param {Buffer} payload - Payload to hash
 * @returns {string} MD5 hash
 */
function md5Hash(payload) {
  return createHash('md5').update(payload).digest('hex').toUpperCase();
}

/**
 * Transport state enum
 */
const TransportState = {
  LOGIN_REQUIRED: 'login_required',
  ESTABLISHED: 'established',
};

/**
 * Implementation of the cleartext transport protocol.
 *
 * This transport uses HTTPS without any further payload encryption.
 */
export class SslTransport extends BaseTransport {
  static DEFAULT_PORT = 4433;
  static COMMON_HEADERS = {
    'Content-Type': 'application/json',
  };
  static BACKOFF_SECONDS_AFTER_LOGIN_ERROR = 1;

  /**
     * Create an SslTransport instance
     * @param {Object} options - Transport options
     * @param {DeviceConfig} options.config - Device configuration
     */
  constructor({ config }) {
    super({ config });

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

    this._state = TransportState.LOGIN_REQUIRED;
    this._sessionExpireAt = null;

    this._appUrl = new URL(`https://${this._host}:${this._port}/app`);

    LOGGER.debug(`Created ssltransport for ${this._host}`);
  }

  /**
     * Default port for the transport
     * @returns {number} Default port
     */
  get defaultPort() {
    if (this._config.connectionType.httpPort) {
      return this._config.connectionType.httpPort;
    }
    return SslTransport.DEFAULT_PORT;
  }

  /**
     * The hashed credentials used by the transport
     * @returns {string} Credentials hash
     */
  get credentialsHash() {
    return Buffer.from(JSON.stringify(this._loginParams), 'utf8').toString('base64');
  }

  /**
     * Get the login parameters
     * @private
     * @param {Credentials} credentials - Credentials object
     * @returns {Object} Login parameters
     */
  _getLoginParams(credentials) {
    const [un, pw] = this.hashCredentials(credentials);
    return { 'password': pw, 'username': un };
  }

  /**
     * Hash the credentials
     * @param {Credentials} credentials - Credentials to hash
     * @returns {Array<string>} [username, password_hash]
     */
  hashCredentials(credentials) {
    const un = credentials.username;
    const pw = md5Hash(Buffer.from(credentials.password, 'utf8'));
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

    if (errorCode.value === SmartErrorCode.SUCCESS) {
      return;
    }

    const message = `${msg}: ${this._host}: ${errorCode.name}(${errorCode.value})`;

    if (SMART_RETRYABLE_ERRORS.some(e => e.value === errorCode.value)) {
      throw new RetryableError(message, { errorCode });
    }

    if (SMART_AUTHENTICATION_ERRORS.some(e => e.value === errorCode.value)) {
      this.reset();
      throw new AuthenticationError(message, { errorCode });
    }

    throw new DeviceError(message, { errorCode });
  }

  /**
     * Send request
     * @param {string|Object} request - Request to send
     * @returns {Promise<Object>} Response object
     */
  async sendRequest(request) {
    const url = this._appUrl;

    LOGGER.debug(`Sending ${JSON.stringify(request)} to ${url}`);

    const [statusCode, respDict] = await this._httpClient.post(
      url,
      {
        json: typeof request === 'string' ? JSON.parse(request) : request,
        headers: SslTransport.COMMON_HEADERS,
        ssl: true
      }
    );

    if (statusCode !== 200) {
      throw new KasaException(
        `${this._host} responded with an unexpected status code ${statusCode}`
      );
    }

    LOGGER.debug(`Response with ${statusCode}: ${JSON.stringify(respDict)}`);

    this._handleResponseErrorCode(respDict, 'Error sending request');

    return respDict;
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
        if (aex.errorCode.value !== SmartErrorCode.LOGIN_ERROR) {
          throw aex;
        }

        LOGGER.debug('Login failed, going to try default credentials');
        if (this._defaultCredentials === null) {
          this._defaultCredentials = getDefaultCredentials(DEFAULT_CREDENTIALS.TAPO);
          await new Promise(resolve => setTimeout(resolve, SslTransport.BACKOFF_SECONDS_AFTER_LOGIN_ERROR * 1000));
        }

        await this.tryLogin(this._getLoginParams(this._defaultCredentials));
        LOGGER.debug(`${this._host}: logged in with default credentials`);
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
      'method': 'login',
      'params': loginParams,
    };

    LOGGER.debug('Going to send login request');

    const respDict = await this.sendRequest(loginRequest);
    this._handleResponseErrorCode(respDict, 'Error logging in');

    const loginToken = respDict.result.token;
    this._appUrl.searchParams.set('token', loginToken);
    this._state = TransportState.ESTABLISHED;
    this._sessionExpireAt = Date.now() + (ONE_DAY_SECONDS * 1000) - (SESSION_EXPIRE_BUFFER_SECONDS * 1000);
  }

  /**
     * Return true if session has expired
     * @private
     * @returns {boolean} Whether session has expired
     */
  _sessionExpired() {
    return this._sessionExpireAt === null || this._sessionExpireAt - Date.now() <= 0;
  }

  /**
     * Send the request
     * @param {string} request - Request string
     * @returns {Promise<Object>} Response object
     */
  async send(request) {
    LOGGER.debug(`Going to send ${request}`);
    if (this._state !== TransportState.ESTABLISHED || this._sessionExpired()) {
      LOGGER.debug('Transport not established or session expired, logging in');
      await this.performLogin();
    }

    return await this.sendRequest(request);
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
     * Reset internal login state
     * @returns {Promise<void>}
     */
  async reset() {
    this._state = TransportState.LOGIN_REQUIRED;
    this._appUrl = new URL(`https://${this._host}:${this._port}/app`);
  }
}
