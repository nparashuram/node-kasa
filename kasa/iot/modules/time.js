/**
 * Provides the current time and timezone information.
 */

import { IotModule } from '../iotmodule.js';

/**
 * Implements the timezone settings.
 */
export class Time extends IotModule {
  /**
     * Request time and timezone.
     * @returns {Object} Query object
     */
  query() {
    const q = this.queryForCommand('get_time');
    Object.assign(q, this.queryForCommand('get_timezone'));
    return q;
  }

  /**
     * Return current device time.
     * @returns {Date} Device time
     */
  get time() {
    const res = this.data.get_time;
    return new Date(
      res.year,
      res.month - 1,
      res.mday,
      res.hour,
      res.min,
      res.sec
    );
  }

  /**
     * Return current device time.
     * @returns {Promise<Date|null>} Device time or null
     */
  async getTime() {
    try {
      const res = await this.call('get_time');
      return new Date(
        res.year,
        res.month - 1,
        res.mday,
        res.hour,
        res.min,
        res.sec
      );
    } catch (ex) {
      return null;
    }
  }

  /**
     * Set the device time.
     * @param {Date} dt - New date
     * @returns {Promise<Object>} Command result
     */
  async setTime(dt) {
    const params = {
      year: dt.getFullYear(),
      month: dt.getMonth() + 1,
      mday: dt.getDate(),
      hour: dt.getHours(),
      min: dt.getMinutes(),
      sec: dt.getSeconds()
    };
    return await this.call('set_time', params);
  }

  /**
     * Request timezone information from the device.
     * @returns {Promise<Object>} Timezone info
     */
  async getTimezone() {
    return await this.call('get_timezone');
  }
}
