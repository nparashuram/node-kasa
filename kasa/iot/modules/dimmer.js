/**
 * Implementation of the dimmer config module found in dimmers.
 */

import { IotModule, merge } from '../iotmodule.js';

/**
 * Implements the dimmer config module.
 */
export class Dimmer extends IotModule {
  /**
     * Return current configuration.
     * @returns {Object} Config
     */
  get config() {
    return this.data.get_dimmer_parameters;
  }

  /**
     * Return the minimum dimming level for this dimmer.
     * @returns {number} Min threshold
     */
  get thresholdMin() {
    return this.config.minThreshold;
  }

  /**
     * Set the minimum dimming level for this dimmer.
     * @param {number} min - Min threshold (0-51)
     * @returns {Promise<Object>} Result
     */
  async setThresholdMin(min) {
    return await this.call('calibrate_brightness', { 'minThreshold': min });
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return merge(
      this.queryForCommand('get_dimmer_parameters'),
      this.queryForCommand('get_default_behavior')
    );
  }
}
