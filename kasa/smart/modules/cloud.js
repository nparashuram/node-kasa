/**
 * Implementation of cloud module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of cloud module.
 */
export class Cloud extends SmartModule {
  static NAME = 'Cloud';
  static QUERY_GETTER_NAME = 'get_connect_cloud_state';
  static REQUIRED_COMPONENT = 'cloud_connect';
  static MINIMUM_UPDATE_INTERVAL_SECS = 60;

  /**
     * Return True if device is connected to the cloud.
     * @returns {boolean} Is connected
     */
  get isConnected() {
    try {
      const data = this._device._lastUpdate[this.constructor.QUERY_GETTER_NAME];
      return data && data.status === 0;
    } catch (e) {
      return false;
    }
  }
}

SmartModule.registerModule(Cloud);
