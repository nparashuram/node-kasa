/**
 * Implementation of a light.
 */

import { Light as LightInterface } from '../../interfaces/light.js';
import { Module } from '../../module.js';
import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of a light.
 */
export class Light extends SmartModule {
  static NAME = 'Light';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }

  /**
     * Return the current HSV state of the bulb.
     * @returns {Object} HSV object
     */
  get hsv() {
    if (!this._device.modules[Module.Color]) {
      throw new Error('Bulb does not support color.');
    }
    return this._device.modules[Module.Color].hsv;
  }

  /**
     * Whether the bulb supports color temperature changes.
     * @returns {number} Color temperature
     */
  get colorTemp() {
    if (!this._device.modules[Module.ColorTemperature]) {
      throw new Error('Bulb does not support colortemp.');
    }
    return this._device.modules[Module.ColorTemperature].colorTemp;
  }

  /**
     * Return the current brightness in percentage.
     * @returns {number} Brightness
     */
  get brightness() {
    if (!this._device.modules[Module.Brightness]) {
      throw new Error('Bulb is not dimmable.');
    }
    return this._device.modules[Module.Brightness].brightness;
  }

  /**
     * Set new HSV.
     * @param {number} hue - Hue
     * @param {number} saturation - Saturation
     * @param {number|null} [value=null] - Value
     * @returns {Promise<Object>} Result
     */
  async setHsv(hue, saturation, value = null) {
    if (!this._device.modules[Module.Color]) {
      throw new Error('Bulb does not support color.');
    }
    return await this._device.modules[Module.Color].setHsv(hue, saturation, value);
  }

  /**
     * Set the color temperature.
     * @param {number} temp - Temperature
     * @param {Object} [options] - Options
     * @returns {Promise<Object>} Result
     */
  async setColorTemp(temp, { brightness = null } = {}) {
    if (!this._device.modules[Module.ColorTemperature]) {
      throw new Error('Bulb does not support colortemp.');
    }
    return await this._device.modules[Module.ColorTemperature].setColorTemp(temp, { brightness });
  }

  /**
     * Set the brightness in percentage.
     * @param {number} brightness - Brightness
     * @returns {Promise<Object>} Result
     */
  async setBrightness(brightness) {
    if (!this._device.modules[Module.Brightness]) {
      throw new Error('Bulb is not dimmable.');
    }
    return await this._device.modules[Module.Brightness].setBrightness(brightness);
  }

  /**
     * Set the light state.
     * @param {Object} state - Light state
     * @returns {Promise<Object>} Result
     */
  async setState(state) {
    const params = {};
    if (state.brightness === 0) {
      params.device_on = false;
    } else if (state.lightOn !== undefined) {
      params.device_on = state.lightOn;
    } else {
      params.device_on = true;
    }

    if (state.brightness !== undefined && state.brightness !== 0) {
      params.brightness = state.brightness;
    }
    if (state.hue !== undefined) params.hue = state.hue;
    if (state.saturation !== undefined) params.saturation = state.saturation;
    if (state.colorTemp !== undefined) params.color_temp = state.colorTemp;

    return await this.call('set_device_info', params);
  }
}

SmartModule.registerModule(Light);
