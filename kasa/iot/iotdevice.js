/**
 * Python library supporting TP-Link Smart Home devices.
 *
 * The communication protocol was reverse engineered by Lubomir Stroetmann and
 * Tobias Esser in 'Reverse Engineering the TP-Link HS110':
 * https://www.softscheck.com/en/reverse-engineering-tp-link-hs110/
 *
 * This library reuses codes and concepts of the TP-Link WiFi SmartPlug Client
 * at https://github.com/softScheck/tplink-smartplug, developed by Lubomir
 * Stroetmann which is licensed under the Apache License, Version 2.0.
 *
 * You may obtain a copy of the license at
 * http://www.apache.org/licenses/LICENSE-2.0
 */

import { Device, DeviceInfo, WifiNetwork } from '../device.js';
import { DeviceType } from '../deviceType.js';
import { DeviceConfig } from '../deviceconfig.js';
import { KasaException } from '../exceptions.js';
import { Feature } from '../feature.js';
import { Module } from '../module.js';
import { IotProtocol } from '../protocols/iotprotocol.js';
import { XorTransport } from '../transports/xortransport.js';
import { IotModule, merge } from './iotmodule.js';
import { Emeter } from './modules/emeter.js';

const _LOGGER = console; // Simple logger replacement

/**
 * Decorator to indicate that `update` should be called before accessing this method.
 * @param {Function} target - The target function to decorate
 * @param {string} propertyKey - The property key
 * @param {PropertyDescriptor} descriptor - The property descriptor
 * @returns {PropertyDescriptor} The decorated descriptor
 */
function requiresUpdate(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;
  const originalGetter = descriptor.get;

  if (originalMethod) {
    descriptor.value = async function (...args) {
      if (!this._lastUpdate && (
        this._sysInfo === null || !(propertyKey in this._sysInfo)
      )) {
        throw new KasaException('You need to await update() to access the data');
      }
      return originalMethod.apply(this, args);
    };
  } else if (originalGetter) {
    descriptor.get = function () {
      if (!this._lastUpdate && (
        this._sysInfo === null || !(propertyKey in this._sysInfo)
      )) {
        throw new KasaException('You need to await update() to access the data');
      }
      return originalGetter.apply(this);
    };
  }

  return descriptor;
}

/**
 * Parse features string.
 * @param {string} features - Features string
 * @returns {Set<string>} Set of parsed features
 */
function parseFeatures(features) {
  if (!parseFeatures._cache) {
    parseFeatures._cache = new Map();
  }
  if (!parseFeatures._cache.has(features)) {
    parseFeatures._cache.set(features, new Set(features.split(':')));
  }
  return parseFeatures._cache.get(features);
}

/**
 * Return the system info structure.
 * @param {Object} info - The info object
 * @returns {Object} System info
 */
function extractSysInfo(info) {
  const sysinfoDefault = info?.system?.get_sysinfo || {};
  const sysinfoNest = sysinfoDefault?.system || {};

  if (Object.keys(sysinfoNest).length > Object.keys(sysinfoDefault).length && 
        typeof sysinfoNest === 'object') {
    return sysinfoNest;
  }
  return sysinfoDefault;
}

/**
 * Base class for all supported IoT device types.
 *
 * You don't usually want to initialize this class manually,
 * but either use Discovery class, or use one of the subclasses:
 *
 * * IotPlug
 * * IotBulb
 * * IotStrip
 * * IotDimmer
 * * IotLightStrip
 *
 * To initialize, you have to await update() at least once.
 * This will allow accessing the properties using the exposed properties.
 *
 * All changes to the device are done using awaitable methods,
 * which will not change the cached values, but you must await update() separately.
 *
 * Errors reported by the device are raised as KasaException,
 * and should be handled by the user of the library.
 *
 * @example
 * import { IotDevice } from 'node-kasa';
 * 
 * const dev = new IotDevice("127.0.0.1");
 * await dev.update();
 * 
 * // All devices provide several informational properties:
 * console.log(dev.alias);
 * // Bedroom Lamp Plug
 * console.log(dev.model);
 * // HS110
 * console.log(dev.rssi);
 * // -71
 * console.log(dev.mac);
 * // 50:C7:BF:00:00:00
 * 
 * // Some information can also be changed programmatically:
 * await dev.setAlias("new alias");
 * await dev.update();
 * console.log(dev.alias);
 * // new alias
 * 
 * // All devices can be turned on and off:
 * await dev.turnOff();
 * await dev.turnOn();
 * await dev.update();
 * console.log(dev.isOn);
 * // true
 */
