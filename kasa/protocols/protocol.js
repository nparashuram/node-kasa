/**
 * Implementation of the TP-Link Smart Home Protocol.
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

import { createHash } from 'crypto';
// Network error constants - these are errno values
const ECONNREFUSED = 'ECONNREFUSED';
const EHOSTDOWN = 'EHOSTDOWN';  
const EHOSTUNREACH = 'EHOSTUNREACH';

const NO_RETRY_ERRORS = new Set([EHOSTDOWN, EHOSTUNREACH, ECONNREFUSED]);

// Struct for big-endian 32-bit unsigned integer
const packUint32BE = (num) => {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32BE(num, 0);
  return buffer;
};

/**
 * Redact sensitive data for logging
 * @param {*} data - Data to redact
 * @param {Object} redactors - Map of field names to redaction functions
 * @returns {*} Redacted data
 */
export function redactData(data, redactors) {
  if (!(data && typeof data === 'object')) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(val => redactData(val, redactors));
  }

  const redacted = { ...data };

  for (const [key, value] of Object.entries(redacted)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'string' && !value) {
      continue;
    }
    if (key in redactors) {
      const redactor = redactors[key];
      if (redactor) {
        try {
          redacted[key] = redactor(value);
        } catch {
          redacted[key] = '**REDACTEX**';
        }
      } else {
        redacted[key] = '**REDACTED**';
      }
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactData(value, redactors);
    } else if (Array.isArray(value)) {
      redacted[key] = value.map(item => redactData(item, redactors));
    }
  }

  return redacted;
}

/**
 * Return mac address with last two octects blanked
 * @param {string} mac - MAC address
 * @returns {string} Masked MAC address
 */
export function maskMac(mac) {
  if (mac.length === 12) {
    return `${mac.slice(0, 6)}000000`;
  }
  const delim = mac.includes(':') ? ':' : '-';
  const rest = Buffer.from('000000', 'hex').toString('hex').match(/.{2}/g).join(delim);
  return `${mac.slice(0, 8)}${delim}${rest}`;
}

/**
 * Return the MD5 hash of the payload
 * @param {Buffer} payload - Payload to hash
 * @returns {Buffer} MD5 hash
 */
export function md5(payload) {
  return createHash('md5').update(payload).digest();
}

/**
 * Base class for all TP-Link Smart Home communication
 */
export class BaseProtocol {
  /**
     * Create a protocol object
     * @param {Object} options - Protocol options
     * @param {BaseTransport} options.transport - Transport instance
     */
  constructor({ transport }) {
    this._transport = transport;
  }

  /**
     * Get the host address
     * @returns {string} Host address
     */
  get _host() {
    return this._transport._host;
  }

  /**
     * Return the connection parameters the device is using
     * @returns {DeviceConfig} Device configuration
     */
  get config() {
    return this._transport._config;
  }

  /**
     * Query the device for the protocol. Abstract method to be overridden.
     * @param {string|Object} request - Request to send
     * @param {number} [retryCount=3] - Number of retries
     * @returns {Promise<Object>} Response from device
     * @abstract
     */
  async query(request, retryCount = 3) {
    throw new Error('query method must be implemented by subclass');
  }

  /**
     * Close the protocol. Abstract method to be overridden.
     * @returns {Promise<void>}
     * @abstract
     */
  async close() {
    throw new Error('close method must be implemented by subclass');
  }
}