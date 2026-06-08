/**
 * Implementation of device module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of device module.
 */
export class DeviceModule extends SmartModule {
  static NAME = 'DeviceModule';
  static REQUIRED_COMPONENT = 'device';

  /**
     * Initialize features.
     * @protected
     */
  _initializeFeatures() {
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
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
    // Note: supportedVersion needs to be defined or accessed
    if (this._device._components && this._device._components.device >= 2) {
      query['get_device_usage'] = null;
    }

    return query;
  }
}

SmartModule.registerModule(DeviceModule);
