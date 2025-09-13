/**
 * Module for base energy module.
 */

import { Module } from '../module.js';
import { Feature } from '../feature.js';

/**
 * Base interface to represent an Energy module.
 * @abstract
 */
export class Energy extends Module {
  /**
   * Features supported by the energy module.
   */
  static ModuleFeature = {
    /** Device reports voltage and current */
    VOLTAGE_CURRENT: 1,
    /** Device reports consumption_total */
    CONSUMPTION_TOTAL: 2,
    /** Device reports periodic stats via getDailyStats and getMonthlyStats */
    PERIODIC_STATS: 4
  };

  constructor(device, module) {
    super(device, module);
    this._supported = 0;
  }

  /**
   * Return True if module supports the feature.
   * @param {number} moduleFeature - Feature to check from Energy.ModuleFeature
   * @returns {boolean} True if feature is supported
   */
  supports(moduleFeature) {
    return (moduleFeature & this._supported) !== 0;
  }

  /**
   * Initialize features.
   */
  _initializeFeatures() {
    const device = this._device;
    
    this._addFeature(new Feature({
      device,
      name: 'Current consumption',
      attributeGetter: 'currentConsumption',
      container: this,
      unitGetter: () => 'W',
      id: 'current_consumption',
      precisionHint: 1,
      category: Feature.Category.Primary,
      type: Feature.Type.Sensor,
    }));

    this._addFeature(new Feature({
      device,
      name: 'Today\'s consumption', 
      attributeGetter: 'consumptionToday',
      container: this,
      unitGetter: () => 'kWh',
      id: 'consumption_today',
      precisionHint: 3,
      category: Feature.Category.Info,
      type: Feature.Type.Sensor,
    }));

    this._addFeature(new Feature({
      device,
      id: 'consumption_this_month',
      name: 'This month\'s consumption',
      attributeGetter: 'consumptionThisMonth', 
      container: this,
      unitGetter: () => 'kWh',
      precisionHint: 3,
      category: Feature.Category.Info,
      type: Feature.Type.Sensor,
    }));

    if (this.supports(Energy.ModuleFeature.CONSUMPTION_TOTAL)) {
      this._addFeature(new Feature({
        device,
        name: 'Total consumption since reboot',
        attributeGetter: 'consumptionTotal',
        container: this,
        unitGetter: () => 'kWh', 
        id: 'consumption_total',
        precisionHint: 3,
        category: Feature.Category.Info,
        type: Feature.Type.Sensor,
      }));
    }

    if (this.supports(Energy.ModuleFeature.VOLTAGE_CURRENT)) {
      this._addFeature(new Feature({
        device,
        name: 'Voltage',
        attributeGetter: 'voltage',
        container: this,
        unitGetter: () => 'V',
        id: 'voltage',
        precisionHint: 1,
        category: Feature.Category.Primary,
        type: Feature.Type.Sensor,
      }));

      this._addFeature(new Feature({
        device,
        name: 'Current',
        attributeGetter: 'current',
        container: this,
        unitGetter: () => 'A',
        id: 'current',
        precisionHint: 2,
        category: Feature.Category.Primary,
        type: Feature.Type.Sensor,
      }));
    }
  }

  /**
   * Return current energy readings.
   * @returns {Object} Energy status object
   * @abstract
   */
  get status() {
    throw new Error('Abstract property \'status\' must be implemented by subclass');
  }

  /**
   * Get the current power consumption in Watt.
   * @returns {number|null} Current consumption in watts
   * @abstract
   */
  get currentConsumption() {
    throw new Error('Abstract property \'currentConsumption\' must be implemented by subclass');
  }

  /**
   * Return today's energy consumption in kWh.
   * @returns {number|null} Today's consumption in kWh
   * @abstract
   */
  get consumptionToday() {
    throw new Error('Abstract property \'consumptionToday\' must be implemented by subclass');
  }

  /**
   * Return this month's energy consumption in kWh.
   * @returns {number|null} This month's consumption in kWh
   * @abstract
   */
  get consumptionThisMonth() {
    throw new Error('Abstract property \'consumptionThisMonth\' must be implemented by subclass');
  }

  /**
   * Return total consumption since last reboot in kWh.
   * @returns {number|null} Total consumption in kWh
   * @abstract
   */
  get consumptionTotal() {
    throw new Error('Abstract property \'consumptionTotal\' must be implemented by subclass');
  }

  /**
   * Return the current in A.
   * @returns {number|null} Current in amperes
   * @abstract
   */
  get current() {
    throw new Error('Abstract property \'current\' must be implemented by subclass');
  }

  /**
   * Get the current voltage in V.
   * @returns {number|null} Voltage in volts
   * @abstract
   */
  get voltage() {
    throw new Error('Abstract property \'voltage\' must be implemented by subclass');
  }

  /**
   * Return real-time statistics.
   * @returns {Promise<Object>} Energy status object
   * @abstract
   */
  async getStatus() {
    throw new Error('Abstract method \'getStatus\' must be implemented by subclass');
  }

  /**
   * Erase all stats.
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async eraseStats() {
    throw new Error('Abstract method \'eraseStats\' must be implemented by subclass');
  }

  /**
   * Return daily stats for the given year & month.
   *
   * The return value is a dictionary of {day: energy, ...}.
   * @param {Object} options - Options for daily stats
   * @param {number|null} [options.year] - Year to get stats for
   * @param {number|null} [options.month] - Month to get stats for
   * @param {boolean} [options.kwh=true] - Whether to return kWh or raw values
   * @returns {Promise<Object>} Daily stats object
   * @abstract
   */
  async getDailyStats({ year = null, month = null, kwh = true } = {}) {
    throw new Error('Abstract method \'getDailyStats\' must be implemented by subclass');
  }

  /**
   * Return monthly stats for the given year.
   * @param {Object} options - Options for monthly stats
   * @param {number|null} [options.year] - Year to get stats for
   * @param {boolean} [options.kwh=true] - Whether to return kWh or raw values
   * @returns {Promise<Object>} Monthly stats object
   * @abstract
   */
  async getMonthlyStats({ year = null, kwh = true } = {}) {
    throw new Error('Abstract method \'getMonthlyStats\' must be implemented by subclass');
  }

  /**
   * Mapping of deprecated attribute names to new ones.
   */
  static _deprecatedAttributes = {
    'emeterToday': 'consumptionToday',
    'emeterThisMonth': 'consumptionThisMonth',
    'realtime': 'status',
    'getRealtime': 'getStatus',
    'eraseEmeterStats': 'eraseStats',
    'getDaystat': 'getDailyStats',
    'getMonthstat': 'getMonthlyStats',
  };

  /**
   * Handle deprecated attribute access.
   * @param {string} name - Attribute name
   * @returns {*} Attribute value
   */
  __getattr(name) {
    const attr = Energy._deprecatedAttributes[name];
    if (attr) {
      return this[attr];
    }
    throw new Error(`Energy module has no attribute '${name}'`);
  }
}