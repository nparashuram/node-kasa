/**
 * Implementation of emeter module.
 * This module provides energy monitoring functionality for IoT devices.
 */

import { IotModule } from '../iotmodule.js';
import { Feature } from '../../feature.js';

/**
 * Implementation for energy meter (emeter) module.
 * This module provides energy monitoring functionality.
 */
export class Emeter extends IotModule {
  /**
     * Create a new Emeter module.
     * @param {IotDevice} device - The device instance
     * @param {string} [module='emeter'] - The module name
     */
  constructor(device, module = 'emeter') {
    super(device, module);
  }

  /**
     * Return module queries for update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {
      get_realtime: {},
      get_daystat: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
      get_monthstat: { year: new Date().getFullYear() }
    };
  }

  /**
     * Get current power consumption in watts.
     * @returns {number|null} Current power in watts
     */
  get currentConsumption() {
    const realtime = this.realtimeData;
    if (!realtime) return null;
        
    // Handle different response formats
    return realtime.power || realtime.power_mw / 1000 || 0;
  }

  /**
     * Get current voltage.
     * @returns {number|null} Current voltage in volts
     */
  get voltage() {
    const realtime = this.realtimeData;
    if (!realtime) return null;
        
    return realtime.voltage || realtime.voltage_mv / 1000 || 0;
  }

  /**
     * Get current amperage.
     * @returns {number|null} Current amperage in amperes
     */
  get current() {
    const realtime = this.realtimeData;
    if (!realtime) return null;
        
    return realtime.current || realtime.current_ma / 1000 || 0;
  }

  /**
     * Get total energy consumption.
     * @returns {number|null} Total energy in kWh
     */
  get totalConsumption() {
    const realtime = this.realtimeData;
    if (!realtime) return null;
        
    return realtime.total || realtime.total_wh / 1000 || 0;
  }

  /**
     * Get realtime energy data.
     * @returns {Object|null} Realtime data
     */
  get realtimeData() {
    try {
      const data = this.data;
      return data?.get_realtime || null;
    } catch {
      return null;
    }
  }

  /**
     * Get daily statistics.
     * @returns {Array|null} Daily statistics
     */
  get dailyStats() {
    try {
      const data = this.data;
      return data?.get_daystat?.day_list || [];
    } catch {
      return [];
    }
  }

  /**
     * Get monthly statistics.
     * @returns {Array|null} Monthly statistics
     */
  get monthlyStats() {
    try {
      const data = this.data;
      return data?.get_monthstat?.month_list || [];
    } catch {
      return [];
    }
  }

  /**
     * Check if the emeter is supported.
     * @returns {boolean} True if supported
     */
  get isSupported() {
    // Basic check - if we have any realtime data, consider it supported
    return super.isSupported && this.realtimeData !== null;
  }

  /**
     * Estimated maximum size of query response.
     * @returns {number} Estimated size in bytes
     */
  get estimatedQueryResponseSize() {
    return 1024; // Emeter responses can be larger due to stats
  }
}