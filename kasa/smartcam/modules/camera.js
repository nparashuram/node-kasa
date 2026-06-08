/**
 * Implementation of camera module.
 */

import { SmartCamModule } from '../smartcammodule.js';
import { Module } from '../../module.js';

/**
 * Implementation of camera module.
 */
export class Camera extends SmartCamModule {
  static REQUIRED_COMPONENT = 'video';
  static NAME = 'camera';

  /**
     * Return the device on state.
     * @returns {boolean} Is on
     */
  get isOn() {
    const lensMask = this._device.modules[Module.LensMask];
    if (lensMask) {
      return !lensMask.enabled;
    }
    return true;
  }

  /**
     * Set the device on state.
     * @param {boolean} on - True to turn on
     * @returns {Promise<Object>} Result
     */
  async setState(on) {
    const lensMask = this._device.modules[Module.LensMask];
    if (lensMask) {
      return await lensMask.setEnabled(!on);
    }
    return {};
  }
}

SmartCamModule.registerModule(Camera);
