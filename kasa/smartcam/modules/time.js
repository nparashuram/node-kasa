/**
 * Implementation of time module.
 */

import { Feature } from '../../feature.js';
import { Time as TimeInterface } from '../../interfaces/time.js';
import { SmartCamModule } from '../smartcammodule.js';
import { allowUpdateAfter } from '../../smart/smartmodule.js';

/**
 * Implementation of device_local_time.
 */
export class Time extends SmartCamModule {
  static NAME = 'Time';
  static QUERY_GETTER_NAME = 'getTimezone';
  static QUERY_MODULE_NAME = 'system';
  static QUERY_SECTION_NAMES = 'basic';

  constructor(device, module) {
    super(device, module);
    this._timezone = 'UTC';
    this._time = new Date();
  }

  /**
   * Initialize features after the initial update.
   * @protected
   */
  _initializeFeatures() {
    this._addFeature(
      new Feature({
        device: this._device,
        id: 'device_time',
        name: 'Device time',
        attributeGetter: 'time',
        container: this,
        category: Feature.Category.Debug,
        type: Feature.Type.Sensor,
      })
    );
  }

  /**
   * Query to execute during the update cycle.
   * @returns {Object} Query
   */
  query() {
    const q = super.query();
    q.getClockStatus = { [this.constructor.QUERY_MODULE_NAME]: { 'name': 'clock_status' } };
    return q;
  }

  /**
   * @protected
   */
  async _postUpdateHook() {
    const timeData = this.data.getClockStatus.system.clock_status;
    const timezoneData = this.data.getTimezone.system.basic;

    this._timezone = timezoneData.zone_id;
    this._time = new Date(timeData.seconds_from_1970 * 1000);
  }

  /**
   * Return current timezone.
   * @returns {string} Timezone
   */
  get timezone() {
    return this._timezone;
  }

  /**
   * Return device's current datetime.
   * @returns {Date} Time
   */
  get time() {
    return this._time;
  }

  /**
   * Set device time.
   * @param {Date} dt - Date to set
   * @returns {Promise<Object>} Result
   */
  async setTime(dt) {
    const timestamp = Math.floor(dt.getTime() / 1000);
    const lt = dt.toISOString().replace('T', ' ').split('.')[0];
    const params = { 'seconds_from_1970': timestamp, 'local_time': lt };

    // Doesn't seem to update the time, perhaps because timing_mode is ntp
    let res = await this.call('setTimezone', { 'system': { 'clock_status': params } });

    // In node.js we don't have a direct equivalent to ZoneInfo without libraries
    // For now we'll just try to set it if it looks like a string
    if (typeof dt.timezone === 'string') {
      const tzParams = { 'zone_id': dt.timezone };
      res = await this.call('setTimezone', { 'system': { 'basic': tzParams } });
    }
    return res;
  }
}

allowUpdateAfter(Time.prototype, 'setTime', Object.getOwnPropertyDescriptor(Time.prototype, 'setTime'));

SmartCamModule.registerModule(Time);
