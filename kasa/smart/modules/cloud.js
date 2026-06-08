/**
 * Implementation of cloud module for SMART devices.
 */

import { SmartModule } from '../smartmodule.js';
import { Feature } from '../../feature.js';

/**
 * Implementation of cloud module.
 */
export class Cloud extends SmartModule {
  static NAME = 'Cloud';
  static QUERY_GETTER_NAME = 'get_connect_cloud_state';
  static REQUIRED_COMPONENT = 'cloud_connect';
  static MINIMUM_UPDATE_INTERVAL_SECS = 60;

  /**
   * Initialize features after the initial update.
   */
  _initializeFeatures() {
    this._addFeature(new Feature({
      device: this._device,
      id: 'cloud_connection',
      name: 'Cloud connection',
      container: this,
      attributeGetter: 'isConnected',
      icon: 'mdi:cloud',
      type: Feature.Type.BinarySensor,
      category: Feature.Category.Info,
    }));
  }

  /**
   * Return True if device is connected to the cloud.
   */
  get isConnected() {
    if (this._hasDataError()) {
      return false;
    }
    return this.data.status === 0;
  }
}
