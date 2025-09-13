/**
 * Module for base light effect module.
 */

import { Feature } from '../feature.js';
import { Module } from '../module.js';

/**
 * Base interface to represent a LED module.
 * @abstract
 */
export class Led extends Module {
  /**
   * Initialize features.
   */
  _initializeFeatures() {
    const device = this._device;
    this._addFeature(new Feature({
      device: device,
      container: this,
      name: 'LED',
      id: 'led',
      icon: 'mdi:led',
      attributeGetter: 'led',
      attributeSetter: 'setLed',
      type: Feature.Type.Switch,
      category: Feature.Category.Config,
    }));
  }

  /**
   * Return current led status.
   * @returns {boolean} LED status
   * @abstract
   */
  get led() {
    throw new Error('Abstract property \'led\' must be implemented by subclass');
  }

  /**
   * Set led.
   * @param {boolean} enable - Whether to enable LED
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setLed(enable) {
    throw new Error('Abstract method \'setLed\' must be implemented by subclass');
  }
}