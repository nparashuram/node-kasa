/**
 * Module for a Thermostat.
 */

import { Module } from '../../module.js';
import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of a Thermostat.
 */
export class Thermostat extends SmartModule {
  static NAME = 'Thermostat';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }

  /**
     * Return thermostat state.
     * @returns {boolean} State
     */
  get state() {
    return this._device.modules[Module.TemperatureControl].state;
  }

  /**
     * Set thermostat state.
     * @param {boolean} enabled - True to enable
     * @returns {Promise<Object>} Result
     */
  async setState(enabled) {
    return await this._device.modules[Module.TemperatureControl].setState(enabled);
  }

  /**
     * Return target temperature.
     * @returns {number} Target temperature
     */
  get targetTemperature() {
    return this._device.modules[Module.TemperatureControl].targetTemperature;
  }

  /**
     * Set target temperature.
     * @param {number} target - Target temperature
     * @returns {Promise<Object>} Result
     */
  async setTargetTemperature(target) {
    return await this._device.modules[Module.TemperatureControl].setTargetTemperature(target);
  }

  /**
     * Return current temperature.
     * @returns {number} Temperature
     */
  get temperature() {
    return this._device.modules[Module.TemperatureSensor].temperature;
  }

  /**
     * Return current temperature unit.
     * @returns {string} Unit
     */
  get temperatureUnit() {
    return this._device.modules[Module.TemperatureSensor].temperatureUnit;
  }

  /**
     * Set the device temperature unit.
     * @param {string} unit - Unit
     * @returns {Promise<Object>} Result
     */
  async setTemperatureUnit(unit) {
    return await this._device.modules[Module.TemperatureSensor].setTemperatureUnit(unit);
  }
}

SmartModule.registerModule(Thermostat);
