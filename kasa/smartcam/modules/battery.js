/**
 * Implementation of smartcam battery module.
 */

import { SmartCamModule } from '../smartcammodule.js';

/**
 * Implementation of a battery module.
 */
export class Battery extends SmartCamModule {
  static REQUIRED_COMPONENT = 'battery';
  static NAME = 'battery';

  /**
     * Return battery level.
     * @returns {number} Battery percentage
     */
  get batteryPercent() {
    return this._device.sysInfo.battery_percent;
  }

  /**
     * Return True if battery is low.
     * @returns {boolean} Low battery status
     */
  get batteryLow() {
    return this._device.sysInfo.low_battery;
  }

  /**
     * Return True if battery is charging.
     * @returns {boolean} Charging status
     */
  get batteryCharging() {
    const v = this._device.sysInfo.battery_charging;
    if (typeof v === 'boolean') return v;
    if (v === null || v === undefined) return false;
    return ['yes', 'true', '1', 'charging', 'on'].includes(String(v).trim().toLowerCase());
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}

SmartCamModule.registerModule(Battery);
