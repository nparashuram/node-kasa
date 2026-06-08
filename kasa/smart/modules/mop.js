/**
 * Implementation of vacuum mop.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of vacuum mop.
 */
export class Mop extends SmartModule {
  static NAME = 'Mop';
  static REQUIRED_COMPONENT = 'mop';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {
      'getMopState': {},
      'getCleanAttr': { 'type': 'global' },
    };
  }

  /**
     * Return True if mop is attached.
     * @returns {boolean} Mop status
     */
  get mopAttached() {
    return this.data.getMopState.mop_state;
  }
}

SmartModule.registerModule(Mop);
