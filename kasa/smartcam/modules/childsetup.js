/**
 * Implementation for child device setup.
 */

import { Feature } from '../../feature.js';
import { ChildSetup as ChildSetupInterface } from '../../interfaces/childsetup.js';
import { SmartCamModule } from '../smartcammodule.js';

/**
 * Implementation for child device setup.
 */
export class ChildSetup extends SmartCamModule {
  static NAME = 'ChildSetup';
  static REQUIRED_COMPONENT = 'childQuickSetup';
  static QUERY_GETTER_NAME = 'getSupportChildDeviceCategory';
  static QUERY_MODULE_NAME = 'childControl';
  static MINIMUM_UPDATE_INTERVAL_SECS = 60 * 60 * 24;

  constructor(device, module) {
    super(device, module);
    this._categories = [];
  }

  /**
   * Initialize features.
   * @protected
   */
  _initializeFeatures() {
    this._addFeature(
      new Feature({
        device: this._device,
        id: 'pair',
        name: 'Pair',
        container: this,
        attributeSetter: 'pair',
        category: Feature.Category.Config,
        type: Feature.Type.Action,
      })
    );
  }

  /**
   * @protected
   */
  async _postUpdateHook() {
    this._categories = (this.data.device_category_list || []).map(cat => cat.category.replace('ipcamera', 'camera'));
  }

  /**
   * Supported child device categories.
   * @returns {string[]} Supported categories
   */
  get supportedCategories() {
    return this._categories;
  }

  /**
   * Scan for new devices and pair them.
   * @param {Object} options - Options
   * @returns {Promise<Object[]>} Added devices
   */
  async pair({ timeout = 10 } = {}) {
    await this.call('startScanChildDevice', { 'childControl': { 'category': this._categories } });
    console.log(`Waiting ${timeout} seconds for discovering new devices`);
    await new Promise(resolve => setTimeout(resolve, timeout * 1000));

    const res = await this.call('getScanChildDeviceList', { 'childControl': { 'category': this._categories } });
    const detectedList = res.getScanChildDeviceList.child_device_list || [];

    if (detectedList.length === 0) {
      console.warn('No devices found, make sure to activate pairing mode on the devices to be added.');
      return [];
    }

    console.log(`Discovery done, found ${detectedList.length} devices`);
    return await this._addDevices(detectedList);
  }

  /**
   * Add devices based on getScanChildDeviceList response.
   * @param {Object[]} detectedList - Detected devices
   * @returns {Promise<Object[]>} Added devices
   * @private
   */
  async _addDevices(detectedList) {
    await this.call('addScanChildDeviceList', { 'childControl': { 'child_device_list': detectedList } });
    await this._device.update();

    const successes = [];
    for (const detected of detectedList) {
      const deviceId = detected.device_id;
      if (this._device._children && deviceId in this._device._children) {
        successes.push(detected);
        console.log(`Adding child to ${this._device.host}: ${detected.device_model} - ${deviceId} - added`);
      } else {
        console.log(`Adding child to ${this._device.host}: ${detected.device_model} - ${deviceId} - not added`);
      }
    }
    return successes;
  }

  /**
   * Remove device from the hub.
   * @param {string} deviceId - Device ID
   * @returns {Promise<Object>} Result
   */
  async unpair(deviceId) {
    console.log(`Going to unpair ${deviceId} from ${this}`);
    const payload = { 'childControl': { 'child_device_list': [{ 'device_id': deviceId }] } };
    const res = await this.call('removeChildDeviceList', payload);
    await this._device.update();
    return res;
  }
}

SmartCamModule.registerModule(ChildSetup);
