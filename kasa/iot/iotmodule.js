/**
 * Base class for IOT module implementations.
 */

import { KasaException } from '../exceptions.js';
import { Module } from '../module.js';

const _LOGGER = console; // Simple logger replacement

/**
 * Update dict recursively.
 * @param {Object} dest - Destination object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function _mergeDict(dest, source) {
  for (const [k, v] of Object.entries(source)) {
    if (k in dest && typeof v === 'object' && v !== null && !Array.isArray(v)) {
      _mergeDict(dest[k], v);
    } else {
      dest[k] = v;
    }
  }
  return dest;
}

export const merge = _mergeDict;

/**
 * Base class implementation for all IOT modules.
 */
export class IotModule extends Module {
  /**
     * Call the given method with the given parameters.
     * @param {string} method - Method name
     * @param {Object|null} [params=null] - Parameters
     * @returns {Promise<Object>} Result
     */
  async call(method, params = null) {
    return this._device._queryHelper(this._module, method, params);
  }

  /**
     * Create a request object for the given parameters.
     * @param {string} query - Query name
     * @param {Object|null} [params=null] - Parameters
     * @returns {Object} Request object
     */
  queryForCommand(query, params = null) {
    return this._device._createRequest(this._module, query, params);
  }

  /**
     * Estimated maximum size of query response.
     * 
     * The inheriting modules implement this to estimate how large a query response
     * will be so that queries can be split should an estimated response be too large
     * @returns {number} Estimated size
     */
  get estimatedQueryResponseSize() {
    return 256; // Estimate for modules that don't specify
  }

  /**
     * Return the module specific raw data from the last update.
     * @returns {Object} Module data
     */
  get data() {
    const dev = this._device;
    const q = this.query();

    if (!q) {
      return dev.sysInfo;
    }

    if (!(this._module in dev._lastUpdate)) {
      throw new KasaException(
        `You need to call update() prior accessing module data for '${this._module}'`
      );
    }

    return dev._lastUpdate[this._module];
  }

  /**
     * Return whether the module is supported by the device.
     * @returns {boolean} Is supported
     */
  get isSupported() {
    if (!(this._module in this._device._lastUpdate)) {
      return true;
    }

    return !('err_code' in this.data);
  }
}