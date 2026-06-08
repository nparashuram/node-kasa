/**
 * Implementation of brightness module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of brightness module.
 */
export class Brightness extends SmartModule {
  static NAME = 'Brightness';
  static REQUIRED_COMPONENT = 'brightness';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }

  /**
     * Return current brightness.
     * @returns {number} Brightness
     */
  get brightness() {
    return this._device._lastUpdate.get_device_info.brightness;
  }

  /**
     * Set the brightness.
     * @param {number} brightness - Brightness (0-100)
     * @returns {Promise<Object>} Result
     */
  async setBrightness(brightness) {
    if (brightness === 0) {
      return await this._device.turnOff();
    }
    return await this.call('set_device_info', { 'brightness': brightness });
  }
}

SmartModule.registerModule(Brightness);
