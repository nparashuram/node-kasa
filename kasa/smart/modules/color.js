/**
 * Implementation of color module for SMART devices.
 */

import { SmartModule } from '../smartmodule.js';
import { Feature } from '../../feature.js';
import { HSV } from '../../interfaces/light.js';

/**
 * Implementation of color module.
 */
export class Color extends SmartModule {
  static NAME = 'Color';
  static REQUIRED_COMPONENT = 'color';

  /**
   * Initialize features after the initial update.
   */
  _initializeFeatures() {
    this._addFeature(new Feature({
      device: this._device,
      id: 'hsv',
      name: 'HSV',
      container: this,
      attributeGetter: 'hsv',
      attributeSetter: 'setHsv',
      type: Feature.Type.Unknown,
    }));
  }

  /**
   * Query to execute during the update cycle.
   */
  query() {
    // HSV is contained in the main device info response.
    return {};
  }

  /**
   * Return the current HSV state of the bulb.
   */
  get hsv() {
    const h = this.data.hue || 0;
    const s = this.data.saturation || 0;
    const v = this.data.brightness || 0;

    return new HSV(h, s, v);
  }

  /**
   * Set new HSV.
   * @param {number} hue - Hue in degrees
   * @param {number} saturation - Saturation in percentage
   * @param {number|null} value - Value in percentage
   */
  async setHsv(hue, saturation, value = null) {
    if (typeof hue !== 'number' || hue < 0 || hue > 360) {
      throw new Error(`Invalid hue value: ${hue} (valid range: 0-360)`);
    }
    if (typeof saturation !== 'number' || saturation < 0 || saturation > 100) {
      throw new Error(`Invalid saturation value: ${saturation} (valid range: 0-100%)`);
    }
    if (value !== null && (typeof value !== 'number' || value < 0 || value > 100)) {
      throw new Error(`Invalid brightness value: ${value} (valid range: 0-100%)`);
    }

    const requestPayload = {
      'color_temp': 0,
      'hue': hue,
      'saturation': saturation,
    };
    if (value !== null) {
      requestPayload['brightness'] = value;
    }

    return await this.call('set_device_info', requestPayload);
  }
}
