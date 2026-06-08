/**
 * Implementation of energy monitoring module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of energy monitoring module.
 */
export class Energy extends SmartModule {
  static NAME = 'Energy';
  static REQUIRED_COMPONENT = 'energy_monitoring';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    const req = {
      'get_energy_usage': null,
    };
    if (this._device._components && this._device._components.energy_monitoring > 1) {
      req['get_current_power'] = null;
      req['get_emeter_data'] = null;
    }
    return req;
  }

  /**
     * Current power in watts.
     * @returns {number|null} Consumption
     */
  get currentConsumption() {
    const data = this._device._lastUpdate;
    const usage = data.get_energy_usage;
    const emeter = data.get_emeter_data;

    if (usage && usage.current_power !== undefined) {
      return usage.current_power / 1000;
    }
    if (emeter && emeter.power_mw !== undefined) {
      return emeter.power_mw / 1000;
    }
    return null;
  }

  /**
     * Get the current voltage in V.
     * @returns {number|null} Voltage
     */
  get voltage() {
    const emeter = this._device._lastUpdate.get_emeter_data;
    if (emeter && emeter.voltage_mv !== undefined) {
      return emeter.voltage_mv / 1000;
    }
    return null;
  }

  /**
     * Return the current in A.
     * @returns {number|null} Current
     */
  get current() {
    const emeter = this._device._lastUpdate.get_emeter_data;
    if (emeter && emeter.current_ma !== undefined) {
      return emeter.current_ma / 1000;
    }
    return null;
  }

  /**
     * Get the energy value for today in kWh.
     * @returns {number|null} Consumption today
     */
  get consumptionToday() {
    const usage = this._device._lastUpdate.get_energy_usage;
    if (usage && usage.today_energy !== undefined) {
      return usage.today_energy / 1000;
    }
    return null;
  }
}

SmartModule.registerModule(Energy);
