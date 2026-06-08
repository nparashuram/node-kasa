/**
 * SmartCamModule base class for all detections.
 */

import { Feature } from '../../feature.js';
import { SmartCamModule } from '../smartcammodule.js';

/**
 * SmartCamModule base class for all detections.
 */
export class DetectionModule extends SmartCamModule {
  static DETECTION_FEATURE_ID = '';
  static DETECTION_FEATURE_NAME = '';
  static QUERY_SETTER_NAME = '';
  static QUERY_SET_SECTION_NAME = '';

  /**
     * Return the detection enabled state.
     * @returns {boolean} Enabled
     */
  get enabled() {
    return this.data[this.constructor.QUERY_SECTION_NAMES].enabled === 'on';
  }

  /**
     * Set the detection enabled state.
     * @param {boolean} enable - True to enable
     * @returns {Promise<Object>} Result
     */
  async setEnabled(enable) {
    const params = { 'enabled': enable ? 'on' : 'off' };
    return await this._device._querySetterHelper(
      this.constructor.QUERY_SETTER_NAME,
      this.constructor.QUERY_MODULE_NAME,
      this.constructor.QUERY_SET_SECTION_NAME,
      params
    );
  }
}
