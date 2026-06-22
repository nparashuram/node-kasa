/**
 * Implementation of report module.
 */

import { Feature } from '../../feature.js';
import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of report module.
 */
export class ReportMode extends SmartModule {
  static NAME = 'ReportMode';
  static REQUIRED_COMPONENT = 'report_mode';
  static QUERY_GETTER_NAME = 'get_report_mode';

  /**
   * Initialize features after the initial update.
   */
  _initializeFeatures() {
    const device = this._device;
    this._addFeature(new Feature({
      device: device,
      id: 'report_interval',
      name: 'Report interval',
      container: this,
      attributeGetter: 'reportInterval',
      unitGetter: () => 's',
      category: Feature.Category.Debug,
      type: Feature.Type.Sensor,
    }));
  }

  /**
   * Query to execute during the update cycle.
   * @returns {Object} Query object
   */
  query() {
    return {};
  }

  /**
   * Reporting interval of a sensor device.
   * @returns {number} Report interval in seconds
   */
  get reportInterval() {
    return this._device.sysInfo.report_interval;
  }
}

SmartModule.registerModule(ReportMode);
