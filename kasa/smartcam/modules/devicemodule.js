/**
 * Implementation of device module for cameras.
 */

import { SmartCamModule } from '../smartcammodule.js';

/**
 * Implementation of device module.
 */
export class DeviceModule extends SmartCamModule {
  static REQUIRED_COMPONENT = 'device';
  static NAME = 'devicemodule';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {
      'getDeviceInfo': { 'device_info': { 'name': ['basic_info', 'info'] } }
    };
  }
}

SmartCamModule.registerModule(DeviceModule);
