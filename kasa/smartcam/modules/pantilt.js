/**
 * Implementation of pan/tilt module.
 */

import { SmartCamModule } from '../smartcammodule.js';

/**
 * Implementation of pan/tilt module for PTZ cameras.
 */
export class PanTilt extends SmartCamModule {
  static REQUIRED_COMPONENT = 'ptz';
  static NAME = 'pantilt';
  static QUERY_GETTER_NAME = 'getPresetConfig';

  /**
     * Pan and tilt camera.
     * @param {number} pan - Pan coordinate
     * @param {number} tilt - Tilt coordinate
     * @returns {Promise<Object>} Result
     */
  async move(pan, tilt) {
    return await this._device._rawQuery({
      'do': { 'motor': { 'move': { 'x_coord': String(pan), 'y_coord': String(tilt) } } }
    });
  }

  /**
     * Pan horizontally.
     * @param {number} pan - Pan value
     * @returns {Promise<Object>} Result
     */
  async pan(pan) {
    return await this.move(pan, 0);
  }

  /**
     * Tilt vertically.
     * @param {number} tilt - Tilt value
     * @returns {Promise<Object>} Result
     */
  async tilt(tilt) {
    return await this.move(0, tilt);
  }

  /**
     * Go to preset.
     * @param {string} presetId - Preset ID
     * @returns {Promise<Object>} Result
     */
  async gotoPreset(presetId) {
    return await this._device._rawQuery({
      'motorMoveToPreset': { 'preset': { 'goto_preset': { 'id': presetId } } }
    });
  }
}

SmartCamModule.registerModule(PanTilt);
