/**
 * Module for SmartCamDevice (smart cameras).
 */

import { DeviceInfo } from '../device.js';
import { DeviceType } from '../deviceType.js';
import { Module } from '../module.js';
import { SmartDevice } from '../smart/smartdevice.js';
import { SmartCamModule } from './smartcammodule.js';

const _LOGGER = console;

/**
 * Class for smart cameras.
 *
 * Smart cameras use the SmartCam protocol which is similar to the Smart protocol
 * but with some differences in the component structure and available features.
 *
 * @example
 * import { SmartCamDevice } from 'node-kasa';
 * 
 * const camera = new SmartCamDevice("192.168.1.100");
 * await camera.update();
 * 
 * console.log(camera.alias);
 * console.log(camera.model);
 * console.log(camera.isOn);
 * 
 * // Camera-specific operations
 * if (camera.modules.Camera) {
 *   // Access camera functionality
 * }
 */
export class SmartCamDevice extends SmartDevice {
  // Modules that are called as part of the init procedure on first update
  static FIRST_UPDATE_MODULES = new Set(['DeviceModule', 'ChildDevice']);

  /**
     * Find type to be displayed as a supported device category.
     * @param {Object} sysinfo - System information
     * @returns {DeviceType} Device type
     * @static
     */
  static _getDeviceTypeFromSysinfo(sysinfo) {
    const deviceType = sysinfo.device_type;
    if (!deviceType) {
      return DeviceType.Unknown;
    }

    if (deviceType.endsWith('HUB')) {
      return DeviceType.Hub;
    }

    if (deviceType.includes('DOORBELL')) {
      return DeviceType.Doorbell;
    }

    return DeviceType.Camera;
  }

  /**
     * Get model information for a device.
     * @param {Object} info - Device info
     * @param {Object|null} discoveryInfo - Discovery info
     * @returns {DeviceInfo} Device info object
     * @static
     */
  static _getDeviceInfo(info, discoveryInfo) {
    const basicInfo = info.getDeviceInfo?.device_info?.basic_info;
    if (!basicInfo) {
      throw new Error('Invalid device info structure');
    }

    const shortName = basicInfo.device_model;
    const longName = discoveryInfo?.device_model || shortName;
    const deviceType = SmartCamDevice._getDeviceTypeFromSysinfo(basicInfo);
    const fwVersionFull = basicInfo.sw_version;
        
    let firmwareVersion, firmwareBuild;
    if (fwVersionFull.includes(' ')) {
      [firmwareVersion, firmwareBuild] = fwVersionFull.split(' ', 2);
    } else {
      firmwareVersion = fwVersionFull;
      firmwareBuild = null;
    }

    return new DeviceInfo({
      shortName: basicInfo.device_model,
      longName: longName,
      brand: 'tapo',
      deviceFamily: basicInfo.device_type,
      deviceType: deviceType,
      hardwareVersion: basicInfo.hw_version,
      firmwareVersion: firmwareVersion,
      firmwareBuild: firmwareBuild,
      requiresAuth: true,
      region: basicInfo.region || null,
    });
  }

  /**
     * Update the internal device info.
     * @param {Object} infoResp - Info response
     * @private
     */
  _updateInternalInfo(infoResp) {
    const info = this._tryGetResponse(infoResp, 'getDeviceInfo');
    this._info = this._mapInfo(info.device_info);
  }

  /**
     * Update the internal info state.
     * This is used by the parent to push updates to its children.
     * @param {Object} info - Info object
     * @private
     */
  _updateInternalState(info) {
    this._info = this._mapInfo(info);
  }

  /**
     * Map device info to internal format.
     * @param {Object} deviceInfo - Device info from response
     * @returns {Object} Mapped info
     * @private
     */
  _mapInfo(deviceInfo) {
    const basicInfo = deviceInfo.basic_info || {};
    return {
      device_id: basicInfo.device_id,
      device_model: basicInfo.device_model,
      device_type: basicInfo.device_type,
      nickname: basicInfo.device_alias, // Camera uses device_alias instead of nickname
      mac: basicInfo.mac,
      hw_ver: basicInfo.hw_version,
      fw_ver: basicInfo.sw_version,
      device_on: basicInfo.device_on !== undefined ? basicInfo.device_on : true,
      on_time: basicInfo.on_time,
      region: basicInfo.region,
      // Add other mappings as needed
      ...basicInfo
    };
  }

  /**
     * Update the internal child device info from the parent info.
     * @returns {Promise<boolean>} True if children added or deleted
     * @private
     */
  async _updateChildrenInfo() {
    let changed = false;
    const childInfo = this._tryGetResponse(this._lastUpdate, 'getChildDeviceList', {});

    if (childInfo && childInfo.child_device_list) {
      changed = await this._createDeleteChildren(
        childInfo,
        this._lastUpdate['getChildDeviceComponentList']
      );

      for (const info of childInfo.child_device_list) {
        const childId = info.device_id;
        if (!this._children.has(childId)) {
          // _createDeleteChildren has already logged a message
          continue;
        }

        this._children.get(childId)._updateInternalState(info);
      }
    }

    return changed;
  }

