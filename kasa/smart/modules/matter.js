/**
 * Implementation of matter module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of matter module.
 */
export class Matter extends SmartModule {
  static NAME = 'Matter';
  static QUERY_GETTER_NAME = 'get_matter_setup_info';
  static REQUIRED_COMPONENT = 'matter';

  /**
     * Matter setup info.
     * @returns {Object} Info
     */
  get info() {
    return this.data;
  }
}

SmartModule.registerModule(Matter);
