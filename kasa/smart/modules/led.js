/**
 * Module for led controls.
 */

import { SmartModule, allowUpdateAfter } from '../smartmodule.js';

/**
 * Implementation of led controls.
 */
export class Led extends SmartModule {
  static NAME = 'Led';
  static REQUIRED_COMPONENT = 'led';
  static QUERY_GETTER_NAME = 'get_led_info';

  // Led queries can cause device to crash on P100
  static MINIMUM_UPDATE_INTERVAL_SECS = 60 * 60;

  /**
   * Query to execute during the update cycle.
   * @returns {Object} Query object
   */
  query() {
    return { [this.constructor.QUERY_GETTER_NAME]: null };
  }

  /**
   * LED mode setting.
   * "always", "never", "night_mode"
   * @returns {string} LED mode
   */
  get mode() {
    return this.data.led_rule;
  }

  /**
   * Return current led status.
   * @returns {boolean} LED status
   */
  get led() {
    return this.data.led_rule !== 'never';
  }

  /**
   * Set led.
   * @param {boolean} enable - Whether to enable LED
   * @returns {Promise<Object>} Command result
   */
  async setLed(enable) {
    const rule = enable ? 'always' : 'never';
    return await this.call('set_led_info', { ...this.data, led_rule: rule });
  }

  /**
   * Night mode settings.
   * @returns {Object} Night mode settings
   */
  get nightModeSettings() {
    return {
      start: this.data.start_time,
      end: this.data.end_time,
      type: this.data.night_mode_type,
      sunrise_offset: this.data.sunrise_offset,
      sunset_offset: this.data.sunset_offset,
    };
  }
}

// apply decorator manually as JS doesn't support them natively yet
allowUpdateAfter(Led.prototype, 'setLed', Object.getOwnPropertyDescriptor(Led.prototype, 'setLed'));

SmartModule.registerModule(Led);
