/**
 * Module for child devices.
 */

import { DeviceType } from '../../deviceType.js';
import { SmartCamModule } from '../smartcammodule.js';

/**
 * Implementation for child devices.
 */
export class ChildDevice extends SmartCamModule {
  static REQUIRED_COMPONENT = 'childControl';
  static NAME = 'childdevice';
  static QUERY_GETTER_NAME = 'getChildDeviceList';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    const q = { [this.constructor.QUERY_GETTER_NAME]: { 'childControl': { 'start_index': 0 } } };
    if (this._device.deviceType === DeviceType.Hub) {
      q.getChildDeviceComponentList = { 'childControl': { 'start_index': 0 } };
    }
    return q;
  }
}

SmartCamModule.registerModule(ChildDevice);
