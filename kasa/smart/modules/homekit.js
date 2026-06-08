/**
 * Implementation of homekit module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of homekit module.
 */
export class HomeKit extends SmartModule {
  static NAME = 'HomeKit';
  static QUERY_GETTER_NAME = 'get_homekit_info';
  static REQUIRED_COMPONENT = 'homekit';

  /**
     * Homekit mfi setup info.
     * @returns {Object} Info
     */
  get info() {
    return this.data;
  }
}

SmartModule.registerModule(HomeKit);
