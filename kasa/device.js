/**
 * Interact with TPLink Smart Home devices.
 *
 * Once you have a device via Discovery or Connect you can start interacting with a device.
 *
 * @example
 * import { Discover } from 'node-kasa';
 * 
 * const dev = await Discover.discoverSingle(
 *   "127.0.0.2",
 *   { username: "user@example.com", password: "great_password" }
 * );
 * 
 * // Most devices can be turned on and off
 * await dev.turnOn();
 * await dev.update();
 * console.log(dev.isOn);
 * // true
 * 
 * await dev.turnOff(); 
 * await dev.update();
 * console.log(dev.isOn);
 * // false
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
 * // Devices support different functionality that are exposed via
 * // modules that you can access via dev.modules:
 * for (const moduleName of Object.keys(dev.modules)) {
 *   console.log(moduleName);
 * }
 * // Energy
 * // schedule
 * // usage
 * // anti_theft
 * // Time
 * // cloud
 * // Led
 * 
 * const ledModule = dev.modules["Led"];
 * console.log(ledModule.led);
 * // false
 * await ledModule.setLed(true);
 * await dev.update();
 * console.log(ledModule.led);
 * // true
 * 
 * // Individual pieces of functionality are also exposed via features
 * // which you can access via dev.features and will only be present if
 * // they are supported.
 */

import { Credentials as _Credentials } from './credentials.js';
import { DeviceType } from './deviceType.js';
import {
  DeviceConfig,
  DeviceConnectionParameters, 
  DeviceEncryptionType,
  DeviceFamily
} from './deviceconfig.js';
import { KasaException } from './exceptions.js';
import { Feature } from './feature.js';
import { Module } from './module.js';

/**
 * Wifi network container.
 */
export class WifiNetwork {
  constructor({
    ssid,
    keyType,
    cipherType = null,
    bssid = null,
    channel = null,
    rssi = null,
    signalLevel = null
  }) {
    this.ssid = ssid;
    this.keyType = keyType;
    this.cipherType = cipherType;
    this.bssid = bssid;
    this.channel = channel;
    this.rssi = rssi;
    this.signalLevel = signalLevel;
  }
}

/**
 * Device Model Information.
 */
export class DeviceInfo {
  constructor({
    shortName,
    longName,
    brand,
    deviceFamily,
    deviceType,
    hardwareVersion,
    firmwareVersion,
    firmwareBuild = null,
    requiresAuth,
    region = null
  }) {
    this.shortName = shortName;
    this.longName = longName;
    this.brand = brand;
    this.deviceFamily = deviceFamily;
    this.deviceType = deviceType;
    this.hardwareVersion = hardwareVersion;
    this.firmwareVersion = firmwareVersion;
    this.firmwareBuild = firmwareBuild;
    this.requiresAuth = requiresAuth;
    this.region = region;
  }
}

/**
 * Common device interface.
 *
 * Do not instantiate this class directly, instead get a device instance from
 * Device.connect(), Discover.discover() or Discover.discoverSingle().
 */
export class Device {
  static Type = DeviceType;
  static Credentials = _Credentials;
  static Config = DeviceConfig;
  static Family = DeviceFamily;
  static EncryptionType = DeviceEncryptionType;
  static ConnectionParameters = DeviceConnectionParameters;

  /**
   * Create a new Device instance.
   *
   * @param {string} host - host name or IP address of the device
   * @param {Object} options - Configuration options
   * @param {DeviceConfig} [options.config] - device configuration
   * @param {BaseProtocol} [options.protocol] - protocol for communicating with the device
   */
  constructor(host, { config = null, protocol = null } = {}) {
    if (config && protocol) {
      protocol._transport._config = config;
    }

    this.protocol = protocol || {
      query: async () => ({}),
      close: async () => {},
      config: config || new DeviceConfig({ host })
    };

    this._lastUpdate = {};
    this._deviceType = DeviceType.Unknown;
    this._discoveryInfo = null;
    this._features = {};
    this._parent = null;
    this._children = {};
  }

