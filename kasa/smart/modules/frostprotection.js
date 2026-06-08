/**
 * Frost protection module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation for frost protection module.
 */
export class FrostProtection extends SmartModule {
  static NAME = 'FrostProtection';
  static REQUIRED_COMPONENT = 'frost_protection';
  static QUERY_GETTER_NAME = 'get_frost_protection';

  /**
     * Return True if frost protection is on.
     * @returns {boolean} Enabled
     */
  get enabled() {
    return this._device.sysInfo.frost_protection_on;
  }

  /**
     * Enable/disable frost protection.
     * @param {boolean} enable - True to enable
     * @returns {Promise<Object>} Result
     */
  async setEnabled(enable) {
    return await this.call('set_device_info', { 'frost_protection_on': enable });
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}

SmartModule.registerModule(FrostProtection);
