/**
 * Implementation of the TP-Link Klap Home Protocol.
 *
 * Encryption/Decryption methods based on the works of
 * Simon Wilkinson and Chris Weeldon
 *
 * Klap devices that have never been connected to the kasa
 * cloud should work with blank credentials.
 * Devices that have been connected to the kasa cloud will
 * switch intermittently between the users cloud credentials
 * and default kasa credentials that are hardcoded.
 * This appears to be an issue with the devices.
 *
 * The protocol works by doing a two stage handshake to obtain
 * and encryption key and session id cookie.
 *
 * Authentication uses an auth_hash which is
 * md5(md5(username),md5(password))
 *
 * handshake1: client sends a random 16 byte local_seed to the
 * device and receives a random 16 bytes remote_seed, followed
 * by sha256(local_seed + auth_hash).  It also returns a
 * TP_SESSIONID in the cookie header.  This implementation
 * then checks this value against the possible auth_hashes
 * described above (user cloud, kasa hardcoded, blank).  If it
 * finds a match it moves onto handshake2
 *
 * handshake2: client sends sha25(remote_seed + auth_hash) to
 * the device along with the TP_SESSIONID.  Device responds with
 * 200 if successful.  It generally will be because this
 * implementation checks the auth_hash it received during handshake1
 *
 * encryption: local_seed, remote_seed and auth_hash are now used
 * for encryption.  The last 4 bytes of the initialization vector
 * are used as a sequence number that increments every time the
 * client calls encrypt and this sequence number is sent as a
 * url parameter to the device along with the encrypted payload
 *
 * https://gist.github.com/chriswheeldon/3b17d974db3817613c69191c0480fe55
 * https://github.com/python-kasa/python-kasa/pull/117
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { URL } from 'url';
import https from 'https';
import { BaseTransport } from './basetransport.js';
import { DEFAULT_CREDENTIALS, Credentials, getDefaultCredentials } from '../credentials.js';
import { DeviceConfig } from '../deviceconfig.js';
import { AuthenticationError, KasaException, RetryableError } from '../exceptions.js';
import { md5 } from '../protocols/protocol.js';

import { HttpClient } from '../httpclient.js';

const LOGGER = console; // Using console as logger for now

const ONE_DAY_SECONDS = 86400;
const SESSION_EXPIRE_BUFFER_SECONDS = 60 * 20;

// Struct for signed long (big-endian)
const packSignedLong = (num) => {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeInt32BE(num, 0);
  return buffer;
};

/**
 * Generate SHA256 hash of payload
 * @param {Buffer} payload - Payload to hash
 * @returns {Buffer} SHA256 hash
 */
function sha256(payload) {
  return createHash('sha256').update(payload).digest();
}

/**
 * Generate SHA1 hash of payload
 * @param {Buffer} payload - Payload to hash
 * @returns {Buffer} SHA1 hash
 */
function sha1(payload) {
  return createHash('sha1').update(payload).digest();
}

/**
 * Implementation of the KLAP encryption protocol.
 *
 * KLAP is the name used in device discovery for TP-Link's new encryption
 * protocol, used by newer firmware versions.
 */
export class KlapTransport extends BaseTransport {
  static DEFAULT_PORT = 80;
  static DEFAULT_HTTPS_PORT = 4433;

  static SESSION_COOKIE_NAME = 'TP_SESSIONID';
  static TIMEOUT_COOKIE_NAME = 'TIMEOUT';
  // Copy & paste from sslaestransport
  static CIPHERS = [
    'AES256-GCM-SHA384',
    'AES256-SHA256',
    'AES128-GCM-SHA256',
    'AES128-SHA256',
    'AES256-SHA',
  ].join(':');