  /**
     * Initialize a smart child device attached to a smartcam device.
     * @param {Object} info - Child info
     * @param {Object} childComponentsRaw - Child components
     * @returns {Promise<SmartDevice>} Child device
     * @private
     */
  async _initializeSmartChild(info, childComponentsRaw) {
    const childId = info.device_id;
    const childProtocol = null; // _ChildCameraProtocolWrapper(childId, this.protocol);
        
    try {
      const initialResponse = await childProtocol.query({
        'get_connect_cloud_state': null
      });
    } catch (ex) {
      // Error initialising child, skip
    }

    return null;
  }

  /**
     * Initialize a smartcam child device attached to a smartcam device.
     * @param {Object} info - Child info
     * @param {Object} childComponentsRaw - Child components
     * @returns {Promise<SmartDevice>} Child device
     * @private
     */
  async _initializeSmartcamChild(info, childComponentsRaw) {
    const childId = info.device_id;
    const childProtocol = null; // _ChildCameraProtocolWrapper(childId, this.protocol);

    const appComponentList = {
      'app_component_list': childComponentsRaw.component_list
    };

    return null;
  }

  /**
     * Initialize children for hubs.
     * @private
     */
  async _initializeChildren() {
    const childInfoQuery = {
      'getChildDeviceList': { 'childControl': { 'start_index': 0 } },
      'getChildDeviceComponentList': { 'childControl': { 'start_index': 0 } }
    };
        
    const resp = await this.protocol.query(childInfoQuery);
    Object.assign(this.internalState, resp);
  }

  /**
     * Try to create a child device.
     * @param {Object} info - Child info
     * @param {Object} childComponents - Child components
     * @returns {Promise<SmartDevice|null>} Child device or null
     * @private
     */
  async _tryCreateChild(info, childComponents) {
    const category = info.category;
    if (!category) {
      return null;
    }

    // Smart
    // if (category in SmartChildDevice.CHILD_DEVICE_TYPE_MAP) {
    //     return await this._initializeSmartChild(info, childComponents);
    // }

    // Smartcam
    // if (category in SmartCamChild.CHILD_DEVICE_TYPE_MAP) {
    //     return await this._initializeSmartcamChild(info, childComponents);
    // }

    return null;
  }

  /**
     * Initialize modules based on component negotiation response.
     * @protected
     */
  async _initializeModules() {
    for (const [name, modClass] of Object.entries(SmartCamModule.REGISTERED_MODULES)) {
      if (modClass.REQUIRED_COMPONENT && 
                !(modClass.REQUIRED_COMPONENT in this._components)) {
        continue;
      }
            
      const module = new modClass(this, modClass._moduleName());
      if (await module._checkSupported()) {
        this._modules.set(module.name, module);
      }
    }
  }

  /**
     * Initialize device features.
     * @protected
     */
  async _initializeFeatures() {
    for (const module of this._modules.values()) {
      module._initializeFeatures();
      for (const feat of Object.values(module._moduleFeatures || {})) {
        this._addFeature(feat);
      }
    }
  }

  /**
     * Query setter helper for camera-specific operations.
     * @param {string} method - Method name
     * @param {string} module - Module name
     * @param {string} section - Section name
     * @param {Object|null} [params=null] - Parameters
     * @returns {Promise<Object>} Query result
     */
  async _querySetterHelper(method, module, section, params = null) {
    const query = {
      [method]: {
        [module]: {
          [section]: params
        }
      }
    };
        
    return this.protocol.query(query);
  }

  /**
     * Parse components from the raw component response.
     * @param {Object} componentsRaw - Raw components response
     * @returns {Object} Parsed components
     * @static
     */
  static _parseComponents(componentsRaw) {
    const components = {};
    for (const comp of componentsRaw.app_component_list) {
      components[String(comp.name)] = parseInt(comp.version);
    }
    return components;
  }

  /**
     * Return device alias. For cameras this is stored as device_alias.
     * @returns {string|null} Device alias
     */
  get alias() {
    const nickname = this._info.device_alias || this._info.nickname;
    if (nickname) {
      try {
        return Buffer.from(nickname, 'base64').toString('utf8');
      } catch (e) {
        return nickname;
      }
    }
    return null;
  }

  /**
     * Set the device alias. For cameras this is stored as device_alias.
     * @param {string} alias - New alias
     * @returns {Promise<Object>} Command result
     */
  async setAlias(alias) {
    const encodedAlias = Buffer.from(alias, 'utf8').toString('base64');
    return this._queryHelper('setDeviceInfo', {
      'basic_info': { 'device_alias': encodedAlias }
    });
  }
}