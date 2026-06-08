/**
 * Implementation of vacuum dustbin.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of vacuum dustbin.
 */
export class Dustbin extends SmartModule {
  static NAME = 'Dustbin';
  static REQUIRED_COMPONENT = 'dust_bucket';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {
      'getAutoDustCollection': {},
      'getDustCollectionInfo': {},
    };
  }

  /**
     * Start emptying the bin.
     * @returns {Promise<Object>} Result
     */
  async startEmptying() {
    return await this.call('setSwitchDustCollection', { 'switch_dust_collection': true });
  }
}

SmartModule.registerModule(Dustbin);