  /**
   * Connect to a single device by the given hostname or device configuration.
   *
   * This method avoids the UDP based discovery process and
   * will connect directly to the device.
   *
   * It is generally preferred to avoid discoverSingle() and
   * use this function instead as it should perform better when
   * the WiFi network is congested or the device is not responding
   * to discovery requests.
   *
   * @param {Object} options - Connection options
   * @param {string} [options.host] - Hostname of device to query
   * @param {DeviceConfig} [options.config] - Connection parameters to ensure the correct protocol
   * @returns {Promise<Device>} Object for querying/controlling found device
   */
  static async connect({ host: _host = null, config: _config = null } = {}) {
    throw new Error('Device.connect not implemented yet - use Discover.discoverSingle instead');
  }

  /**
   * Update the device.
   * @abstract
   * @param {boolean} [updateChildren=true] - Whether to update child devices
   * @returns {Promise<void>}
   */
  async update(_updateChildren = true) {
    throw new Error('Abstract method \'update\' must be implemented by subclass');
  }

  /**
   * Disconnect and close any underlying connection resources.
   * @returns {Promise<void>}
   */
  async disconnect() {
    await this.protocol.close();
  }

  /**
   * Return the device modules.
   * @abstract  
   * @returns {Object} Module mapping
   */
  get modules() {
    throw new Error('Abstract property \'modules\' must be implemented by subclass');
  }

  /**
   * Return true if the device is on.
   * @abstract
   * @returns {boolean}
   */
  get isOn() {
    throw new Error('Abstract property \'isOn\' must be implemented by subclass');
  }

  /**
   * Return True if device is off.
   * @returns {boolean}
   */
  get isOff() {
    return !this.isOn;
  }

  /**
   * Turn on the device.
   * @abstract
   * @param {...*} kwargs - Additional arguments
   * @returns {Promise<Object>} Command result
   */
  async turnOn(..._kwargs) {
    throw new Error('Abstract method \'turnOn\' must be implemented by subclass');
  }

  /**
   * Turn off the device.
   * @abstract  
   * @param {...*} kwargs - Additional arguments
   * @returns {Promise<Object>} Command result
   */
  async turnOff(..._kwargs) {
    throw new Error('Abstract method \'turnOff\' must be implemented by subclass');
  }

  /**
   * Set the device state to on.
   *
   * This allows turning the device on and off.
   * See also turnOff and turnOn.
   * @abstract
   * @param {boolean} on - Whether device should be on
   * @returns {Promise<Object>} Command result
   */
  async setState(_on) {
    throw new Error('Abstract method \'setState\' must be implemented by subclass');
  }

  /**
   * @returns {string} Host address
   */
  get host() {
    return this.protocol._transport?._host || this.protocol.config?.host || 'unknown';
  }

  /**
   * Set the device host.
   *
   * Generally used by discovery to set the hostname after ip discovery.
   * @param {string} value - New host value
   */
  set host(value) {
    if (this.protocol._transport) {
      this.protocol._transport._host = value;
      this.protocol._transport._config.host = value;
    }
  }

  /**
   * @returns {number} Port number
   */
  get port() {
    return this.protocol._transport?._port || 80;
  }

  /**
   * @returns {Credentials|null} Device credentials
   */
  get credentials() {
    return this.protocol._transport?._credentials || null;
  }

  /**
   * The protocol specific hash of the credentials the device is using.
   * @returns {string|null} Credentials hash
   */
  get credentialsHash() {
    return this.protocol._transport?.credentials_hash || null;
  }

  /**
   * @returns {DeviceType} Device type
   */
  get deviceType() {
    return this._deviceType;
  }

  /**
   * Update state from info from the discover call.
   * @abstract
   * @param {Object} info - Discovery info
   */
  updateFromDiscoverInfo(_info) {
    throw new Error('Abstract method \'updateFromDiscoverInfo\' must be implemented by subclass');
  }

  /**
   * @returns {DeviceConfig} Device configuration
   */
  get config() {
    return this.protocol.config;
  }

  /**
   * @abstract
   * @returns {string} Device model
   */
  get model() {
    throw new Error('Abstract property \'model\' must be implemented by subclass');
  }

  /**
   * @returns {string|null} Device region
   */
  get region() {
    return this.deviceInfo.region;
  }

