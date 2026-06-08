/**
 * Implementation of battery module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of battery module.
 */
export class BatterySensor extends SmartModule {
  static NAME = 'BatterySensor';
  static REQUIRED_COMPONENT = 'battery_detect';
  static QUERY_GETTER_NAME = 'get_battery_detect_info';

  /**
     * Return battery level.
     * @returns {number} Battery percentage
     */
  get battery() {
    return this._device.sysInfo.battery_percentage;
  }

  /**
     * Return True if battery is low.
     * @returns {boolean} Battery low status
     */
  get batteryLow() {
    const sysInfo = this._device.sysInfo;
    return sysInfo.at_low_battery || sysInfo.is_low || false;
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}

SmartModule.registerModule(BatterySensor);
