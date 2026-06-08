/**
 * Implementation of the ambient light (LAS) module found in some dimmers.
 */

import { IotModule, merge } from '../iotmodule.js';

/**
 * Implements ambient light controls for the motion sensor.
 */
export class AmbientLight extends IotModule {
  /**
     * Request configuration.
     * @returns {Object} Query object
     */
  query() {
    return merge(
      this.queryForCommand('get_config'),
      this.queryForCommand('get_current_brt')
    );
  }

  /**
     * Return current ambient light config.
     * @returns {Object} Config
     */
  get config() {
    const config = this.data.get_config;
    return config.devs[0];
  }

  /**
     * Return True if the module is enabled.
     * @returns {boolean} Enabled
     */
  get enabled() {
    return Boolean(this.config.enable);
  }

  /**
     * Return ambient light brightness.
     * @returns {number} Brightness
     */
  get ambientlightBrightness() {
    return parseInt(this.data.get_current_brt.value);
  }

  /**
     * Enable/disable LAS.
     * @param {boolean} state - True to enable, false to disable
     * @returns {Promise<Object>} Command result
     */
  async setEnabled(state) {
    return await this.call('set_enable', { 'enable': state ? 1 : 0 });
  }

  /**
     * Return current brightness.
     * @returns {Promise<Object>} Current brightness
     */
  async getCurrentBrightness() {
    return await this.call('get_current_brt');
  }

  /**
     * Set the limit when the motion sensor is inactive.
     * @param {number} value - Brightness limit
     * @returns {Promise<Object>} Command result
     */
  async setBrightnessLimit(value) {
    return await this.call('set_brt_level', { 'index': 0, 'value': value });
  }
}
