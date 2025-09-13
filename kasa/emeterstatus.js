/**
 * Module for emeter container.
 */

/**
 * Container for converting different representations of emeter data.
 *
 * Newer FW/HW versions postfix the variable names with the used units,
 * whereas the older do not have this feature.
 *
 * This class automatically converts between these two to allow
 * backwards and forwards compatibility.
 */
export class EmeterStatus {
  /**
   * Create an EmeterStatus instance.
   * @param {Object} data - The raw emeter data
   */
  constructor(data = {}) {
    // Copy all properties from data
    Object.assign(this, data);
  }

  /**
   * Return voltage in V.
   * @returns {number|null} voltage value or null
   */
  get voltage() {
    try {
      return this._getItem('voltage');
    } catch (error) {
      return null;
    }
  }

  /**
   * Return power in W.
   * @returns {number|null} power value or null
   */
  get power() {
    try {
      return this._getItem('power');
    } catch (error) {
      return null;
    }
  }

  /**
   * Return current in A.
   * @returns {number|null} current value or null
   */
  get current() {
    try {
      return this._getItem('current');
    } catch (error) {
      return null;
    }
  }

  /**
   * Return total in kWh.
   * @returns {number|null} total value or null
   */
  get total() {
    try {
      return this._getItem('total');
    } catch (error) {
      return null;
    }
  }

  /**
   * Return value in wanted units.
   * @param {string} item - The item key to retrieve
   * @returns {number|null} The value or null
   * @throws {Error} If the key is invalid
   */
  _getItem(item) {
    const validKeys = [
      'voltage_mv',
      'power_mw', 
      'current_ma',
      'energy_wh',
      'total_wh',
      'voltage',
      'power',
      'current', 
      'total',
      'energy'
    ];

    // 1. if requested data is available, return it
    if (this.hasOwnProperty(item)) {
      return this[item];
    }

    // otherwise decide how to convert it
    if (!validKeys.includes(item)) {
      throw new Error(`Invalid key: ${item}`);
    }

    if (item.includes('_')) { // upscale
      const baseKey = item.substring(0, item.indexOf('_'));
      if (this.hasOwnProperty(baseKey)) {
        return this[baseKey] * 1000;
      }
    } else { // downscale
      for (const key of Object.keys(this)) {
        if (key.startsWith(item)) {
          const value = this._getItem(key);
          if (value !== null) {
            return value / 1000;
          }
        }
      }
    }

    return null;
  }

  /**
   * String representation of the EmeterStatus.
   * @returns {string} String representation
   */
  toString() {
    return `<EmeterStatus power=${this.power} voltage=${this.voltage} current=${this.current} total=${this.total}>`;
  }

  /**
   * JSON representation for serialization.
   * @returns {Object} Plain object representation
   */
  toJSON() {
    const result = {};
    for (const [key, value] of Object.entries(this)) {
      if (typeof value !== 'function') {
        result[key] = value;
      }
    }
    return result;
  }
}