  /**
   * Return device info.
   * @returns {DeviceInfo} Device information
   */
  get deviceInfo() {
    return this.constructor._getDeviceInfo(this._lastUpdate, this._discoveryInfo);
  }

  /**
   * Get device info.
   * @abstract
   * @param {Object} info - Update info
   * @param {Object|null} discoveryInfo - Discovery info
   * @returns {DeviceInfo} Device info
   */
  static _getDeviceInfo(_info, _discoveryInfo) {
    throw new Error('Abstract method \'_getDeviceInfo\' must be implemented by subclass');
  }

  /**
   * Returns the device alias or nickname.
   * @abstract
   * @returns {string|null} Device alias
   */
  get alias() {
    throw new Error('Abstract property \'alias\' must be implemented by subclass');
  }

  /**
   * Send a raw query to the device.
   * @param {string|Object} request - Request to send
   * @returns {Promise<Object>} Response data
   */
  async _rawQuery(request) {
    return await this.protocol.query({ request });
  }

  /**
   * Return the parent on child devices.
   * @returns {Device|null} Parent device
   */
  get parent() {
    return this._parent;
  }

  /**
   * Returns the child devices.
   * @returns {Device[]} Array of child devices
   */
  get children() {
    return Object.values(this._children);
  }

  /**
   * Return child device by its device_id or alias.
   * @param {string} nameOrId - Device ID or alias to search for
   * @returns {Device|null} Child device or null
   */
  getChildDevice(nameOrId) {
    if (nameOrId in this._children) {
      return this._children[nameOrId];
    }
    
    const nameLower = nameOrId.toLowerCase();
    for (const child of this.children) {
      if (child.alias && child.alias.toLowerCase() === nameLower) {
        return child;
      }
    }
    return null;
  }

  /**
   * Returns the device info.
   * @abstract
   * @returns {Object} System information
   */
  get sysInfo() {
    throw new Error('Abstract property \'sysInfo\' must be implemented by subclass');
  }

  /**
   * Return child device for the given name.
   * @param {string} name - Device name
   * @returns {Device} Child device
   * @throws {KasaException} If no child with the name exists
   */
  getPlugByName(name) {
    for (const p of this.children) {
      if (p.alias === name) {
        return p;
      }
    }
    throw new KasaException(`Device has no child with ${name}`);
  }

  /**
   * Return child device for the given index.
   * @param {number} index - Device index
   * @returns {Device} Child device
   * @throws {KasaException} If index is invalid
   */
  getPlugByIndex(index) {
    if (index + 1 > this.children.length || index < 0) {
      throw new KasaException(
        `Invalid index ${index}, device has ${this.children.length} plugs`
      );
    }
    return this.children[index];
  }

  /**
   * Return the time.
   * @abstract
   * @returns {Date} Device time
   */
  get time() {
    throw new Error('Abstract property \'time\' must be implemented by subclass');
  }

  /**
   * Return the timezone and time_difference.
   * @abstract
   * @returns {Object} Timezone info
   */
  get timezone() {
    throw new Error('Abstract property \'timezone\' must be implemented by subclass');
  }

  /**
   * Return hardware info for the device.
   * @abstract
   * @returns {Object} Hardware information
   */
  get hwInfo() {
    throw new Error('Abstract property \'hwInfo\' must be implemented by subclass');
  }

  /**
   * Return the device location.
   * @abstract
   * @returns {Object} Device location
   */
  get location() {
    throw new Error('Abstract property \'location\' must be implemented by subclass');
  }

  /**
   * Return the rssi.
   * @abstract
   * @returns {number|null} RSSI value
   */
  get rssi() {
    throw new Error('Abstract property \'rssi\' must be implemented by subclass');
  }

  /**
   * Return the mac formatted with colons.
   * @abstract
   * @returns {string} MAC address
   */
  get mac() {
    throw new Error('Abstract property \'mac\' must be implemented by subclass');
  }

  /**
   * Return the device id.
   * @abstract
   * @returns {string} Device ID
   */
  get deviceId() {
    throw new Error('Abstract property \'deviceId\' must be implemented by subclass');
  }

  /**
   * Return all the internal state data.
   * @abstract
   * @returns {Object} Internal state
   */
  get internalState() {
    throw new Error('Abstract property \'internalState\' must be implemented by subclass');
  }

