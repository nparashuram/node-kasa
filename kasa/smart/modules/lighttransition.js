/**
 * Module for smooth light transitions.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of gradual on/off.
 */
export class LightTransition extends SmartModule {
  static NAME = 'LightTransition';
  static REQUIRED_COMPONENT = 'on_off_gradually';
  static QUERY_GETTER_NAME = 'get_on_off_gradually_info';

  /**
     * Return True if gradual on/off is enabled.
     * @returns {boolean} Enabled
     */
  get enabled() {
    // Basic implementation for parity
    return this.data.enable || false;
  }

  /**
     * Enable gradual on/off.
     * @param {boolean} enable - True to enable
     * @returns {Promise<Object>} Result
     */
  async setEnabled(enable) {
    return await this.call('set_on_off_gradually_info', { 'enable': enable });
  }
}

SmartModule.registerModule(LightTransition);
