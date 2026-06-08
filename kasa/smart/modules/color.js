/**
 * Implementation of color module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of color module.
 */
export class Color extends SmartModule {
  static NAME = 'Color';
  static REQUIRED_COMPONENT = 'color';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }

  /**
     * Return the current HSV state of the bulb.
     * @returns {Object} HSV
     */
  get hsv() {
    const info = this._device._lastUpdate.get_device_info;
    return {
      hue: info.hue || 0,
      saturation: info.saturation || 0,
      value: info.brightness || 0
    };
  }

  /**
     * Set new HSV.
     * @param {number} hue - Hue
     * @param {number} saturation - Saturation
     * @param {number|null} [value=null] - Value
     * @returns {Promise<Object>} Result
     */
  async setHsv(hue, saturation, value = null) {
    const params = {
      'color_temp': 0,
      'hue': hue,
      'saturation': saturation
    };
    if (value !== null) {
      params.brightness = value;
    }
    return await this.call('set_device_info', params);
  }
}

SmartModule.registerModule(Color);
