/**
 * Module for led controls.
 */

import { IotModule } from '../iotmodule.js';

/**
 * Implementation of led controls.
 */
export class Led extends IotModule {
  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }

  /**
     * LED mode setting.
     * "always", "never"
     * @returns {string} LED mode
     */
  get mode() {
    return this.led ? 'always' : 'never';
  }

  /**
     * Return the state of the led.
     * @returns {boolean} LED state
     */
  get led() {
    const sysInfo = this.data;
    return Boolean(1 - sysInfo.led_off);
  }

  /**
     * Set the state of the led (night mode).
     * @param {boolean} state - True for LED on, false for LED off
     * @returns {Promise<Object>} Command result
     */
  async setLed(state) {
    return await this.call('set_led_off', { 'off': state ? 0 : 1 });
  }

  /**
     * Return whether the module is supported by the device.
     * @returns {boolean} Is supported
     */
  get isSupported() {
    return 'led_off' in this.data;
  }
}
