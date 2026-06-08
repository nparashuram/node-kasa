/**
 * Implementation of contact sensor module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of contact sensor module.
 */
export class ContactSensor extends SmartModule {
  static NAME = 'ContactSensor';
  static SYSINFO_LOOKUP_KEYS = ['open'];

  /**
     * Return True if the contact sensor is open.
     * @returns {boolean} Open status
     */
  get isOpen() {
    return this._device.sysInfo.open;
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}

SmartModule.registerModule(ContactSensor);
