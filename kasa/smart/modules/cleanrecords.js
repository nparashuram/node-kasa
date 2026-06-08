/**
 * Implementation of vacuum cleaning records.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of vacuum cleaning records.
 */
export class CleanRecords extends SmartModule {
  static NAME = 'CleanRecords';
  static REQUIRED_COMPONENT = 'clean_percent';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return { 'getCleanRecords': {} };
  }

  /**
     * Return total cleaning count.
     * @returns {number} Count
     */
  get totalCleanCount() {
    return this.data.getCleanRecords.total_number;
  }
}

SmartModule.registerModule(CleanRecords);
