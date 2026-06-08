/**
 * Implementation of temperature module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of temperature module.
 */
export class TemperatureSensor extends SmartModule {
  static NAME = 'TemperatureSensor';
  static REQUIRED_COMPONENT = 'temperature';
  static QUERY_GETTER_NAME = 'get_comfort_temp_config';

  /**
     * Return current temperature.
     * @returns {number} Temperature
     */
  get temperature() {
    return this._device.sysInfo.current_temp;
  }

  /**
     * Return True if temperature is outside of the wanted range.
     * @returns {boolean} Warning status
     */
  get temperatureWarning() {
    return (this._device.sysInfo.current_temp_exception || 0) !== 0;
  }

  /**
     * Return current temperature unit.
     * @returns {string} Unit (celsius or fahrenheit)
     */
  get temperatureUnit() {
    return this._device.sysInfo.temp_unit;
  }

  /**
     * Set the device temperature unit.
     * @param {string} unit - Unit (celsius or fahrenheit)
     * @returns {Promise<Object>} Result
     */
  async setTemperatureUnit(unit) {
    return await this.call('set_temperature_unit', { 'temp_unit': unit });
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}

SmartModule.registerModule(TemperatureSensor);
