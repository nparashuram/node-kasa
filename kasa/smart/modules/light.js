/**
 * Implementation of light module for SMART devices.
 */

import { SmartModule } from '../smartmodule.js';
import { LightState } from '../../interfaces/light.js';
import { Module } from '../../module.js';

/**
 * Implementation of a light.
 */
export class Light extends SmartModule {
  static NAME = 'Light';

  constructor(device, module) {
    super(device, module);
    this._lightState = new LightState();
  }

  /**
   * Get the features for this module and any sub modules.
   */
  get _allFeatures() {
    const ret = { ...this._moduleFeatures };
    const brightness = this._device.modules['Brightness'];
    if (brightness) {
      Object.assign(ret, brightness._moduleFeatures);
    }
    const color = this._device.modules['Color'];
    if (color) {
      Object.assign(ret, color._moduleFeatures);
    }
    const temp = this._device.modules['ColorTemperature'];
    if (temp) {
      Object.assign(ret, temp._moduleFeatures);
    }
    return ret;
  }

  /**
   * Query to execute during the update cycle.
   */
  query() {
    return {};
  }

  /**
   * Return the current HSV state of the bulb.
   */
  get hsv() {
    const color = this._device.modules['Color'];
    if (!color) {
      throw new Error('Bulb does not support color.');
    }
    return color.hsv;
  }

  /**
   * Return the current color temperature.
   */
  get colorTemp() {
    const temp = this._device.modules['ColorTemperature'];
    if (!temp) {
      throw new Error('Bulb does not support colortemp.');
    }
    return temp.colorTemp;
  }

  /**
   * Return the current brightness.
   */
  get brightness() {
    const brightness = this._device.modules['Brightness'];
    if (!brightness) {
      throw new Error('Bulb is not dimmable.');
    }
    return brightness.brightness;
  }

  /**
   * Set new HSV.
   */
  async setHsv(hue, saturation, value = null) {
    const color = this._device.modules['Color'];
    if (!color) {
      throw new Error('Bulb does not support color.');
    }
    return await color.setHsv(hue, saturation, value);
  }

  /**
   * Set the color temperature.
   */
  async setColorTemp(temp, { brightness = null } = {}) {
    const tempMod = this._device.modules['ColorTemperature'];
    if (!tempMod) {
      throw new Error('Bulb does not support colortemp.');
    }
    return await tempMod.setColorTemp(temp, { brightness });
  }

  /**
   * Set the brightness.
   */
  async setBrightness(brightness) {
    const brightnessMod = this._device.modules['Brightness'];
    if (!brightnessMod) {
      throw new Error('Bulb is not dimmable.');
    }
    return await brightnessMod.setBrightness(brightness);
  }

  /**
   * Set the light state.
   * @param {LightState} state - Light state
   */
  async setState(state) {
    const params = { 'device_on': true };
    if (state.brightness === 0) {
      params['device_on'] = false;
    } else if (state.light_on !== undefined && state.light_on !== null) {
      params['device_on'] = state.light_on;
    }

    if (state.brightness !== undefined && state.brightness !== null) params['brightness'] = state.brightness;
    if (state.hue !== undefined && state.hue !== null) params['hue'] = state.hue;
    if (state.saturation !== undefined && state.saturation !== null) params['saturation'] = state.saturation;
    if (state.color_temp !== undefined && state.color_temp !== null) params['color_temp'] = state.color_temp;

    return await this.call('set_device_info', params);
  }

  /**
   * Return the current light state.
   */
  get state() {
    return this._lightState;
  }

  /**
   * Perform actions after a device update.
   */
  async _postUpdateHook() {
    const device = this._device;
    const state = new LightState();
    if (!device.isOn) {
      state.light_on = false;
    } else {
      state.light_on = true;
      if (this._device.modules['Brightness']) {
        state.brightness = this.brightness;
      }
      if (this._device.modules['Color']) {
        const hsv = this.hsv;
        state.hue = hsv.hue;
        state.saturation = hsv.saturation;
      }
      if (this._device.modules['ColorTemperature']) {
        state.color_temp = this.colorTemp;
      }
    }
    this._lightState = state;
  }
}