export class IotDevice extends Device {
  /**
     * Create a new IotDevice instance.
     * @param {string} host - Host name or IP address of the device
     * @param {DeviceConfig} [config] - Device configuration
     * @param {BaseProtocol} [protocol] - Protocol for communicating with the device
     */
  constructor(host, { config = null, protocol = null } = {}) {
    super(host, { config, protocol });
        
    this.emeterType = 'emeter';
    this._sysInfo = null;
    this._supportedModules = null;
    this._legacyFeatures = new Set();
    this._children = new Map();
    this._modules = new Map();
    this._onSince = null;
  }

  /**
     * Return list of children.
     * @returns {Array<IotDevice>} List of children
     */
  get children() {
    return Array.from(this._children.values());
  }

  /**
     * Return the device modules.
     * @requiresUpdate
     * @returns {Object} Device modules
     */
  get modules() {
    return this._supportedModules;
  }

  /**
     * Register a module.
     * @param {string} name - Module name
     * @param {IotModule} module - Module instance
     */
  addModule(name, module) {
    if (this._modules.has(name)) {
      return;
    }

    this._modules.set(name, module);
  }

  /**
     * Create a request object.
     * @param {string} target - Target service
     * @param {string} cmd - Command
     * @param {Object} [arg={}] - Arguments
     * @param {Array} [childIds=null] - Child IDs
     * @returns {Object} Request object
     */
  _createRequest(target, cmd, arg = {}, childIds = null) {
    let request = { [target]: { [cmd]: arg } };
    if (childIds !== null) {
      request = { 'context': { 'child_ids': childIds }, [target]: { [cmd]: arg } };
    }
    return request;
  }

  /**
     * Raise an exception if there is no emeter.
     * @private
     */
  _verifyEmeter() {
    if (!this.hasEmeter) {
      throw new KasaException('Device has no emeter');
    }
    if (!(this.emeterType in this._lastUpdate)) {
      throw new KasaException('update() required prior accessing emeter');
    }
  }

  /**
     * Query helper method.
     * @param {string} target - Target service
     * @param {string} cmd - Command
     * @param {Object} [arg={}] - Arguments
     * @param {Array} [childIds=null] - Child IDs
     * @returns {Promise<Object>} Query result
     * @private
     */
  async _queryHelper(target, cmd, arg = {}, childIds = null) {
    const request = this._createRequest(target, cmd, arg, childIds);
    try {
      const response = await this.protocol.query(request);
      return response[target][cmd];
    } catch (ex) {
      // Handle specific IoT protocol error scenarios
      throw ex;
    }
  }

  /**
     * Update the device state.
     * @param {boolean} [updateChildren=true] - Update children devices
     * @returns {Promise<void>}
     */
  async update(updateChildren = true) {
    if (this._supportedModules === null) {
      await this._initializeModules();
    }

    // Queries for state information
    const queries = new Map([
      ['system', { 'get_sysinfo': {} }]
    ]);

    // Add emeter query if supported
    if (this.hasEmeter) {
      queries.set(this.emeterType, { 'get_realtime': {} });
    }

    // Add module queries
    for (const [name, module] of this._modules) {
      if (module.query) {
        const moduleQueries = await module.query();
        for (const [key, value] of Object.entries(moduleQueries)) {
          queries.set(key, value);
        }
      }
    }

    // Execute all queries
    const queryObject = Object.fromEntries(queries);
    const response = await this.protocol.query(queryObject);
    this._lastUpdate = response;

    // Process sys_info
    const sysInfo = extractSysInfo(response);
    this._sysInfo = sysInfo;

    // Update modules
    for (const [name, module] of this._modules) {
      if (module.update) {
        await module.update(response);
      }
    }

    // Update children if requested
    if (updateChildren && this._children.size > 0) {
      for (const child of this.children) {
        await child.update(updateChildren);
      }
    }
  }

  /**
     * Initialize device modules.
     * @private
     */
  async _initializeModules() {
    // Get basic system info first
    const response = await this.protocol.query({
      'system': { 'get_sysinfo': {} }
    });
        
    const sysInfo = extractSysInfo(response);
    this._sysInfo = sysInfo;

    // Initialize modules based on device capabilities
    this._modules.clear();
    this._supportedModules = {};

    // Core modules that most devices have
    if (sysInfo.feature && typeof sysInfo.feature === 'string') {
      const features = parseFeatures(sysInfo.feature);
      this._legacyFeatures = features;
    }

  }

