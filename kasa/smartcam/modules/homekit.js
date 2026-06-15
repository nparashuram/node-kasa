/**
 * Implementation of homekit module.
 */

import { SmartCamModule } from '../smartcammodule.js';

/**
 * Implementation of homekit module.
 */
export class HomeKit extends SmartCamModule {
  static NAME = 'HomeKit';
  static REQUIRED_COMPONENT = 'homekit';

  /**
   * Not supported, return empty dict.
   * @returns {Object} Empty info
   */
  get info() {
    return {};
  }
}

SmartCamModule.registerModule(HomeKit);
