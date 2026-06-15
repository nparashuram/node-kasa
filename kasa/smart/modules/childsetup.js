/**
 * Implementation for child device setup.
 */

import { Feature } from '../../feature.js';
import { ChildSetup as ChildSetupInterface } from '../../interfaces/childsetup.js';
import { SmartModule } from '../smartmodule.js';

/**
 * Implementation for child device setup.
 */
export class ChildSetup extends SmartModule {
  static NAME = 'ChildSetup';
  static REQUIRED_COMPONENT = 'child_quick_setup';
  static QUERY_GETTER_NAME = 'get_support_child_device_category';
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
    this._categories = (this.data.device_category_list || []).map(cat => cat.category);
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
   * @param {number} [options.timeout=10] - Timeout
   * @returns {Promise<Object[]>} Added devices
   */
  async pair({ timeout = 10 } = {}) {
    await this.call('begin_scanning_child_device');
    console.log(`Waiting ${timeout} seconds for discovering new devices`);
    await new Promise(resolve => setTimeout(resolve, timeout * 1000));

    const detected = await this._getDetectedDevices();
    const detectedList = detected.child_device_list || [];

    if (detectedList.length === 0) {
      console.warn('No devices found, make sure to activate pairing mode on the devices to be added.');
      return [];
    }

    console.log(`Discovery done, found ${detectedList.length} devices`);
    return await this._addDevices(detected);
  }

  /**
   * Remove device from the hub.
   * @param {string} deviceId - Device ID
   * @returns {Promise<Object>} Result
   */
  async unpair(deviceId) {
    console.log(`Going to unpair ${deviceId} from ${this}`);
    const payload = { 'child_device_list': [{ 'device_id': deviceId }] };
    const res = await this.call('remove_child_device_list', payload);
    await this._device.update();
    return res;
  }

  /**
   * Add devices based on get_detected_device response.
   * @param {Object} devices - Detected devices
   * @returns {Promise<Object[]>} Added devices
   * @private
   */
  async _addDevices(devices) {
    await this.call('add_child_device_list', devices);
    await this._device.update();

    const successes = [];
    for (const detected of devices.child_device_list || []) {
      const deviceId = detected.device_id;
      if (this._device._children && deviceId in this._device._children) {
        successes.push(detected);
        console.log(`Added child to ${this._device.host}: ${detected.device_model} - ${deviceId} - added`);
      } else {
        console.log(`Added child to ${this._device.host}: ${detected.device_model} - ${deviceId} - not added`);
      }
    }
    return successes;
  }

  /**
   * Return list of devices detected during scanning.
   * @returns {Promise<Object>} Detected devices
   * @private
   */
  async _getDetectedDevices() {
    const param = { 'scan_list': this.data.device_category_list };
    const res = await this.call('get_scan_child_device_list', param);
    return res;
  }
}

SmartModule.registerModule(ChildSetup);