  /**
     * Create a KlapTransport instance
     * @param {Object} options - Transport options
     * @param {DeviceConfig} options.config - Device configuration
     */
  constructor({ config }) {
    super({ config });

    this._httpClient = new HttpClient(config);
    this._localSeed = null;
    if ((!this._credentials || this._credentials.username === null) && 
            !this._credentialsHash) {
      this._credentials = new Credentials();
    }
    if (this._credentials) {
      this._localAuthHash = this.constructor.generateAuthHash(this._credentials);
      this._localAuthOwner = this.constructor.generateOwnerHash(this._credentials).toString('hex');
    } else {
      this._localAuthHash = Buffer.from(this._credentialsHash, 'base64');
    }
    this._defaultCredentialsAuthHash = {};
    this._blankAuthHash = null;
    this._handshakeLock = false; // Simple lock mechanism
    this._queryLock = false; // Simple lock mechanism
    this._handshakeDone = false;

    this._encryptionSession = null;
    this._sessionExpireAt = null;

    this._sessionCookie = null;

    const protocol = config.connectionType.https ? 'https' : 'http';
    this._appUrl = new URL(`${protocol}://${this._host}:${this._port}/app`);
    this._requestUrl = new URL(`${this._appUrl}/request`);

    this._sslContext = null;
  }

  /**
     * Default port for the transport
     * @returns {number} Default port
     */
  get defaultPort() {
    const config = this._config;
    if (config.connectionType.httpPort) {
      return config.connectionType.httpPort;
    }

    if (config.connectionType.https) {
      return KlapTransport.DEFAULT_HTTPS_PORT;
    }

    return KlapTransport.DEFAULT_PORT;
  }

  /**
     * The hashed credentials used by the transport
     * @returns {string|null} Credentials hash
     */
  get credentialsHash() {
    if (this._credentials && this._credentials.equals(new Credentials())) {
      return null;
    }
    return this._localAuthHash.toString('base64');
  }

  /**
     * Perform handshake1
     * @returns {Promise<Array>} [localSeed, remoteSeed, authHash]
     */
  async performHandshake1() {
    const localSeed = randomBytes(16);

    // Handshake 1 has a payload of local_seed
    // and a response of 16 bytes, followed by
    // sha256(remote_seed | auth_hash)

    const payload = localSeed;
    const url = new URL(`${this._appUrl}/handshake1`);

    const [responseStatus, responseData] = await this._httpClient.post(
      url, { data: payload, ssl: this._getSslContext() }
    );


    if (responseStatus !== 200) {
      throw new KasaException(
        `Device ${this._host} responded with ${responseStatus} to handshake1`
      );
    }

    const remoteSeed = responseData.slice(0, 16);
    const serverHash = responseData.slice(16); // Take ALL remaining bytes (should be 32)

    if (serverHash.length !== 32) {
      throw new KasaException(
        `Device ${this._host} responded with unexpected klap response ${responseData.toString('hex')} to handshake1`
      );
    }


    const localSeedAuthHash = KlapTransport.handshake1SeedAuthHash(
      localSeed, remoteSeed, this._localAuthHash
    );

    // Check the response from the device with local credentials
    // Compare full 32-byte SHA256 hashes directly (like Python does)
    if (localSeedAuthHash.equals(serverHash)) {
      return [localSeed, remoteSeed, this._localAuthHash];
    }

    // Now check against the default setup credentials
    for (const [key, value] of Object.entries(DEFAULT_CREDENTIALS)) {
      if (!(key in this._defaultCredentialsAuthHash)) {
        const defaultCredentials = getDefaultCredentials(value);
        this._defaultCredentialsAuthHash[key] = this.constructor.generateAuthHash(defaultCredentials);
      }

      const defaultCredentialsSeedAuthHash = this.constructor.handshake1SeedAuthHash(
        localSeed,
        remoteSeed,
        this._defaultCredentialsAuthHash[key]
      );

      if (defaultCredentialsSeedAuthHash.equals(serverHash)) {
        return [localSeed, remoteSeed, this._defaultCredentialsAuthHash[key]];
      }
    }

    // Always check against blank credentials as fallback (even if current creds are blank)
    // This is necessary because the device might expect a different blank auth calculation
    const blankCreds = new Credentials();
    if (!this._blankAuthHash) {
      this._blankAuthHash = this.constructor.generateAuthHash(blankCreds);
    }

    const blankSeedAuthHash = this.constructor.handshake1SeedAuthHash(
      localSeed,
      remoteSeed,
      this._blankAuthHash
    );

    if (blankSeedAuthHash.equals(serverHash)) {
      return [localSeed, remoteSeed, this._blankAuthHash];
    }

    const msg = 
            `Device response did not match our challenge on ip ${this._host}, ` +
            'check that your e-mail and password (both case-sensitive) are correct.';
    throw new AuthenticationError(msg);
  }

