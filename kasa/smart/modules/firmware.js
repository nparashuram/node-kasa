/**
 * Implementation of firmware module.
 */

import { SmartModule, allowUpdateAfter } from '../smartmodule.js';

/**
 * Implementation of firmware module.
 */
export class Firmware extends SmartModule {
  static NAME = 'Firmware';
  static REQUIRED_COMPONENT = 'firmware';
  static MINIMUM_UPDATE_INTERVAL_SECS = 60 * 60 * 24;

  constructor(device, module) {
    super(device, module);
    this._firmwareUpdateInfo = null;
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    if (this._device._components && this._device._components.firmware > 1) {
      return { 'get_auto_update_info': null };
    }
    return {};
  }

  /**
     * Check for the latest firmware for the device.
     * @returns {Promise<Object|null>} Update info
     */
  async checkLatestFirmware() {
    try {
      const resp = await this.call('get_latest_fw');
      this._firmwareUpdateInfo = resp;
      return this._firmwareUpdateInfo;
    } catch (error) {
      this._firmwareUpdateInfo = null;
      return null;
    }
  }

  /**
     * Return the current firmware version.
     * @returns {string} Current firmware
     */
  get currentFirmware() {
    return this._device.hwInfo.sw_ver;
  }

  /**
     * Return the latest firmware version.
     * @returns {string|null} Latest firmware
     */
  get latestFirmware() {
    return this._firmwareUpdateInfo ? this._firmwareUpdateInfo.fw_ver : null;
  }

  /**
     * Return True if update is available.
     * @returns {boolean|null} Update available
     */
  get updateAvailable() {
    if (!this._firmwareUpdateInfo) return null;
    return this._firmwareUpdateInfo.need_to_upgrade;
  }

  /**
     * Change autoupdate setting.
     * @param {boolean} enabled - True to enable
     * @returns {Promise<Object>} Command result
     */
  async setAutoUpdateEnabled(enabled) {
    const data = { ...this._device._lastUpdate.get_auto_update_info, 'enable': enabled };
    return await this.call('set_auto_update_info', data);
  }
}

SmartModule.registerModule(Firmware);
