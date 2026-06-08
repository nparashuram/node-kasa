/**
 * Implementation of the motion detection (PIR) module found in some dimmers.
 */

import { IotModule, merge } from '../iotmodule.js';

/**
 * Range for motion detection.
 */
export const Range = {
  Far: 0,
  Mid: 1,
  Near: 2,
  Custom: 3
};

/**
 * Implements the motion detection (PIR) module.
 */
export class Motion extends IotModule {
  /**
     * Request PIR configuration.
     * @returns {Object} Query object
     */
  query() {
    const req = merge(
      this.queryForCommand('get_config'),
      this.queryForCommand('get_adc_value')
    );
    return req;
  }

  /**
     * Return current configuration.
     * @returns {Object} Config
     */
  get config() {
    return this.data.get_config;
  }

  /**
     * Return True if module is enabled.
     * @returns {boolean} Enabled
     */
  get enabled() {
    return Boolean(this.config.enable);
  }

  /**
     * Enable/disable PIR.
     * @param {boolean} state - True to enable, false to disable
     * @returns {Promise<Object>} Command result
     */
  async setEnabled(state) {
    return await this.call('set_enable', { 'enable': state ? 1 : 0 });
  }

  /**
     * Return current motion detection Range.
     * @returns {number} Range index
     */
  get range() {
    return this.config.trigger_index;
  }

  /**
     * Set the Range for the sensor.
     * @param {number} rangeIndex - Range index (0-3)
     * @returns {Promise<Object>} Command result
     */
  async setRange(rangeIndex) {
    return await this.call('set_trigger_sens', { 'index': rangeIndex });
  }

  /**
     * Return motion detection threshold.
     * @returns {number} Threshold
     */
  get threshold() {
    const rangeIndex = this.range;
    if (rangeIndex >= 0 && rangeIndex < this.config.array.length) {
      return this.config.array[rangeIndex];
    }
    return 0;
  }

  /**
     * Set the distance threshold at which the PIR sensor will trigger.
     * @param {number} value - Threshold value
     * @returns {Promise<Object>} Command result
     */
  async setThreshold(value) {
    return await this.call('set_trigger_sens', { 'index': Range.Custom, 'value': value });
  }

  /**
     * Return if the motion sensor has been triggered.
     * @returns {boolean} Triggered
     */
  get pirTriggered() {
    const config = this.config;
    if (!config.enable) return false;

    const adcValue = this.data.get_adc_value.value;
    const adcMin = config.min_adc;
    const adcMax = config.max_adc;
    const adcMid = Math.floor(Math.abs(adcMax - adcMin) / 2);

    const pirValue = adcMid - adcValue;
    const divisor = (pirValue < 0) ? (adcMid - adcMin) : (adcMax - adcMid);
    const pirPercent = (pirValue / divisor) * 100;
    const threshold = this.threshold;

    return Math.abs(pirPercent) > (100 - threshold);
  }
}
