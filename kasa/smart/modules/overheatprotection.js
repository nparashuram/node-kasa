/**
 * Overheat module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation for overheat_protection.
 */
export class OverheatProtection extends SmartModule {
  static NAME = 'OverheatProtection';
  static SYSINFO_LOOKUP_KEYS = ['overheated', 'overheat_status'];

  /**
     * Return True if device reports overheating.
     * @returns {boolean} Overheated status
     */
  get overheated() {
    const sysInfo = this._device.sysInfo;
    if (sysInfo.overheat_status !== undefined) {
      return sysInfo.overheat_status !== 'normal';
    }
    return sysInfo.overheated || false;
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}

SmartModule.registerModule(OverheatProtection);
