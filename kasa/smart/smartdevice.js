/**
 * Module for a SMART device.
 */

import { Device, DeviceInfo, WifiNetwork } from '../device.js';
import { DeviceType } from '../deviceType.js';
import { DeviceConfig } from '../deviceconfig.js';
import { AuthenticationError, DeviceError, KasaException, SmartErrorCode } from '../exceptions.js';
import { Feature } from '../feature.js';
import { Module } from '../module.js';
import { SmartProtocol } from '../protocols/smartprotocol.js';
import { AesTransport } from '../transports/aestransport.js';
// import { ChildDevice, Cloud, DeviceModule, Firmware, Light, Thermostat, Time } from './modules/index.js';
import { SmartModule } from './smartmodule.js';

const _LOGGER = console; // Simple logger replacement

// List of modules that non hub devices with children, i.e. ks240/P300, report on
// the child but only work on the parent. See longer note below in _initializeModules.
// This list should be updated when creating new modules that could have the
// same issue, homekit perhaps?
const NON_HUB_PARENT_ONLY_MODULES = [
  'DeviceModule', 'Time', 'Firmware', 'Cloud'
];

/**
 * Base class to represent a SMART protocol based device.
 *
 * SMART devices use a different communication protocol than IoT devices,
 * and support more advanced features like proper module support.
 *
 * @example
 * import { SmartDevice } from 'node-kasa';
 * 
 * const device = new SmartDevice("192.168.1.100");
 * await device.update();
 * 
 * console.log(device.alias);
 * console.log(device.model);
 * console.log(device.isOn);
 * 
 * // Turn device on/off
 * await device.turnOn();
 * await device.turnOff();
 */
export class SmartDevice extends Device {
  /**
     * Create a new SmartDevice instance.
     * @param {string} host - Host name or IP address of the device
     * @param {Object} options - Configuration options
     * @param {DeviceConfig} [options.config] - Device configuration
     * @param {BaseProtocol} [options.protocol] - Protocol for communicating with the device
     */
  constructor(host, { config = null, protocol = null } = {}) {
    super(host, { config, protocol });
        
    this._components = {};
    this._componentsRaw = null;
    this._modules = new Map();
    this._children = new Map();
    this._info = {};
    this._lastUpdateTime = null;
    this._onSince = null;
    this._loggedMissingChildIds = new Set();
    this._parent = null;
  }

  /**
     * Parse components from the raw component response.
     * @param {Object} componentsRaw - Raw components response
     * @returns {Object} Parsed components
     * @static
     */
  static _parseComponents(componentsRaw) {
    const components = {};
    for (const comp of componentsRaw.component_list) {
      components[String(comp.id)] = parseInt(comp.ver_code);
    }
    return components;
  }

  /**
     * Perform initialization.
     * We fetch the device info and the available components as early as possible.
     * If the device reports supporting child devices, they are also initialized.
     * @private
     */
  async _negotiate() {
    const initialQuery = {
      'component_nego': null,
      'get_device_info': null,
      'get_connect_cloud_state': null,
    };
        
    const resp = await this.protocol.query(initialQuery);

    // Save the initial state to allow modules access the device info already
    // during the initialization, which is necessary as some information like the
    // supported color temperature range is contained within the response.
    Object.assign(this._lastUpdate, resp);
    this._info = this._tryGetResponse(resp, 'get_device_info');

    // Create our internal presentation of available components
    this._componentsRaw = resp['component_nego'];
    this._components = SmartDevice._parseComponents(this._componentsRaw);

    if ('child_device' in this._components && this.children.length === 0) {
      await this._initializeChildren();
    }
  }

  /**
     * Initialize child devices.
     * @private
     */
  async _initializeChildren() {
    const childQuery = {
      'get_child_device_list': null,
      'get_child_device_component_list': null
    };
        
    const resp = await this.protocol.query(childQuery);
    Object.assign(this._lastUpdate, resp);
        
    await this._createDeleteChildren(
      resp['get_child_device_list'],
      resp['get_child_device_component_list']
    );
  }