  /**
     * Perform handshake2
     * @param {Buffer} localSeed - Local seed
     * @param {Buffer} remoteSeed - Remote seed
     * @param {Buffer} authHash - Auth hash
     * @returns {Promise<KlapEncryptionSession>} Encryption session
     */
  async performHandshake2(localSeed, remoteSeed, authHash) {
    // Handshake 2 has the following payload:
    //    sha256(serverBytes | authenticator)

    const url = new URL(`${this._appUrl}/handshake2`);
    const payload = this.constructor.handshake2SeedAuthHash(localSeed, remoteSeed, authHash);

    const [responseStatus] = await this._httpClient.post(
      url,
      {
        data: payload,
        cookiesDict: this._sessionCookie,
        ssl: this._getSslContext()
      }
    );


    if (responseStatus !== 200) {
      // This shouldn't be caused by incorrect
      // credentials so don't raise AuthenticationError
      throw new KasaException(
        `Device ${this._host} responded with ${responseStatus} to handshake2`
      );
    }

    return new KlapEncryptionSession(localSeed, remoteSeed, authHash);
  }

  /**
     * Perform handshake1 and handshake2
     * Sets the encryption_session if successful
     * @returns {Promise<void>}
     */
  async performHandshake() {
    this._handshakeDone = false;
    this._sessionExpireAt = null;
    this._sessionCookie = null;

    const [localSeed, remoteSeed, authHash] = await this.performHandshake1();
        
    const cookie = this._httpClient.getCookie(KlapTransport.SESSION_COOKIE_NAME);
    if (cookie) {
      this._sessionCookie = { [KlapTransport.SESSION_COOKIE_NAME]: cookie };
    }
        
    // The device returns a TIMEOUT cookie on handshake1 which
    // it doesn't like to get back so we store the one we want
    const timeout = parseInt(
      this._httpClient.getCookie(KlapTransport.TIMEOUT_COOKIE_NAME) || String(ONE_DAY_SECONDS)
    );
    // There is a 24 hour timeout on the session cookie
    // but the clock on the device is not always accurate
    // so we set the expiry to 24 hours from now minus a buffer
    this._sessionExpireAt = Date.now() + (timeout * 1000) - (SESSION_EXPIRE_BUFFER_SECONDS * 1000);
        
    this._encryptionSession = await this.performHandshake2(localSeed, remoteSeed, authHash);
    this._handshakeDone = true;
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
    if (!this._handshakeDone || this._handshakeSessionExpired()) {
      await this.performHandshake();
    }

    // Check for validity
    if (!this._encryptionSession) {
      throw new KasaException('Encryption session not established');
    }

    const [payload, seq] = this._encryptionSession.encrypt(request);

    const [responseStatus, responseData] = await this._httpClient.post(
      this._requestUrl,
      {
        params: { seq: seq.toString() },
        data: payload,
        cookiesDict: this._sessionCookie,
        ssl: this._getSslContext()
      }
    );

    const msg = 
            `Host is ${this._host}, ` +
            `Sequence is ${seq}, ` +
            `Response status is ${responseStatus}, Request was ${request}`;
        
    if (responseStatus !== 200) {
      // If we failed with a security error, force a new handshake next time.
      if (responseStatus === 403) {
        this._handshakeDone = false;
        throw new RetryableError(
          `Got a security error from ${this._host} after handshake completed`
        );
      } else {
        throw new KasaException(
          `Device ${this._host} responded with ${responseStatus} to request with seq ${seq}`
        );
      }
    } else {
      try {
        const decryptedResponse = this._encryptionSession.decrypt(responseData);
        const jsonPayload = JSON.parse(decryptedResponse);
        return jsonPayload;
      } catch (ex) {
        throw new KasaException(
          `Error trying to decrypt device ${this._host} response: ${ex.message}`
        );
      }
    }
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
     * Reset internal handshake state
     * @returns {Promise<void>}
     */
  async reset() {
    this._handshakeDone = false;
  }

  /**
     * Generate an md5 auth hash for the protocol on the supplied credentials
     * @static
     * @param {Credentials} creds - Credentials object
     * @returns {Buffer} Auth hash
     */
  static generateAuthHash(creds) {
    const un = creds.username;
    const pw = creds.password;
    return md5(Buffer.concat([md5(Buffer.from(un, 'utf8')), md5(Buffer.from(pw, 'utf8'))]));
  }

  /**
     * Generate handshake1 seed auth hash
     * @static
     * @param {Buffer} localSeed - Local seed
     * @param {Buffer} remoteSeed - Remote seed
     * @param {Buffer} authHash - Auth hash
     * @returns {Buffer} Seed auth hash
     */
  static handshake1SeedAuthHash(localSeed, remoteSeed, authHash) {
    return sha256(Buffer.concat([localSeed, authHash]));
  }

  /**
     * Generate handshake2 seed auth hash
     * @static
     * @param {Buffer} localSeed - Local seed
     * @param {Buffer} remoteSeed - Remote seed
     * @param {Buffer} authHash - Auth hash
     * @returns {Buffer} Seed auth hash
     */
  static handshake2SeedAuthHash(localSeed, remoteSeed, authHash) {
    return sha256(Buffer.concat([remoteSeed, authHash]));
  }

  /**
     * Return the MD5 hash of the username in this object
     * @static
     * @param {Credentials} creds - Credentials object
     * @returns {Buffer} Owner hash
     */
  static generateOwnerHash(creds) {
    const un = creds.username;
    return md5(Buffer.from(un, 'utf8'));
  }

  /**
     * Create SSL context
     * @private
     * @returns {Object} SSL context options
     */
  _createSslContext() {
    return {
      rejectUnauthorized: false,
      ciphers: KlapTransport.CIPHERS,
    };
  }

  /**
     * Get SSL context
     * @private
     * @returns {Object} SSL context options
     */
  _getSslContext() {
    if (!this._sslContext) {
      this._sslContext = this._createSslContext();
    }
    return this._sslContext;
  }
}

/**
 * Implementation of the KLAP encryption protocol with v2 handshake hashes
 */
export class KlapTransportV2 extends KlapTransport {
  /**
     * Generate an auth hash for the protocol on the supplied credentials (v2)
     * @static
     * @param {Credentials} creds - Credentials object
     * @returns {Buffer} Auth hash
     */
  static generateAuthHash(creds) {
    const un = creds.username;
    const pw = creds.password;
    return sha256(Buffer.concat([sha1(Buffer.from(un, 'utf8')), sha1(Buffer.from(pw, 'utf8'))]));
  }

