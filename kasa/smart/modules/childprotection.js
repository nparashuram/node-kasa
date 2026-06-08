/**
 * Implementation for child protection.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation for child protection.
 */
export class ChildProtection extends SmartModule {
  static NAME = 'ChildProtection';
  static REQUIRED_COMPONENT = 'child_protection';
  static QUERY_GETTER_NAME = 'get_child_protection';

  /**
     * Return True if child protection is enabled.
     * @returns {boolean} Enabled
     */
  get enabled() {
    return this.data.child_protection;
  }

  /**
     * Set child protection.
     * @param {boolean} enabled - True to enable
     * @returns {Promise<Object>} Result
     */
  async setEnabled(enabled) {
    return await this.call('set_child_protection', { 'enable': enabled });
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}

SmartModule.registerModule(ChildProtection);