  /**
     * Create and delete children. Return True if children changed.
     * @param {Object} childDeviceResp - Child device response
     * @param {Object} childDeviceComponentsResp - Child device components response
     * @returns {Promise<boolean>} True if children changed
     * @private
     */
  async _createDeleteChildren(childDeviceResp, childDeviceComponentsResp) {
    let changed = false;
    const smartChildrenComponents = {};
        
    for (const child of childDeviceComponentsResp.child_component_list) {
      smartChildrenComponents[child.device_id] = child;
    }
        
    const children = this._children;
    const childIds = new Set();
    const existingChildIds = new Set(this._children.keys());

    for (const info of childDeviceResp.child_device_list) {
      const childId = info.device_id;
      const childComponents = smartChildrenComponents[childId];
            
      if (childId && childComponents) {
        childIds.add(childId);

        if (existingChildIds.has(childId)) {
          continue;
        }

        const child = await this._tryCreateChild(info, childComponents);
        if (child) {
          changed = true;
          children.set(childId, child);
          continue;
        }

        if (!this._loggedMissingChildIds.has(childId)) {
          this._loggedMissingChildIds.add(childId);
        }
        continue;
      }

      if (childId) {
        if (!this._loggedMissingChildIds.has(childId)) {
          this._loggedMissingChildIds.add(childId);
        }
        continue;
      }

      if (!this._loggedMissingChildIds.has('')) {
        this._loggedMissingChildIds.add('');
      }
    }

    const removedIds = new Set([...existingChildIds].filter(id => !childIds.has(id)));
    for (const removedId of removedIds) {
      changed = true;
      const removed = children.get(removedId);
      children.delete(removedId);
    }

    return changed;
  }

  /**
     * Try to create a child device.
     * @param {Object} info - Child info
     * @param {Object} childComponents - Child components
     * @returns {Promise<SmartDevice|null>} Child device or null
     * @private
     */
  async _tryCreateChild(info, childComponents) {
    return null;
  }

  /**
     * Return list of children.
     * @returns {Array<SmartDevice>} List of children
     */
  get children() {
    return Array.from(this._children.values());
  }

  /**
     * Return the device modules.
     * @returns {Object} Device modules
     */
  get modules() {
    return Object.fromEntries(this._modules);
  }

  /**
     * Try to get response from responses dict.
     * @param {Object} responses - Responses dictionary
     * @param {string} request - Request name
     * @param {*} [defaultValue=null] - Default value if not found
     * @returns {*} Response value
     * @private
     */
  _tryGetResponse(responses, request, defaultValue = null) {
    let response = responses[request];
        
    if (response instanceof SmartErrorCode) {
      response = null;
    }
        
    if (response !== null) {
      return response;
    }
        
    if (defaultValue !== null) {
      return defaultValue;
    }
        
    throw new KasaException(
      `${request} not found in ${JSON.stringify(responses)} for device ${this.host}`
    );
  }

