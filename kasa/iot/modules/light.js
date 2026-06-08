/**
 * Implementation of light module for IoT devices.
 */

import { IotModule } from '../iotmodule.js';

/**
 * Implementation of light module.
 */
export class Light extends IotModule {
  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }

  /**
     * Return the current brightness in percentage.
     * @returns {number} Brightness
     */
  get brightness() {
    return this._device.brightness;
  }

  /**
     * Set the brightness in percentage.
     * @param {number} brightness - Brightness (0-100)
     * @param {Object} [options] - Options
     * @returns {Promise<Object>} Result
     */
  async setBrightness(brightness, { transition = null } = {}) {
    return await this._device.setBrightness(brightness, { transition });
  }

  /**
     * Return the current HSV state of the bulb.
     * @returns {Object} HSV
     */
  get hsv() {
    return this._device.hsv;
  }

  /**
     * Set new HSV.
     * @param {number} hue - Hue
     * @param {number} saturation - Saturation
     * @param {number|null} [value=null] - Value
     * @param {Object} [options] - Options
     * @returns {Promise<Object>} Result
     */
  async setHsv(hue, saturation, value = null, { transition = null } = {}) {
    return await this._device.setHsv(hue, saturation, value, { transition });
  }

  /**
     * Return current color temperature.
     * @returns {number} Temperature
     */
  get colorTemp() {
    return this._device.colorTemp;
  }

  /**
     * Set the color temperature.
     * @param {number} temp - Temperature
     * @param {Object} [options] - Options
     * @returns {Promise<Object>} Result
     */
  async setColorTemp(temp, { transition = null } = {}) {
    return await this._device.setColorTemp(temp, { transition });
  }
}
