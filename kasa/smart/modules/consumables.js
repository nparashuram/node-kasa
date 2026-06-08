/**
 * Implementation of vacuum consumables.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of vacuum consumables.
 */
export class Consumables extends SmartModule {
  static NAME = 'Consumables';
  static REQUIRED_COMPONENT = 'consumables';
  static QUERY_GETTER_NAME = 'getConsumablesInfo';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return { [this.constructor.QUERY_GETTER_NAME]: null };
  }

  /**
     * Reset consumable stats.
     * @param {string} consumableName - Consumable name
     * @returns {Promise<Object>} Result
     */
  async resetConsumable(consumableName) {
    return await this.call('resetConsumablesTime', { 'reset_list': [consumableName] });
  }
}

SmartModule.registerModule(Consumables);