  /**
     * Generate handshake1 seed auth hash (v2)
     * @static
     * @param {Buffer} localSeed - Local seed
     * @param {Buffer} remoteSeed - Remote seed
     * @param {Buffer} authHash - Auth hash
     * @returns {Buffer} Seed auth hash
     */
  static handshake1SeedAuthHash(localSeed, remoteSeed, authHash) {
    return sha256(Buffer.concat([localSeed, remoteSeed, authHash]));
  }

  /**
     * Generate handshake2 seed auth hash (v2)
     * @static
     * @param {Buffer} localSeed - Local seed
     * @param {Buffer} remoteSeed - Remote seed
     * @param {Buffer} authHash - Auth hash
     * @returns {Buffer} Seed auth hash
     */
  static handshake2SeedAuthHash(localSeed, remoteSeed, authHash) {
    return sha256(Buffer.concat([remoteSeed, localSeed, authHash]));
  }
}

/**
 * Class to represent an encryption session and its internal state
 * i.e. sequence number which the device expects to increment
 */
export class KlapEncryptionSession {
  /**
     * Create a KLAP encryption session
     * @param {Buffer} localSeed - Local seed
     * @param {Buffer} remoteSeed - Remote seed
     * @param {Buffer} userHash - User hash
     */
  constructor(localSeed, remoteSeed, userHash) {
    this.localSeed = localSeed;
    this.remoteSeed = remoteSeed;
    this.userHash = userHash;
    this._key = this._keyDerive(localSeed, remoteSeed, userHash);
    const [iv, seq] = this._ivDerive(localSeed, remoteSeed, userHash);
    this._iv = iv;
    this._seq = seq;
    this._sig = this._sigDerive(localSeed, remoteSeed, userHash);
  }

