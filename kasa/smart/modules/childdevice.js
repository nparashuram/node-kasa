/**
 * Implementation for child devices.
 */

import { DeviceType } from '../../deviceType.js';
import { SmartModule } from '../smartmodule.js';

/**
 * Implementation for child devices.
 */
export class ChildDevice extends SmartModule {
  static NAME = 'ChildDevice';
  static REQUIRED_COMPONENT = 'child_device';
  static QUERY_GETTER_NAME = 'get_child_device_list';

  /**
   * Query to execute during the update cycle.
   * @returns {Object} Query
   */
  query() {
    const q = super.query();
    if (this._device.deviceType === DeviceType.Hub) {
      q['get_child_device_component_list'] = null;
    }
    return q;
  }
}

SmartModule.registerModule(ChildDevice);
