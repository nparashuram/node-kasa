/**
 * Implementation of brightness module for SMART devices.
 */

import { SmartModule } from '../smartmodule.js';
import { Feature } from '../../feature.js';
import { Module } from '../../module.js';

const BRIGHTNESS_MIN = 0;
const BRIGHTNESS_MAX = 100;

/**
 * Implementation of brightness module.
 */
export class Brightness extends SmartModule {
  static NAME = 'Brightness';
  static REQUIRED_COMPONENT = 'brightness';

  /**
   * Initialize features.
   */
  _initializeFeatures() {
    this._addFeature(new Feature({
      device: this._device,
      id: 'brightness',
      name: 'Brightness',
      container: this,
      attributeGetter: 'brightness',
      attributeSetter: 'setBrightness',
      rangeGetter: () => [BRIGHTNESS_MIN, BRIGHTNESS_MAX],
      type: Feature.Type.Number,
      category: Feature.Category.Primary,
    }));
  }

  /**
   * Query to execute during the update cycle.
   */
  query() {
    // Brightness is contained in the main device info response.
    return {};
  }

  /**
   * Return current brightness.
   */
  get brightness() {
    // If the device supports effects and one is active, use its brightness
    const lightEffect = this._device.modules.get('LightEffect');
    if (lightEffect && lightEffect.isActive) {
      return lightEffect.brightness;
    }

    return this.data.brightness;
  }

  /**
   * Set the brightness.
   * @param {number} brightness - Brightness in percentage
   */
  async setBrightness(brightness) {
    if (typeof brightness !== 'number' || brightness < BRIGHTNESS_MIN || brightness > BRIGHTNESS_MAX) {
      throw new Error(`Invalid brightness value: ${brightness} (valid range: ${BRIGHTNESS_MIN}-${BRIGHTNESS_MAX}%)`);
    }

    if (brightness === 0) {
      return await this._device.turnOff();
    }

    // If the device supports effects and one is active, we adjust its brightness
    const lightEffect = this._device.modules.get('LightEffect');
    if (lightEffect && lightEffect.isActive) {
      return await lightEffect.setBrightness(brightness);
    }

    return await this.call('set_device_info', { 'brightness': brightness });
  }

  /**
   * Additional check to see if the module is supported by the device.
   */
  async _checkSupported() {
    return this.data.brightness !== undefined;
  }
}
