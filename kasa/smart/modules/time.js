/**
 * Implementation of time module for SMART devices.
 */

import { SmartModule } from '../smartmodule.js';
import { Feature } from '../../feature.js';
import { Time as TimeInterface } from '../../interfaces/time.js';

/**
 * Implementation of device_local_time.
 */
export class Time extends SmartModule {
  static NAME = 'Time';
  static REQUIRED_COMPONENT = 'time';
  static QUERY_GETTER_NAME = 'get_device_time';

  constructor(device, module) {
    super(device, module);
    this._timezone = 'UTC';
  }

  /**
   * Initialize features after the initial update.
   */
  _initializeFeatures() {
    this._addFeature(new Feature({
      device: this._device,
      id: 'device_time',
      name: 'Device time',
      attributeGetter: 'time',
      container: this,
      category: Feature.Category.Debug,
      type: Feature.Type.Sensor,
    }));
  }

  /**
   * Perform actions after a device update.
   */
  async _postUpdateHook() {
    const timeDiff = this.data.time_diff;
    // In JS we'll just store the offset for now as timezone management is complex
    this._timezone = `UTC${timeDiff >= 0 ? '+' : ''}${timeDiff}`;
  }

  /**
   * Return current timezone.
   */
  get timezone() {
    return this._timezone;
  }

  /**
   * Return device's current datetime.
   */
  get time() {
    const timestamp = this.data.timestamp;
    if (timestamp === undefined) return new Date();
    return new Date(timestamp * 1000);
  }

  /**
   * Set device time.
   * @param {Date} date - Date to set
   */
  async setTime(date) {
    const timestamp = Math.floor(date.getTime() / 1000);
    // This is a simplified version of set_time from python-kasa
    const timeDiff = -date.getTimezoneOffset();
    const params = {
      'timestamp': timestamp,
      'time_diff': timeDiff,
    };
    return await this.call('set_device_time', params);
  }

  /**
   * Additional check to see if the module is supported by the device.
   */
  async _checkSupported() {
    if (this._device._isHubChild) {
      return false;
    }
    return true;
  }
}
