/**
 * Implementation of HomeKit module for IOT devices.
 */

import { Feature } from '../../feature.js';
import { IotModule } from '../iotmodule.js';

/**
 * Implementation of HomeKit module for IOT devices.
 */
export class HomeKit extends IotModule {
  /**
   * Request HomeKit setup info.
   * @returns {Object} Query object
   */
  query() {
    return { 'smartlife.iot.homekit': { 'setup_info_get': {} } };
  }

  /**
   * Return the HomeKit setup info.
   * @returns {Object} HomeKit setup info
   */
  get info() {
    // Only return info if the module has data
    if (!(this._module in this._device._lastUpdate)) {
      return {};
    }
    return this.data.setup_info_get || {};
  }

  /**
   * Return the HomeKit setup code.
   * @returns {string} Setup code
   */
  get setupCode() {
    return this.info.setup_code;
  }

  /**
   * Return the HomeKit setup payload.
   * @returns {string} Setup payload
   */
  get setupPayload() {
    return this.info.setup_payload;
  }

  /**
   * Initialize features after the initial update.
   * @protected
   */
  _initializeFeatures() {
    // Only add features if the device supports the module
    const data = this._device._lastUpdate[this._module] || {};
    if (!data || !('setup_info_get' in data)) {
      return;
    }
    this._addFeature(
      new Feature({
        device: this._device,
        container: this,
        id: 'homekit_setup_code',
        name: 'HomeKit setup code',
        attributeGetter: 'setupCode',
        type: Feature.Type.Sensor,
        category: Feature.Category.Debug,
      })
    );
  }
}
