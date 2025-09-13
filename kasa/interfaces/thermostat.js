/**
 * Interact with a TPLink Thermostat.
 */

import { Module, FeatureAttribute } from '../module.js';

/**
 * Thermostat state enumeration.
 */
export class ThermostatState {
  static Heating = 'heating';
  static Calibrating = 'progress_calibration';  
  static Idle = 'idle';
  static Off = 'off';
  static Unknown = 'unknown';
}

/**
 * Base class for TP-Link Thermostat.
 * @abstract
 */
export class Thermostat extends Module {
  /**
   * Return thermostat state.
   * @returns {boolean} Thermostat enabled state
   * @abstract
   */
  get state() {
    throw new Error('Abstract property \'state\' must be implemented by subclass');
  }

  /**
   * Set thermostat state.
   * @param {boolean} enabled - Whether to enable thermostat
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setState(enabled) {
    throw new Error('Abstract method \'setState\' must be implemented by subclass');
  }

  /**
   * Return thermostat mode.
   * @returns {string} Thermostat mode from ThermostatState
   * @abstract
   */
  get mode() {
    throw new Error('Abstract property \'mode\' must be implemented by subclass');
  }

  /**
   * Return target temperature.
   * @returns {number} Target temperature
   * @abstract
   */
  get targetTemperature() {
    throw new Error('Abstract property \'targetTemperature\' must be implemented by subclass');
  }

  /**
   * Set target temperature.
   * @param {number} target - Target temperature to set
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setTargetTemperature(target) {
    throw new Error('Abstract method \'setTargetTemperature\' must be implemented by subclass');
  }

  /**
   * Return current temperature.
   * @returns {number} Current temperature
   * @abstract
   */
  get temperature() {
    throw new Error('Abstract property \'temperature\' must be implemented by subclass');
  }

  /**
   * Return current temperature unit.
   * @returns {'celsius'|'fahrenheit'} Temperature unit
   * @abstract
   */
  get temperatureUnit() {
    throw new Error('Abstract property \'temperatureUnit\' must be implemented by subclass');
  }

  /**
   * Set the device temperature unit.
   * @param {'celsius'|'fahrenheit'} unit - Temperature unit to set
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setTemperatureUnit(unit) {
    throw new Error('Abstract method \'setTemperatureUnit\' must be implemented by subclass');
  }
}

// Add FeatureAttribute metadata to methods that should be bound to features
Thermostat.prototype.targetTemperature._featureAttribute = new FeatureAttribute();
Thermostat.prototype.setTargetTemperature._featureAttribute = new FeatureAttribute();
Thermostat.prototype.temperature._featureAttribute = new FeatureAttribute();