  /**
     * Turn on the device.
     * @returns {Promise<Object>} Command result
     */
  async turnOn() {
    return this._queryHelper('system', 'set_relay_state', { 'state': 1 });
  }

  /**
     * Turn off the device.
     * @returns {Promise<Object>} Command result
     */
  async turnOff() {
    return this._queryHelper('system', 'set_relay_state', { 'state': 0 });
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
     * @requiresUpdate
     * @returns {boolean} Device on state
     */
  get isOn() {
    const relayState = this._sysInfo?.relay_state;
    return relayState === 1;
  }

  /**
     * Set the device alias.
     * @param {string} alias - New alias
     * @returns {Promise<Object>} Command result
     */
  async setAlias(alias) {
    return this._queryHelper('system', 'set_dev_alias', { 'alias': alias });
  }

  /**
     * Return the device alias or nickname.
     * @requiresUpdate
     * @returns {string|null} Device alias
     */
  get alias() {
    return this._sysInfo?.alias || this._sysInfo?.dev_name || null;
  }

  /**
     * Return the device model.
     * @requiresUpdate
     * @returns {string} Device model
     */
  get model() {
    return this._sysInfo?.model || 'Unknown';
  }

  /**
     * Return the device info.
     * @returns {Object} Device info
     */
  get deviceInfo() {
    return IotDevice._getDeviceInfo(this._lastUpdate, this._discoveryInfo);
  }

  /**
     * Get device info from response data.
     * @param {Object} info - Device info
     * @param {Object|null} discoveryInfo - Discovery info
     * @returns {DeviceInfo} Device info object
     * @static
     */
  static _getDeviceInfo(info, discoveryInfo) {
    const sysInfo = extractSysInfo(info);

    // Get model and region info
    let region = null;
    const deviceModel = sysInfo.model;
    const [longName, regionPart] = deviceModel.split('(');
    if (regionPart) {
      region = regionPart.replace(')', '');
    }

    // Get other info
    const deviceFamily = sysInfo.type || sysInfo.mic_type;
    const deviceType = IotDevice._getDeviceTypeFromSysInfo(info);
    const fwVersionFull = sysInfo.sw_ver;
    let firmwareVersion, firmwareBuild;
        
    if (fwVersionFull.includes(' ')) {
      [firmwareVersion, firmwareBuild] = fwVersionFull.split(' ', 2);
    } else {
      firmwareVersion = fwVersionFull;
      firmwareBuild = null;
    }
        
    const auth = Boolean(discoveryInfo && ('mgt_encrypt_schm' in discoveryInfo));

    return new DeviceInfo({
      shortName: longName,
      longName: longName,
      brand: 'kasa',
      deviceFamily: deviceFamily,
      deviceType: deviceType,
      hardwareVersion: sysInfo.hw_ver,
      firmwareVersion: firmwareVersion,
      firmwareBuild: firmwareBuild,
      requiresAuth: auth,
      region: region,
    });
  }

  /**
     * Find Device subclass for device described by passed data.
     * @param {Object} info - System info
     * @returns {DeviceType} Device type
     * @static
     */
  static _getDeviceTypeFromSysInfo(info) {
    if (info?.system?.get_sysinfo?.system) {
      return DeviceType.Camera;
    }

    if (!info?.system?.get_sysinfo) {
      throw new KasaException('No \'system\' or \'get_sysinfo\' in response');
    }

    const sysInfo = extractSysInfo(info);
    const type = sysInfo.type || sysInfo.mic_type;
        
    if (!type) {
      throw new KasaException('Unable to find the device type field!');
    }

    if (sysInfo.dev_name && sysInfo.dev_name.includes('Dimmer')) {
      return DeviceType.Dimmer;
    }

    if (type.toLowerCase().includes('smartplug')) {
      if (sysInfo.children) {
        return DeviceType.Strip;
      }
      const devName = sysInfo.dev_name;
      if (devName && devName.toLowerCase().includes('light')) {
        return DeviceType.WallSwitch;
      }
      return DeviceType.Plug;
    }

    if (type.toLowerCase().includes('smartbulb')) {
      if (sysInfo.length) { // strips have length
        return DeviceType.LightStrip;
      }
      return DeviceType.Bulb;
    }

    return DeviceType.Plug;
  }

  /**
     * Return the system info.
     * @requiresUpdate
     * @returns {Object} System info
     */
  get sysInfo() {
    return this._sysInfo;
  }

  /**
     * Return hardware info for the device.
     * @requiresUpdate
     * @returns {Object} Hardware info
     */
  get hwInfo() {
    return {
      sw_ver: this._sysInfo.sw_ver,
      hw_ver: this._sysInfo.hw_ver,
      mac: this._sysInfo.mac,
      type: this._sysInfo.type,
      hwId: this._sysInfo.hwId,
      fwId: this._sysInfo.fwId,
      oemId: this._sysInfo.oemId,
      dev_name: this._sysInfo.dev_name
    };
  }

  /**
     * Return the device location.
     * @requiresUpdate
     * @returns {Object} Device location
     */
  get location() {
    return {
      latitude: this._sysInfo.latitude,
      longitude: this._sysInfo.longitude
    };
  }

  /**
     * Return the rssi.
     * @requiresUpdate
     * @returns {number|null} RSSI value
     */
  get rssi() {
    return this._sysInfo?.rssi || null;
  }

  /**
     * Return the mac formatted with colons.
     * @requiresUpdate
     * @returns {string} MAC address
     */
  get mac() {
    const mac = this._sysInfo?.mac || this._sysInfo?.ethernet_mac;
    if (!mac) return null;
        
    // Ensure MAC is formatted with colons
    if (!mac.includes(':') && mac.length === 12) {
      return mac.match(/.{2}/g).join(':');
    }
    return mac;
  }

  /**
     * Return the device id.
     * @requiresUpdate
     * @returns {string} Device ID
     */
  get deviceId() {
    return this._sysInfo?.deviceId || this.mac;
  }

  /**
     * Return all the internal state data.
     * @returns {Object} Internal state
     */
  get internalState() {
    return this._lastUpdate || this._discoveryInfo;
  }

  /**
     * Return the time.
     * @requiresUpdate
     * @returns {Date} Current device time
     */
  get time() {
    return new Date();
  }

  /**
     * Return the timezone.
     * @requiresUpdate
     * @returns {string} Timezone
     */
  get timezone() {
    return 'UTC';
  }

  /**
     * Return if the device has emeter.
     * @returns {boolean} Has emeter
     */
  get hasEmeter() {
    return this._legacyFeatures.has('ENE') || 
               this._sysInfo?.feature?.includes('ENE') || false;
  }

  /**
     * Return the time that the device was turned on or null if turned off.
     * @requiresUpdate
     * @returns {Date|null} On since time
     */
  get onSince() {
    if (!this.isOn) {
      return null;
    }
        
    const onTime = this._sysInfo?.on_time;
    if (onTime) {
      return new Date(Date.now() - (onTime * 1000));
    }
        
    return this._onSince;
  }

  /**
     * Scan for available wifi networks.
     * @returns {Promise<Array<WifiNetwork>>} Available networks
     */
  async wifiScan() {
    const response = await this._queryHelper('netif', 'get_scaninfo', {
      'refresh': 1
    });
        
    return response.ap_list.map(ap => new WifiNetwork({
      ssid: ap.ssid,
      keyType: ap.key_type,
      cipherType: null,
      bssid: null,
      channel: null,
      rssi: ap.rssi,
      signalLevel: null
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
    return this._queryHelper('netif', 'set_stainfo', {
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
    await this._queryHelper('system', 'reboot', { 'delay': delay });
  }

  /**
     * Reset device back to factory settings.
     * @returns {Promise<void>}
     */
  async factoryReset() {
    await this._queryHelper('system', 'reset', { 'delay': 1 });
  }

  /**
     * Update state from info from the discover call.
     * @param {Object} info - Discovery info
     */
  updateFromDiscoverInfo(info) {
    this._discoveryInfo = info;
    if (info.system?.get_sysinfo) {
      this._sysInfo = extractSysInfo(info);
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

  /**
     * Return the maximum response size the device can safely construct.
     * @returns {number} Maximum response size
     * @static
     */
  static get maxResponseSize() {
    return 16 * 1024;
  }
}

export { requiresUpdate, parseFeatures, extractSysInfo };