  /**
   * Return available features and their values.
   * @returns {Object} State information
   */
  get stateInformation() {
    const result = {};
    for (const [_id, feat] of Object.entries(this._features)) {
      result[feat.name] = feat.value;
    }
    return result;
  }

  /**
   * Return the list of supported features.
   * @returns {Object<string, Feature>} Features map
   */
  get features() {
    return this._features;
  }

  /**
   * Add a new feature to the device.
   * @param {Feature} feature - Feature to add
   * @throws {KasaException} If feature ID is duplicate
   */
  _addFeature(feature) {
    if (feature.id in this._features) {
      throw new KasaException(`Duplicate feature id ${feature.id}`);
    }
    if (!feature.id) {
      throw new Error('Feature must have an id');
    }
    this._features[feature.id] = feature;
  }

  /**
   * Return if the device has emeter.
   * @abstract
   * @returns {boolean} True if device has emeter
   */
  get hasEmeter() {
    throw new Error('Abstract property \'hasEmeter\' must be implemented by subclass');
  }

  /**
   * Return the time that the device was turned on or null if turned off.
   *
   * This returns a cached value if the device reported value difference is under
   * five seconds to avoid device-caused jitter.
   * @abstract
   * @returns {Date|null} On since time
   */
  get onSince() {
    throw new Error('Abstract property \'onSince\' must be implemented by subclass');
  }

  /**
   * Scan for available wifi networks.
   * @abstract
   * @returns {Promise<WifiNetwork[]>} Available networks
   */
  async wifiScan() {
    throw new Error('Abstract method \'wifiScan\' must be implemented by subclass');
  }

  /**
   * Join the given wifi network.
   * @abstract
   * @param {string} ssid - Network SSID
   * @param {string} password - Network password
   * @param {string} [keytype="wpa2_psk"] - Key type
   * @returns {Promise<Object>} Command result
   */
  async wifiJoin(_ssid, _password, _keytype = 'wpa2_psk') {
    throw new Error('Abstract method \'wifiJoin\' must be implemented by subclass');
  }

  /**
   * Set the device name (alias).
   * @abstract
   * @param {string} alias - New alias
   * @returns {Promise<Object>} Command result
   */
  async setAlias(_alias) {
    throw new Error('Abstract method \'setAlias\' must be implemented by subclass');
  }

  /**
   * Reboot the device.
   *
   * Note that giving a delay of zero causes this to block,
   * as the device reboots immediately without responding to the call.
   * @abstract
   * @param {number} [delay=1] - Delay before reboot in seconds
   * @returns {Promise<void>}
   */
  async reboot(_delay = 1) {
    throw new Error('Abstract method \'reboot\' must be implemented by subclass');
  }

  /**
   * Reset device back to factory settings.
   *
   * Note, this does not downgrade the firmware.
   * @abstract
   * @returns {Promise<void>}
   */
  async factoryReset() {
    throw new Error('Abstract method \'factoryReset\' must be implemented by subclass');
  }

  /**
   * String representation of the device.
   * @returns {string} String representation
   */
  toString() {
    const updateNeeded = !this._lastUpdate ? ' - update() needed' : '';
    if (!this._lastUpdate && !this._discoveryInfo) {
      return `<${this.deviceType} at ${this.host}${updateNeeded}>`;
    }
    return `<${this.deviceType} at ${this.host} - ${this.alias} (${this.model})${updateNeeded}>`;
  }

  // Deprecated device type attributes for backwards compatibility
  static _deprecatedDeviceTypeAttributes = {
    isBulb: [null, DeviceType.Bulb],
    isDimmer: [null, DeviceType.Dimmer], 
    isLightStrip: [null, DeviceType.LightStrip],
    isPlug: [null, DeviceType.Plug],
    isWallswitch: [null, DeviceType.WallSwitch],
    isStrip: [null, DeviceType.Strip],
    isStripSocket: [null, DeviceType.StripSocket]
  };