  /**
     * Update the internal child device info from the parent info.
     * @returns {Promise<boolean>} True if children added or deleted
     * @private
     */
  async _updateChildrenInfo() {
    let changed = false;
    const childInfo = this._tryGetResponse(this._lastUpdate, 'get_child_device_list', {});
        
    if (childInfo && childInfo.child_device_list) {
      changed = await this._createDeleteChildren(
        childInfo,
        this._lastUpdate['get_child_device_component_list']
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
     * Update the internal device info.
     * @param {Object} infoResp - Info response
     * @private
     */
  _updateInternalInfo(infoResp) {
    this._info = this._tryGetResponse(infoResp, 'get_device_info');
  }

  /**
     * Update the device.
     * @param {boolean} [updateChildren=true] - Whether to update children
     * @returns {Promise<void>}
     */
  async update(updateChildren = true) {
    // KLAP devices can authenticate using default credentials, so don't require explicit credentials
    const isKlapTransport = this.protocol._transport &&
                           this.protocol._transport.constructor.name === 'KlapTransportV2';

    if (!isKlapTransport && this.credentials === null && this.credentialsHash === null) {
      throw new AuthenticationError('Smart device requires authentication.');
    }

    const firstUpdate = this._lastUpdateTime === null;
    const now = Date.now();
    this._lastUpdateTime = now;

    if (firstUpdate) {
      await this._negotiate();
      await this._initializeModules();
            
    }

    const resp = await this._modularUpdate(firstUpdate, now);

    const childrenChanged = await this._updateChildrenInfo();
        
    // Call child update which will only update module calls, info is updated
    // from get_child_device_list. update_children only affects hub devices, other
    // devices will always update children to prevent errors on module access.
    if (childrenChanged || updateChildren || this.deviceType !== DeviceType.Hub) {
      for (const child of this._children.values()) {
        await child._update();
      }
    }

    // We can first initialize the features after the first update.
    if (Object.keys(this._features).length === 0) {
      await this._initializeFeatures();
    }

  }

  /**
     * Perform modular update.
     * @param {boolean} firstUpdate - Is this the first update
     * @param {number} now - Current timestamp
     * @returns {Promise<Object>} Update response
     * @private
     */
  async _modularUpdate(firstUpdate, now) {
    const queries = {
      'get_device_info': null
    };
        
    const resp = await this.protocol.query(queries);
    Object.assign(this._lastUpdate, resp);
    this._updateInternalInfo(resp);
        
    return resp;
  }

  /**
     * Initialize device modules.
     * @protected
     */
  async _initializeModules() {
  }

  /**
     * Initialize device features.
     * @protected
     */
  async _initializeFeatures() {
  }

  /**
     * Turn on the device.
     * @param {Object} [kwargs] - Additional parameters
     * @returns {Promise<Object>} Command result
     */
  async turnOn(kwargs = {}) {
    return this._queryHelper('set_device_info', { 'device_on': true });
  }

  /**
     * Turn off the device.
     * @param {Object} [kwargs] - Additional parameters
     * @returns {Promise<Object>} Command result
     */
  async turnOff(kwargs = {}) {
    return this._queryHelper('set_device_info', { 'device_on': false });
  }

  /**
     * Set the device state.
     * @param {boolean} on - True to turn on, false to turn off
     * @returns {Promise<Object>} Command result
     */
  async setState(on) {
    return on ? this.turnOn() : this.turnOff();
  }

  /**
     * Return true if the device is on.
     * @returns {boolean} Device on state
     */
  get isOn() {
    return Boolean(this._info.device_on);
  }

  /**
     * Return the device alias or nickname.
     * @returns {string|null} Device alias
     */
  get alias() {
    const nickname = this._info.nickname;
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
     * Set the device alias.
     * @param {string} alias - New alias
     * @returns {Promise<Object>} Command result
     */
  async setAlias(alias) {
    const encodedAlias = Buffer.from(alias, 'utf8').toString('base64');
    return this._queryHelper('set_device_info', { 'nickname': encodedAlias });
  }

  /**
     * Return the device model.
     * @returns {string} Device model
     */
  get model() {
    return this._info.model || 'Unknown';
  }

  /**
     * Return the device info.
     * @returns {DeviceInfo} Device info
     */
  get deviceInfo() {
    return SmartDevice._getDeviceInfo(this._lastUpdate, this._discoveryInfo);
  }

  /**
     * Get device type from components and device type string.
     * @param {string[]} components - List of component IDs
     * @param {string} deviceTypeStr - Device type string (e.g., "SMART.TAPOPLUG")
     * @returns {string} Device type
     * @static
     */
  static _getDeviceTypeFromComponents(components, deviceTypeStr) {
    if (deviceTypeStr.includes('HUB')) {
      return DeviceType.Hub;
    }
    if (deviceTypeStr.includes('PLUG')) {
      if (components.includes('child_device')) {
        return DeviceType.Strip;
      }
      return DeviceType.Plug;
    }
    if (components.includes('light_strip')) {
      return DeviceType.LightStrip;
    }
    if (deviceTypeStr.includes('SWITCH') && components.includes('child_device')) {
      return DeviceType.WallSwitch;
    }
    if (components.includes('dimmer_calibration')) {
      return DeviceType.Dimmer;
    }
    if (components.includes('brightness')) {
      return DeviceType.Bulb;
    }
    if (deviceTypeStr.includes('SWITCH')) {
      return DeviceType.WallSwitch;
    }
    if (deviceTypeStr.includes('SENSOR')) {
      return DeviceType.Sensor;
    }
    if (deviceTypeStr.includes('ENERGY')) {
      return DeviceType.Thermostat;
    }
    if (deviceTypeStr.includes('ROBOVAC')) {
      return DeviceType.Vacuum;
    }
    if (deviceTypeStr.includes('TAPOCHIME')) {
      return DeviceType.Chime;
    }
    
    // Default fallback
    return DeviceType.Plug;
  }

  /**
     * Get device info from response data.
     * @param {Object} info - Device info
     * @param {Object|null} discoveryInfo - Discovery info
     * @returns {DeviceInfo} Device info object
     * @static
     */
  static _getDeviceInfo(info, discoveryInfo) {
    const deviceInfo = info.get_device_info || {};
    const componentNego = info.component_nego || {};
    const componentList = componentNego.component_list || [];
    const components = componentList.map(comp => comp.id || comp);
    const deviceTypeStr = deviceInfo.type || 'SMART';
    
    // Determine device type from components and type string
    const deviceType = SmartDevice._getDeviceTypeFromComponents(components, deviceTypeStr);
        
    return new DeviceInfo({
      shortName: deviceInfo.model || 'Unknown',
      longName: deviceInfo.model || 'Unknown', 
      brand: 'tapo',
      deviceFamily: deviceTypeStr,
      deviceType: deviceType,
      hardwareVersion: deviceInfo.hw_ver || '1.0',
      firmwareVersion: deviceInfo.fw_ver || '1.0.0',
      firmwareBuild: null,
      requiresAuth: true,
      region: deviceInfo.region || null,
    });
  }

  /**
     * Return the time.
     * @returns {Date} Current device time
     */
  get time() {
    return new Date();
  }

  /**
     * Return the time that the device was turned on or null if turned off.
     * @returns {Date|null} On since time
     */
  get onSince() {
    if (!this._info.device_on || this._info.on_time === null || this._info.on_time === undefined) {
      this._onSince = null;
      return null;
    }

    const onTime = parseFloat(this._info.on_time);
    const onSince = new Date(this.time.getTime() - (onTime * 1000));
        
    if (!this._onSince || Math.abs(onSince.getTime() - this._onSince.getTime()) > 5000) {
      this._onSince = onSince;
    }
        
    return this._onSince;
  }

  /**
     * Return the timezone.
     * @returns {string} Timezone
     */
  get timezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
     * Return hardware info for the device.
     * @returns {Object} Hardware info
     */
  get hwInfo() {
    return {
      sw_ver: this._info.fw_ver,
      hw_ver: this._info.hw_ver,
      mac: this._info.mac,
      type: this._info.type,
      hwId: this._info.device_id,
      dev_name: this.alias,
      oemId: this._info.oem_id,
    };
  }

  /**
     * Return the device location.
     * @returns {Object} Device location
     */
  get location() {
    return {
      latitude: parseFloat(this._info.latitude || 0) / 10000,
      longitude: parseFloat(this._info.longitude || 0) / 10000,
    };
  }

  /**
     * Return the rssi.
     * @returns {number|null} RSSI value
     */
  get rssi() {
    const rssi = this._info.rssi;
    return rssi ? parseInt(rssi) : null;
  }

  /**
     * Return the mac formatted with colons.
     * @returns {string} MAC address
     */
  get mac() {
    return String(this._info.mac || '').replace(/-/g, ':');
  }

  /**
     * Return the device id.
     * @returns {string} Device ID
     */
  get deviceId() {
    return String(this._info.device_id || '');
  }

  /**
     * Return all the internal state data.
     * @returns {Object} Internal state
     */
  get internalState() {
    return this._lastUpdate;
  }

  /**
     * Update the internal info state.
     * @param {Object} info - Info object
     * @private
     */
  _updateInternalState(info) {
    this._info = info;
  }

  /**
     * Query helper method.
     * @param {string} method - Method name
     * @param {Object|null} [params=null] - Parameters
     * @returns {Promise<Object>} Query result
     * @private
     */
  async _queryHelper(method, params = null) {
    return this.protocol.query({ [method]: params });
  }

  /**
     * Return ssid of the connected wifi ap.
     * @returns {string} SSID
     */
  get ssid() {
    return this._info.ssid || '';
  }

  /**
     * Return if the device has emeter.
     * @returns {boolean} Has emeter
     */
  get hasEmeter() {
    return 'energy_monitoring' in this._components;
  }

  /**
     * Return the system info.
     * @returns {Object} System info
     */
  get sysInfo() {
    return this._info;
  }

  /**
     * Scan for available wifi networks.
     * @returns {Promise<Array<WifiNetwork>>} Available networks
     */
  async wifiScan() {
    const response = await this._queryHelper('get_wireless_scan_info');
        
    return (response.ap_list || []).map(ap => new WifiNetwork({
      ssid: ap.ssid,
      keyType: ap.key_type,
      cipherType: null,
      bssid: null,
      channel: null,
      rssi: ap.rssi,
      signalLevel: ap.signal_level
    }));
  }

  /**
     * Join the given wifi network.
     * @param {string} ssid - Network SSID
     * @param {string} password - Network password
     * @param {string} [keytype="wpa2_psk"] - Key type
     * @returns {Promise<Object>} Join result
     */
  async wifiJoin(ssid, password, keytype = 'wpa2_psk') {
    return this._queryHelper('set_wireless', {
      'ssid': ssid,
      'password': password,
      'key_type': keytype
    });
  }

  /**
     * Reboot the device.
     * @param {number} [delay=1] - Delay in seconds
     * @returns {Promise<void>}
     */
  async reboot(delay = 1) {
    await this._queryHelper('device_reboot', { 'delay': delay });
  }

  /**
     * Reset device back to factory settings.
     * @returns {Promise<void>}
     */
  async factoryReset() {
    await this._queryHelper('device_reset');
  }

  /**
     * Update state from info from the discover call.
     * @param {Object} info - Discovery info
     */
  updateFromDiscoverInfo(info) {
    this._discoveryInfo = info;

    // Populate basic device info from discovery data
    if (info) {
      // Map discovery info to internal _info structure
      this._info = {
        ...this._info,
        device_id: info.device_id,
        model: info.device_model ? info.device_model.split('(')[0] : undefined,
        mac: info.mac,
        // For SMART devices, we don't have the nickname in discovery response
        // The device_on state also isn't available from discovery
        type: info.device_type,
        ip: info.ip
      };

      // Set device type for the CLI display
      if (info.device_type) {
        const deviceType = info.device_type.toLowerCase().replace('smart.', '');
        if (deviceType.includes('switch')) {
          this._deviceType = 'wallswitch';
        } else if (deviceType.includes('plug')) {
          this._deviceType = 'plug';
        } else if (deviceType.includes('bulb')) {
          this._deviceType = 'bulb';
        } else if (deviceType.includes('cam')) {
          this._deviceType = 'camera';
        } else {
          this._deviceType = deviceType;
        }
      }
    }
  }

  /**
     * Return string representation of the device.
     * @returns {string} String representation
     */
  toString() {
    const updateNeeded = !this._lastUpdate ? ' - update() needed' : '';
    if (!this._lastUpdate && !this._discoveryInfo) {
      return `<${this.constructor.name} at ${this.host}${updateNeeded}>`;
    }
    return `<${this.constructor.name} at ${this.host} - ${this.alias} (${this.model})${updateNeeded}>`;
  }
}

export { NON_HUB_PARENT_ONLY_MODULES };