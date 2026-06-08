/**
 * Implementation of auto off module.
 */

import { SmartModule, allowUpdateAfter } from '../smartmodule.js';

/**
 * Implementation of auto off module.
 */
export class AutoOff extends SmartModule {
  static NAME = 'AutoOff';
  static REQUIRED_COMPONENT = 'auto_off';
  static QUERY_GETTER_NAME = 'get_auto_off_config';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return { [this.constructor.QUERY_GETTER_NAME]: { 'start_index': 0 } };
  }

  /**
     * Return True if enabled.
     * @returns {boolean} Enabled
     */
  get enabled() {
    return this.data.enable;
  }

  /**
     * Enable/disable auto off.
     * @param {boolean} enable - True to enable
     * @returns {Promise<Object>} Result
     */
  async setEnabled(enable) {
    return await this.call(
      'set_auto_off_config',
      { 'enable': enable, 'delay_min': this.data.delay_min }
    );
  }

  /**
     * Return time until auto off.
     * @returns {number} Delay in minutes
     */
  get delay() {
    return this.data.delay_min;
  }

  /**
     * Set time until auto off.
     * @param {number} delay - Delay in minutes
     * @returns {Promise<Object>} Result
     */
  async setDelay(delay) {
    return await this.call(
      'set_auto_off_config',
      { 'delay_min': delay, 'enable': this.data.enable }
    );
  }
}

SmartModule.registerModule(AutoOff);
