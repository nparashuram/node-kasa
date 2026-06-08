/**
 * Implementation of fan_control module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of fan_control module.
 */
export class Fan extends SmartModule {
  static NAME = 'Fan';
  static REQUIRED_COMPONENT = 'fan_control';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }

  /**
     * Return fan speed level.
     * @returns {number} Speed level (0-4)
     */
  get fanSpeedLevel() {
    return this.data.device_on === false ? 0 : this.data.fan_speed_level;
  }

  /**
     * Set fan speed level, 0 for off, 1-4 for on.
     * @param {number} level - Speed level
     * @returns {Promise<Object>} Result
     */
  async setFanSpeedLevel(level) {
    if (level === 0) {
      return await this.call('set_device_info', { 'device_on': false });
    }
    return await this.call(
      'set_device_info', { 'device_on': true, 'fan_speed_level': level }
    );
  }

  /**
     * Return sleep mode status.
     * @returns {boolean} Sleep mode
     */
  get sleepMode() {
    return this.data.fan_sleep_mode_on;
  }

  /**
     * Set sleep mode.
     * @param {boolean} on - True to enable
     * @returns {Promise<Object>} Result
     */
  async setSleepMode(on) {
    return await this.call('set_device_info', { 'fan_sleep_mode_on': on });
  }
}

SmartModule.registerModule(Fan);
