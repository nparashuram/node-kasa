/**
 * Implementation of device module for SMART devices.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of device module.
 */
export class DeviceModule extends SmartModule {
  static NAME = 'DeviceModule';
  static REQUIRED_COMPONENT = 'device';

  /**
   * Perform actions after a device update.
   */
  async _postUpdateHook() {
    // Overrides the default behaviour to disable a module if the query returns
    // an error because this module is critical.
  }

  /**
   * Query to execute during the update cycle.
   */
  query() {
    if (this._device._isHubChild) {
      // Child devices get their device info updated by the parent device.
      return {};
    }
    const query = {
      'get_device_info': null,
    };
    // Device usage is not available on older firmware versions
    // or child devices of hubs
    if (this.supportedVersion >= 2) {
      query['get_device_usage'] = null;
    }

    return query;
  }
}
