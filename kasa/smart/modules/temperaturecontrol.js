/**
 * Implementation of temperature control module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of temperature control module.
 */
export class TemperatureControl extends SmartModule {
  static NAME = 'TemperatureControl';
  static REQUIRED_COMPONENT = 'temp_control';

  /**
     * Return thermostat state.
     * @returns {boolean} State
     */
  get state() {
    return this._device.sysInfo.frost_protection_on === false;
  }

  /**
     * Set thermostat state.
     * @param {boolean} enabled - True to enable
     * @returns {Promise<Object>} Result
     */
  async setState(enabled) {
    return await this.call('set_device_info', { 'frost_protection_on': !enabled });
  }

  /**
     * Return target temperature.
     * @returns {number} Target temperature
     */
  get targetTemperature() {
    return this._device.sysInfo.target_temp;
  }

  /**
     * Set target temperature.
     * @param {number} target - Target temperature
     * @returns {Promise<Object>} Result
     */
  async setTargetTemperature(target) {
    const params = { 'target_temp': target };
    if (this._device.sysInfo.frost_protection_on !== undefined) {
      params.frost_protection_on = false;
    }
    return await this.call('set_device_info', params);
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}

SmartModule.registerModule(TemperatureControl);
