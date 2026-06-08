/**
 * Implementation of trigger logs.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of trigger logs.
 */
export class TriggerLogs extends SmartModule {
  static NAME = 'TriggerLogs';
  static REQUIRED_COMPONENT = 'trigger_log';
  static MINIMUM_UPDATE_INTERVAL_SECS = 60 * 60;

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return { 'get_trigger_logs': { 'start_id': 0 } };
  }

  /**
     * Return logs.
     * @returns {Array<Object>} Logs
     */
  get logs() {
    return this.data.logs || [];
  }
}

SmartModule.registerModule(TriggerLogs);
