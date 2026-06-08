/**
 * Implementation of color temperature module for SMART devices.
 */

import { SmartModule } from '../smartmodule.js';
import { Feature } from '../../feature.js';
import { ColorTempRange } from '../../interfaces/light.js';

const DEFAULT_TEMP_RANGE = [2500, 6500];

/**
 * Implementation of color temp module.
 */
export class ColorTemperature extends SmartModule {
  static NAME = 'ColorTemperature';
  static REQUIRED_COMPONENT = 'color_temperature';

  /**
   * Initialize features.
   */
  _initializeFeatures() {
    this._addFeature(new Feature({
      device: this._device,
      id: 'color_temperature',
      name: 'Color temperature',
      container: this,
      attributeGetter: 'colorTemp',
      attributeSetter: 'setColorTemp',
      rangeGetter: 'validTemperatureRange',
      category: Feature.Category.Primary,
      type: Feature.Type.Number,
    }));
  }

  /**
   * Query to execute during the update cycle.
   */
  query() {
    // Color temp is contained in the main device info response.
    return {};
  }

  /**
   * Return valid color-temp range.
   */
  get validTemperatureRange() {
    let ctRange = this.data.color_temp_range;
    if (!ctRange) {
      ctRange = DEFAULT_TEMP_RANGE;
    }
    return new ColorTempRange(ctRange[0], ctRange[1]);
  }

  /**
   * Return current color temperature.
   */
  get colorTemp() {
    return this.data.color_temp;
  }

  /**
   * Set the color temperature.
   * @param {number} temp - Color temperature in Kelvin
   * @param {Object} options - Options
   * @param {number} [options.brightness] - Brightness
   */
  async setColorTemp(temp, { brightness = null } = {}) {
    const range = this.validTemperatureRange;
    if (temp < range.min || temp > range.max) {
      throw new Error(`Temperature should be between ${range.min} and ${range.max}, was ${temp}`);
    }
    const params = { 'color_temp': temp };
    if (brightness !== null) {
      params['brightness'] = brightness;
    }
    return await this.call('set_device_info', params);
  }

  /**
   * Check the color_temp_range has more than one value.
   */
  async _checkSupported() {
    const range = this.validTemperatureRange;
    return range.min !== range.max;
  }
}