  /**
   * Get replacing attribute name.
   * @param {string|null} moduleName - Module name to check
   * @param {...string} attrs - Attribute names to check  
   * @returns {string|null} First found attribute
   */
  _getReplacingAttr(moduleName, ...attrs) {
    let check;
    if (!moduleName) {
      check = this;
    } else {
      check = this.modules[moduleName];
      if (!check) {
        return null;
      }
    }

    for (const attr of attrs) {
      if (attr in check || Object.prototype.hasOwnProperty.call(check, attr)) {
        return attr;
      }
    }

    return null;
  }

  /**
   * Get deprecated callable attribute.
   * @param {string} name - Attribute name
   * @returns {*|null} Attribute value or null
   */
  _getDeprecatedCallableAttribute(name) {
    const vals = {
      isDimmable: [
        Module.Light,
        (c) => c.hasFeature('brightness'),
        'light_module.hasFeature("brightness")'
      ],
      isColor: [
        Module.Light,  
        (c) => c.hasFeature('hsv'),
        'light_module.hasFeature("hsv")'
      ],
      isVariableColorTemp: [
        Module.Light,
        (c) => c.hasFeature('color_temp'), 
        'light_module.hasFeature("color_temp")'
      ],
      validTemperatureRange: [
        Module.Light,
        (c) => c._deprecatedValidTemperatureRange(),
        'minimum and maximum value of getFeature("color_temp")'
      ],
      hasEffects: [
        Module.Light,
        (c) => Module.LightEffect in c._device.modules,
        'Module.LightEffect in device.modules'
      ]
    };

    const modCallMsg = vals[name];
    if (modCallMsg) {
      const [mod, call, msg] = modCallMsg;
      
      const module = this.modules[mod];
      if (!module) {
        throw new Error(`Device has no attribute '${name}'`);
      }
      return call(module);
    }

    return null;
  }

  static _deprecatedOtherAttributes = {
    brightness: [Module.Light, ['brightness']],
    setBrightness: [Module.Light, ['setBrightness']], 
    hsv: [Module.Light, ['hsv']],
    setHsv: [Module.Light, ['setHsv']],
    colorTemp: [Module.Light, ['colorTemp']],
    setColorTemp: [Module.Light, ['setColorTemp']],
    _deprecatedSetLightState: [Module.Light, ['hasEffects']],
    led: [Module.Led, ['led']],
    setLed: [Module.Led, ['setLed']],
    effect: [Module.LightEffect, ['_deprecatedEffect', 'effect']],
    effectList: [Module.LightEffect, ['_deprecatedEffectList', 'effectList']],
    setEffect: [Module.LightEffect, ['setEffect']],
    setCustomEffect: [Module.LightEffect, ['setCustomEffect']],
    presets: [Module.LightPreset, ['_deprecatedPresets', 'presetStatesList']],
    savePreset: [Module.LightPreset, ['_deprecatedSavePreset']],
    getEmeterRealtime: [Module.Energy, ['getStatus']],
    emeterRealtime: [Module.Energy, ['status']],
    emeterToday: [Module.Energy, ['consumptionToday']],
    emeterThisMonth: [Module.Energy, ['consumptionThisMonth']],
    currentConsumption: [Module.Energy, ['currentConsumption']],
    getEmeterDaily: [Module.Energy, ['getDailyStats']],
    getEmeterMonthly: [Module.Energy, ['getMonthlyStats']],
    supportedModules: [null, ['modules']]
  };

  static _createProxy(instance) {
    return new Proxy(instance, {
      get(target, prop) {
        if (prop in target || typeof prop === 'symbol') {
          return target[prop];
        }

        const propStr = String(prop);
        
        const depDeviceTypeAttr = Device._deprecatedDeviceTypeAttributes[propStr];
        if (depDeviceTypeAttr) {
          return target.deviceType === depDeviceTypeAttr[1];
        }

        const result = target._getDeprecatedCallableAttribute(propStr);
        if (result !== null) {
          return result;
        }

        const depAttr = Device._deprecatedOtherAttributes[propStr];
        if (depAttr) {
          const replacingAttr = target._getReplacingAttr(depAttr[0], ...depAttr[1]);
          if (replacingAttr !== null) {
            const mod = depAttr[0];
            const devOrMod = mod ? target.modules[mod] : target;
            return devOrMod[replacingAttr];
          }
        }

        throw new Error(`Device has no attribute '${propStr}'`);
      }
    });
  }
}