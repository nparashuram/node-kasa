/**
 * Light preset module for IoT devices.
 */

import { IotModule } from '../iotmodule.js';
import { Module } from '../../module.js';

/**
 * Class for setting light presets.
 */
export class LightPreset extends IotModule {
  /**
     * Return built-in presets list.
     * @returns {Array<string>} Preset names
     */
  get presetList() {
    const preferredState = this.data.preferred_state || [];
    return preferredState
      .filter(p => p.id === undefined)
      .map((_, index) => `Light preset ${index + 1}`);
  }

  /**
     * Set a light preset for the device.
     * @param {string} presetName - Name of the preset
     * @returns {Promise<Object>} Result
     */
  async setPreset(presetName) {
    const match = presetName.match(/Light preset (\d+)/);
    if (!match) throw new Error(`Invalid preset name: ${presetName}`);

    const index = parseInt(match[1]) - 1;
    const presets = this.data.preferred_state.filter(p => p.id === undefined);
    if (index < 0 || index >= presets.length) throw new Error('Preset index out of range');

    const light = this._device.modules[Module.Light];
    return await light.setState(presets[index]);
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}
