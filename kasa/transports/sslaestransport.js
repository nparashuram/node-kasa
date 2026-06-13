/**
 * Implementation of the TP-Link SSL AES transport.
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
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
 * Generate SHA256 hash of payload in hex uppercase
 */
function sha256Hash(payload) {
  return createHash('sha256').update(payload).digest('hex').toUpperCase();
}

/**
 * Generate MD5 hash of payload in hex uppercase
 */
function md5Hash(payload) {
  return createHash('md5').update(payload).digest('hex').toUpperCase();
}

/**
 * Transport state enum
 */
const TransportState = {
  HANDSHAKE_REQUIRED: 'handshake_required',
  ESTABLISHED: 'established',
};

/**
 * Implementation of the secure transport protocol.
 *
 * This transport uses HTTPS and further payload encryption.
 */
export class SslAesTransport extends BaseTransport {
  static DEFAULT_PORT = 443;
  static COMMON_HEADERS = {
    'Content-Type': 'application/json',
  };

  /**
     * Create an SslAesTransport instance
     */
  constructor({ config }) {
    super({ config });

    this._username = config.credentials?.username || null;
    this._password = config.credentials?.password || null;

    if (!this._username && !this._credentialsHash) {
      const defaultCreds = getDefaultCredentials(DEFAULT_CREDENTIALS.TAPOCAMERA);
      this._username = defaultCreds.username;
      this._password = defaultCreds.password;
    }

    this._defaultCredentials = getDefaultCredentials(DEFAULT_CREDENTIALS.TAPOCAMERA);
    this._httpClient = new HttpClient(config);

    this._state = TransportState.HANDSHAKE_REQUIRED;
    this._encryptionSession = null;
    this._sessionExpireAt = null;
    this._tokenUrl = null;
    this._headers = { ...SslAesTransport.COMMON_HEADERS };
    this._appUrl = new URL(`https://${this._host}:${this._port}/app`);
    this._sendSecure = true;
    this._seq = 0;
  }

  /**
     * Default port for the transport
     */
  get defaultPort() {
    if (this._config.connectionType.httpPort) {
      return this._config.connectionType.httpPort;
    }
    return SslAesTransport.DEFAULT_PORT;
  }

  /**
     * Handle response error codes
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
     * Generate encryption token
     */
  generateEncryptionToken(name, localNonce, serverNonce, pwdHash) {
    const payload = Buffer.concat([
      Buffer.from(name, 'utf8'),
      Buffer.from(localNonce, 'utf8'),
      Buffer.from(serverNonce, 'utf8'),
      Buffer.from(pwdHash, 'utf8')
    ]);
    return createHash('sha256').update(payload).digest().slice(0, 16);
  }

  /**
     * Generate confirm hash
     */
  generateConfirmHash(localNonce, serverNonce, pwdHash) {
    const payload = Buffer.concat([
      Buffer.from(localNonce, 'utf8'),
      Buffer.from(serverNonce, 'utf8'),
      Buffer.from(pwdHash, 'utf8')
    ]);
    return createHash('sha256').update(payload).digest('hex').toUpperCase();
  }

  /**
     * Generate digest password
     */
  generateDigestPassword(localNonce, serverNonce, pwdHash) {
    const payload = Buffer.concat([
      Buffer.from(localNonce, 'utf8'),
      Buffer.from(serverNonce, 'utf8'),
      Buffer.from(pwdHash, 'utf8')
    ]);
    return createHash('sha256').update(payload).digest('hex').toUpperCase();
  }

  /**
     * Send secure passthrough
     */
  async sendSecurePassthrough(request) {
    this._seq += 1;
    const url = this._tokenUrl || this._appUrl;

    const [encryptedPayload, signature] = this._encryptionSession.encryptWithSignature(
      Buffer.from(request, 'utf8'),
      this._seq
    );

    const body = {
      'method': 'securePassthrough',
      'params': {
        'request': encryptedPayload.toString('base64'),
        'signature': signature.toString('hex').toUpperCase()
      }
    };

    const [statusCode, respDict] = await this._httpClient.post(
      url,
      { json: body, headers: this._headers, ssl: true }
    );

    if (statusCode !== 200) {
      throw new KasaException(`${this._host} responded with unexpected status code ${statusCode}`);
    }

    this._handleResponseErrorCode(respDict, 'Error in securePassthrough');

    const encryptedResponse = Buffer.from(respDict.result.response, 'base64');
    const decryptedResponse = this._encryptionSession.decrypt(encryptedResponse);

    return JSON.parse(decryptedResponse.toString('utf8'));
  }

