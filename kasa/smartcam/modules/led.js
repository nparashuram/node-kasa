/**
 * Module for led controls for cameras.
 */

import { SmartCamModule } from '../smartcammodule.js';

/**
 * Implementation of led controls.
 */
export class Led extends SmartCamModule {
  static REQUIRED_COMPONENT = 'led';
  static NAME = 'led';
  static QUERY_GETTER_NAME = 'getLedStatus';
  static QUERY_MODULE_NAME = 'led';
  static QUERY_SECTION_NAMES = 'config';

  /**
     * Return current led status.
     * @returns {boolean} Enabled
     */
  get led() {
    return this.data.config.enabled === 'on';
  }

  /**
     * Set led.
     * @param {boolean} enable - True to enable
     * @returns {Promise<Object>} Result
     */
  async setLed(enable) {
    const params = { 'enabled': enable ? 'on' : 'off' };
    return await this.call('setLedStatus', { 'led': { 'config': params } });
  }
}

SmartCamModule.registerModule(Led);
