/**
 * Implementation of color temp module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of color temp module.
 */
export class ColorTemperature extends SmartModule {
  static NAME = 'ColorTemperature';
  static REQUIRED_COMPONENT = 'color_temperature';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }

  /**
     * Return current color temperature.
     * @returns {number} Temperature
     */
  get colorTemp() {
    return this._device._lastUpdate.get_device_info.color_temp;
  }

  /**
     * Set the color temperature.
     * @param {number} temp - Temperature
     * @param {Object} [options] - Options
     * @returns {Promise<Object>} Result
     */
  async setColorTemp(temp, { brightness = null } = {}) {
    const params = { 'color_temp': temp };
    if (brightness !== null) {
      params.brightness = brightness;
    }
    return await this.call('set_device_info', params);
  }
}

SmartModule.registerModule(ColorTemperature);
