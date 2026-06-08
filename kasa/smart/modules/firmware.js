/**
 * Implementation of firmware module for SMART devices.
 */

import { SmartModule } from '../smartmodule.js';
import { Feature } from '../../feature.js';

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
   * Initialize features.
   */
  _initializeFeatures() {
    const device = this._device;
    if (this.supportedVersion > 1) {
      this._addFeature(new Feature({
        device,
        id: 'auto_update_enabled',
        name: 'Auto update enabled',
        container: this,
        attributeGetter: 'autoUpdateEnabled',
        attributeSetter: 'setAutoUpdateEnabled',
        type: Feature.Type.Switch,
      }));
    }
    this._addFeature(new Feature({
      device,
      id: 'update_available',
      name: 'Update available',
      container: this,
      attributeGetter: 'updateAvailable',
      type: Feature.Type.BinarySensor,
      category: Feature.Category.Info,
    }));
    this._addFeature(new Feature({
      device,
      id: 'current_firmware_version',
      name: 'Current firmware version',
      container: this,
      attributeGetter: 'currentFirmware',
      category: Feature.Category.Debug,
      type: Feature.Type.Sensor,
    }));
    this._addFeature(new Feature({
      device,
      id: 'available_firmware_version',
      name: 'Available firmware version',
      container: this,
      attributeGetter: 'latestFirmware',
      category: Feature.Category.Debug,
      type: Feature.Type.Sensor,
    }));
  }

  /**
   * Query to execute during the update cycle.
   */
  query() {
    if (this.supportedVersion > 1) {
      return { 'get_auto_update_info': null };
    }
    return {};
  }

  /**
   * Return the current firmware version.
   */
  get currentFirmware() {
    return this._device.hwInfo.sw_ver;
  }

  /**
   * Return the latest firmware version.
   */
  get latestFirmware() {
    if (!this._firmwareUpdateInfo) {
      return null;
    }
    return this._firmwareUpdateInfo.fw_ver;
  }

  /**
   * Return True if update is available.
   */
  get updateAvailable() {
    // This requires cloud connection info usually
    if (!this._firmwareUpdateInfo) {
      return null;
    }
    return this._firmwareUpdateInfo.type !== 0;
  }

  /**
   * Return True if autoupdate is enabled.
   */
  get autoUpdateEnabled() {
    return this.data && this.data.enable;
  }

  /**
   * Change autoupdate setting.
   */
  async setAutoUpdateEnabled(enabled) {
    const data = { ...this.data, 'enable': enabled };
    return await this.call('set_auto_update_info', data);
  }
}
