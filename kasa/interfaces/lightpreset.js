/**
 * Module for light preset interface.
 */

import { Feature } from '../feature.js';
import { Module } from '../module.js';

/**
 * Base interface for light preset module.
 * @abstract
 */
export class LightPreset extends Module {
  static PRESET_NOT_SET = 'Not set';

  /**
   * Initialize features.
   */
  _initializeFeatures() {
    const device = this._device;
    this._addFeature(new Feature({
      device: device,
      id: 'light_preset',
      name: 'Light preset',
      container: this,
      attributeGetter: 'preset',
      attributeSetter: 'setPreset',
      category: Feature.Category.Config,
      type: Feature.Type.Choice,
      choicesGetter: 'presetList',
    }));
  }

  /**
   * Return list of preset names.
   * @returns {string[]} List of preset names
   * @abstract
   */
  get presetList() {
    throw new Error('Abstract property \'presetList\' must be implemented by subclass');
  }

  /**
   * Return list of preset states.
   * @returns {Object[]} List of preset states
   * @abstract
   */
  get presetStatesList() {
    throw new Error('Abstract property \'presetStatesList\' must be implemented by subclass');
  }

  /**
   * Return current preset name.
   * @returns {string} Current preset name
   * @abstract
   */
  get preset() {
    throw new Error('Abstract property \'preset\' must be implemented by subclass');
  }

  /**
   * Set a light preset for the device.
   * @param {string} presetName - Preset name to set
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setPreset(presetName) {
    throw new Error('Abstract method \'setPreset\' must be implemented by subclass');
  }

  /**
   * Update the preset with presetName with the new presetInfo.
   * @param {string} presetName - Preset name to update
   * @param {Object} presetInfo - New preset state
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async savePreset(presetName, presetInfo) {
    throw new Error('Abstract method \'savePreset\' must be implemented by subclass');
  }

  /**
   * Return True if the device supports updating presets.
   * @returns {boolean} Support for saving presets
   * @abstract
   */
  get hasSavePreset() {
    throw new Error('Abstract property \'hasSavePreset\' must be implemented by subclass');
  }
}
