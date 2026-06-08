/**
 * Implementation for power protection.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation for power protection.
 */
export class PowerProtection extends SmartModule {
  static NAME = 'PowerProtection';
  static REQUIRED_COMPONENT = 'power_protection';

  /**
     * Return True if power protection has been triggered.
     * @returns {boolean} Overloaded status
     */
  get overloaded() {
    return this._device.sysInfo.power_protection_status === 'overloaded';
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return { 'get_protection_power': {}, 'get_max_power': {} };
  }
}

SmartModule.registerModule(PowerProtection);