  /**
     * Derive encryption key
     * @private
     * @param {Buffer} localSeed - Local seed
     * @param {Buffer} remoteSeed - Remote seed
     * @param {Buffer} userHash - User hash
     * @returns {Buffer} Encryption key
     */
  _keyDerive(localSeed, remoteSeed, userHash) {
    const payload = Buffer.concat([Buffer.from('lsk', 'utf8'), localSeed, remoteSeed, userHash]);
    return createHash('sha256').update(payload).digest().slice(0, 16);
  }

  /**
     * Derive initialization vector and sequence number
     * @private
     * @param {Buffer} localSeed - Local seed
     * @param {Buffer} remoteSeed - Remote seed
     * @param {Buffer} userHash - User hash
     * @returns {Array} [iv, seq]
     */
  _ivDerive(localSeed, remoteSeed, userHash) {
    // iv is first 16 bytes of sha256, where the last 4 bytes forms the
    // sequence number used in requests and is incremented on each request
    const payload = Buffer.concat([Buffer.from('iv', 'utf8'), localSeed, remoteSeed, userHash]);
    const fullIv = createHash('sha256').update(payload).digest();
    const seq = fullIv.slice(-4).readInt32BE(0);
    return [fullIv.slice(0, 12), seq];
  }

  /**
     * Derive signature hash
     * @private
     * @param {Buffer} localSeed - Local seed
     * @param {Buffer} remoteSeed - Remote seed
     * @param {Buffer} userHash - User hash
     * @returns {Buffer} Signature hash
     */
  _sigDerive(localSeed, remoteSeed, userHash) {
    // used to create a hash with which to prefix each request
    const payload = Buffer.concat([Buffer.from('ldk', 'utf8'), localSeed, remoteSeed, userHash]);
    return createHash('sha256').update(payload).digest().slice(0, 28);
  }

  /**
     * Generate cipher for current sequence
     * @private
     * @returns {Object} Cipher object
     */
  _generateCipher() {
    const ivSeq = Buffer.concat([this._iv, packSignedLong(this._seq)]);
    return createCipheriv('aes-128-cbc', this._key, ivSeq);
  }

  /**
     * Generate decipher for current sequence
     * @private
     * @returns {Object} Decipher object
     */
  _generateDecipher() {
    const ivSeq = Buffer.concat([this._iv, packSignedLong(this._seq)]);
    return createDecipheriv('aes-128-cbc', this._key, ivSeq);
  }

  /**
     * Encrypt the data and increment the sequence number
     * @param {Buffer|string} msg - Message to encrypt
     * @returns {Array} [encrypted_data, sequence_number]
     */
  encrypt(msg) {
    this._seq += 1;
    const cipher = this._generateCipher();

    if (typeof msg === 'string') {
      msg = Buffer.from(msg, 'utf8');
    }

    // Add PKCS7 padding manually
    const blockSize = 16;
    const paddingLength = blockSize - (msg.length % blockSize);
    const padding = Buffer.alloc(paddingLength, paddingLength);
    const paddedData = Buffer.concat([msg, padding]);

    let ciphertext = cipher.update(paddedData);
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
        
    const signature = createHash('sha256')
      .update(Buffer.concat([this._sig, packSignedLong(this._seq), ciphertext]))
      .digest();
            
    return [Buffer.concat([signature, ciphertext]), this._seq];
  }

  /**
     * Decrypt the data
     * @param {Buffer} msg - Message to decrypt
     * @returns {string} Decrypted message
     */
  decrypt(msg) {
    const decipher = this._generateDecipher();
    let dp = decipher.update(msg.slice(32));
    dp = Buffer.concat([dp, decipher.final()]);
        
    // Remove PKCS7 padding manually - but validate first
    if (dp.length === 0) {
      return '';
    }

    const paddingLength = dp[dp.length - 1];

    // Validate PKCS7 padding
    if (paddingLength > 0 && paddingLength <= 16 && paddingLength <= dp.length) {
      // Check if all padding bytes are the same
      let validPadding = true;
      for (let i = dp.length - paddingLength; i < dp.length; i++) {
        if (dp[i] !== paddingLength) {
          validPadding = false;
          break;
        }
      }

      if (validPadding) {
        // Valid PKCS7 padding found, remove it
        const plaintextBytes = dp.slice(0, dp.length - paddingLength);
        return plaintextBytes.toString('utf8');
      }
    }

    // No valid PKCS7 padding found, return as-is
    return dp.toString('utf8');
  }
}