/**
 * Module for light effect interface.
 */

import { Feature } from '../feature.js';
import { Module } from '../module.js';

/**
 * Interface to represent a light effect module.
 * @abstract
 */
export class LightEffect extends Module {
  static LIGHT_EFFECTS_OFF = 'Off';
  static LIGHT_EFFECTS_UNNAMED_CUSTOM = 'Custom';

  /**
   * Initialize features.
   */
  _initializeFeatures() {
    const device = this._device;
    this._addFeature(new Feature({
      device: device,
      id: 'light_effect',
      name: 'Light effect',
      container: this,
      attributeGetter: 'effect',
      attributeSetter: 'setEffect',
      category: Feature.Category.Primary,
      type: Feature.Type.Choice,
      choicesGetter: 'effectList',
    }));
  }

  /**
   * Return True if the device supports setting custom effects.
   * @returns {boolean} Support for custom effects
   * @abstract
   */
  get hasCustomEffects() {
    throw new Error('Abstract property \'hasCustomEffects\' must be implemented by subclass');
  }

  /**
   * Return effect name.
   * @returns {string} Current effect
   * @abstract
   */
  get effect() {
    throw new Error('Abstract property \'effect\' must be implemented by subclass');
  }

  /**
   * Return built-in effects list.
   * @returns {string[]} List of effects
   * @abstract
   */
  get effectList() {
    throw new Error('Abstract property \'effectList\' must be implemented by subclass');
  }

  /**
   * Set an effect on the device.
   * @param {string} effect - The effect to set
   * @param {Object} options - Additional options
   * @param {number|null} [options.brightness] - The wanted brightness
   * @param {number|null} [options.transition] - The wanted transition time
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setEffect(effect, { brightness = null, transition = null } = {}) {
    throw new Error('Abstract method \'setEffect\' must be implemented by subclass');
  }

  /**
   * Set a custom effect on the device.
   * @param {Object} effectDict - The custom effect dict to set
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setCustomEffect(effectDict) {
    throw new Error('Abstract method \'setCustomEffect\' must be implemented by subclass');
  }
}
