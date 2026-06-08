/**
 * Implementation of humidity module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of humidity module.
 */
export class HumiditySensor extends SmartModule {
  static NAME = 'HumiditySensor';
  static REQUIRED_COMPONENT = 'humidity';
  static QUERY_GETTER_NAME = 'get_comfort_humidity_config';

  /**
     * Return current humidity in percentage.
     * @returns {number} Humidity
     */
  get humidity() {
    return this._device.sysInfo.current_humidity;
  }

  /**
     * Return true if humidity is outside of the wanted range.
     * @returns {boolean} Warning status
     */
  get humidityWarning() {
    return this._device.sysInfo.current_humidity_exception !== 0;
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}

SmartModule.registerModule(HumiditySensor);
