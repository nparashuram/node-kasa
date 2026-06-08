/**
 * Implementation of time module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of device_local_time.
 */
export class Time extends SmartModule {
  static NAME = 'Time';
  static REQUIRED_COMPONENT = 'time';
  static QUERY_GETTER_NAME = 'get_device_time';

  /**
     * Return device's current datetime.
     * @returns {Date} Device time
     */
  get time() {
    const data = this._device._lastUpdate[this.constructor.QUERY_GETTER_NAME];
    if (!data || !data.timestamp) return new Date();
    return new Date(data.timestamp * 1000);
  }

  /**
     * Set device time.
     * @param {Date} dt - New date
     * @returns {Promise<Object>} Command result
     */
  async setTime(dt) {
    const timestamp = Math.floor(dt.getTime() / 1000);
    // Rough estimation of time_diff in minutes
    const timeDiff = -dt.getTimezoneOffset();

    const params = {
      'timestamp': timestamp,
      'time_diff': timeDiff,
    };

    // In node.js we don't have easy access to IANA name from Date object
    // unless using Intl.DateTimeFormat().resolvedOptions().timeZone
    const region = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (region) {
      params.region = region;
    }

    return await this.call('set_device_time', params);
  }
}

SmartModule.registerModule(Time);
