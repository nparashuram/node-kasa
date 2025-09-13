/**
 * Base class for all transport implementations.
 *
 * All transport classes must derive from this to implement the common interface.
 */

/**
 * Base class for all TP-Link protocol transports
 * @abstract
 */
export class BaseTransport {
  static DEFAULT_TIMEOUT = 5;

  /**
     * Create a protocol object
     * @param {Object} options - Transport options
     * @param {DeviceConfig} options.config - Device configuration
     */
  constructor({ config }) {
    this._config = config;
    this._host = config.host;
    this._port = config.portOverride || this.defaultPort;
    this._credentials = config.credentials;
    this._credentialsHash = config.credentialsHash;
    if (!config.timeout) {
      config.timeout = BaseTransport.DEFAULT_TIMEOUT;
    }
    this._timeout = config.timeout;
  }

  /**
     * The default port for the transport
     * @returns {number} Default port
     * @abstract
     */
  get defaultPort() {
    throw new Error('defaultPort property must be implemented by subclass');
  }

  /**
     * The hashed credentials used by the transport
     * @returns {string|null} Credentials hash
     * @abstract
     */
  get credentialsHash() {
    throw new Error('credentialsHash property must be implemented by subclass');
  }

  /**
     * Send a message to the device and return a response
     * @param {string} request - Request to send
     * @returns {Promise<Object>} Response from device
     * @abstract
     */
  async send(request) {
    throw new Error('send method must be implemented by subclass');
  }

  /**
     * Close the transport. Abstract method to be overridden.
     * @returns {Promise<void>}
     * @abstract
     */
  async close() {
    throw new Error('close method must be implemented by subclass');
  }

  /**
     * Reset internal state
     * @returns {Promise<void>}
     * @abstract
     */
  async reset() {
    throw new Error('reset method must be implemented by subclass');
  }
}