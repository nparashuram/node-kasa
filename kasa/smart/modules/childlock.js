/**
 * Implementation of child lock.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation for child lock.
 */
export class ChildLock extends SmartModule {
  static NAME = 'ChildLock';
  static REQUIRED_COMPONENT = 'button_and_led';
  static QUERY_GETTER_NAME = 'getChildLockInfo';

  /**
     * Return True if child lock is enabled.
     * @returns {boolean} Enabled
     */
  get enabled() {
    return this.data.child_lock_status;
  }

  /**
     * Set child lock.
     * @param {boolean} enabled - True to enable
     * @returns {Promise<Object>} Result
     */
  async setEnabled(enabled) {
    return await this.call('setChildLockInfo', { 'child_lock_status': enabled });
  }
}

SmartModule.registerModule(ChildLock);