  /**
     * Perform handshake
     */
  async performHandshake() {
    const handshakeData = await this.performHandshake1();
    if (handshakeData) {
      const [localNonce, serverNonce, pwdHash] = handshakeData;
      await this.performHandshake2(localNonce, serverNonce, pwdHash);
    }
  }

  async performHandshake1() {
    // Simplified handshake1 for node-kasa
    const localNonce = randomBytes(8).toString('hex').toUpperCase();
    const username = this._username;

    const body = {
      'method': 'login',
      'params': {
        'cnonce': localNonce,
        'encrypt_type': '3',
        'username': username
      }
    };

    const [statusCode, respDict] = await this._httpClient.post(
      this._appUrl,
      { json: body, headers: this._headers, ssl: true }
    );

    if (statusCode !== 200) {
      throw new KasaException(`Handshake1 failed with status ${statusCode}`);
    }

    const errorCode = SmartErrorCode.fromInt(respDict.error_code);
    if (errorCode.value === SmartErrorCode.INVALID_NONCE) {
      const serverNonce = respDict.result.data.nonce;
      const deviceConfirm = respDict.result.data.device_confirm;

      // Try SHA256 then MD5
      const pwd = this._password || this._defaultCredentials.password;
      let pwdHash = sha256Hash(Buffer.from(pwd, 'utf8'));
      if (deviceConfirm === this.generateConfirmHash(localNonce, serverNonce, pwdHash)) {
        return [localNonce, serverNonce, pwdHash];
      }

      pwdHash = md5Hash(Buffer.from(pwd, 'utf8'));
      if (deviceConfirm === this.generateConfirmHash(localNonce, serverNonce, pwdHash)) {
        return [localNonce, serverNonce, pwdHash];
      }
    }

    throw new AuthenticationError(`Authentication failed for ${this._host}`);
  }

  async performHandshake2(localNonce, serverNonce, pwdHash) {
    const digestPassword = this.generateDigestPassword(localNonce, serverNonce, pwdHash);
    const body = {
      'method': 'login',
      'params': {
        'cnonce': localNonce,
        'encrypt_type': '3',
        'digest_passwd': digestPassword,
        'username': this._username
      }
    };

    const [statusCode, respDict] = await this._httpClient.post(
      this._appUrl,
      { json: body, headers: this._headers, ssl: true }
    );

    if (statusCode !== 200) {
      throw new KasaException(`Handshake2 failed with status ${statusCode}`);
    }

    this._handleResponseErrorCode(respDict, 'Error in handshake2');

    const stok = respDict.result.stok;
    this._tokenUrl = new URL(`${this._appUrl.toString()}/stok=${stok}/ds`);

    const lsk = this.generateEncryptionToken('lsk', localNonce, serverNonce, pwdHash);
    const ivb = this.generateEncryptionToken('ivb', localNonce, serverNonce, pwdHash);

    const { AesEncryptionSession } = await import('./aestransport.js');
    this._encryptionSession = new AesEncryptionSession(lsk, ivb);

    // Extend encryption session with signature capabilities
    this._encryptionSession.encryptWithSignature = function(data, seq) {
      const encrypted = this.encrypt(data);
      const signaturePayload = Buffer.concat([
        this.key,
        Buffer.alloc(4), // PACK_SIGNED_LONG(seq) - simplified
        encrypted
      ]);
      signaturePayload.writeInt32BE(seq, 16);
      const signature = createHash('sha256').update(signaturePayload).digest();
      return [encrypted, signature];
    };

    this._state = TransportState.ESTABLISHED;
  }

  async send(request) {
    if (this._state === TransportState.HANDSHAKE_REQUIRED) {
      await this.performHandshake();
    }
    return await this.sendSecurePassthrough(request);
  }

  async close() {
    await this.reset();
    await this._httpClient.close();
  }

  async reset() {
    this._state = TransportState.HANDSHAKE_REQUIRED;
    this._encryptionSession = null;
    this._tokenUrl = null;
  }
}
