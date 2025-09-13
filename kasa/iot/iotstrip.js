/**
 * Module for multi-socket devices (HS300, HS107, KP303, ..).
 */

import { DeviceType } from '../deviceType.js';
import { DeviceConfig } from '../deviceconfig.js';
import { EmeterStatus } from '../emeterstatus.js';
import { KasaException } from '../exceptions.js';
import { Feature } from '../feature.js';
import { Module } from '../module.js';
import { IotDevice, requiresUpdate } from './iotdevice.js';
import { IotModule } from './iotmodule.js';
import { IotPlug } from './iotplug.js';
// import { Antitheft, Cloud, Countdown, Emeter, Led, Schedule, Time, Usage } from './modules/index.js';

const _LOGGER = console; // Simple logger replacement

/**
 * Merge the sum of dictionaries.
 * @param {Array<Object>} dicts - Array of dictionaries to merge
 * @returns {Object} Merged dictionary
 */
function mergeSums(dicts) {
  const totalDict = {};
  for (const sumDict of dicts) {
    for (const [day, value] of Object.entries(sumDict)) {
      totalDict[day] = (totalDict[day] || 0) + value;
    }
  }
  return totalDict;
}

/**
 * Representation of a TP-Link Smart Power Strip.
 *
 * A strip consists of the parent device and its children.
 * All methods of the parent act on all children, while the child devices
 * share the common API with the IotPlug class.
 *
 * To initialize, you have to await update() at least once.
 * This will allow accessing the properties using the exposed properties.
 *
 * All changes to the device are done using awaitable methods,
 * which will not change the cached values,
 * but you must await update() separately.
 *
 * Errors reported by the device are raised as KasaExceptions,
 * and should be handled by the user of the library.
 *
 * @example
 * import { IotStrip } from 'node-kasa';
 * 
 * const strip = new IotStrip("127.0.0.1");
 * await strip.update();
 * console.log(strip.alias);
 * // Bedroom Power Strip
 * 
 * // All methods act on the whole strip:
 * for (const plug of strip.children) {
 *   console.log(`${plug.alias}: ${plug.isOn}`);
 * }
 * // Plug 1: true
 * // Plug 2: false
 * // Plug 3: false
 * 
 * console.log(strip.isOn);
 * // true
 * 
 * await strip.turnOff();
 * await strip.update();
 * 
 * // Accessing individual plugs can be done using the `children` property:
 * console.log(strip.children.length);
 * // 3
 * 
 * for (const plug of strip.children) {
 *   console.log(`${plug.alias}: ${plug.isOn}`);
 * }
 * // Plug 1: false
 * // Plug 2: false  
 * // Plug 3: false
 * 
 * await strip.children[1].turnOn();
 * await strip.update();
 * console.log(strip.isOn);
 * // true
 * 
 * // For more examples, see the Device class.
 */
export class IotStrip extends IotDevice {
  /**
     * Create a new IotStrip instance.
     * @param {string} host - Host name or IP address of the device
     * @param {Object} options - Configuration options
     * @param {DeviceConfig} [options.config] - Device configuration
     * @param {BaseProtocol} [options.protocol] - Protocol for communicating with the device
     */
  constructor(host, { config = null, protocol = null } = {}) {
    super(host, { config, protocol });
    this.emeterType = 'emeter';
    this._deviceType = DeviceType.Strip;
  }

  /**
     * Initialize modules.
     * @protected
     */
  async _initializeModules() {
    // Strip has different modules to plug so do not call super
    // this.addModule(Module.IotAntitheft, new Antitheft(this, "anti_theft"));
    // this.addModule(Module.IotSchedule, new Schedule(this, "schedule"));
    // this.addModule(Module.IotUsage, new Usage(this, "schedule"));
    // this.addModule(Module.Time, new Time(this, "time"));
    // this.addModule(Module.IotCountdown, new Countdown(this, "countdown"));
    // this.addModule(Module.Led, new Led(this, "system"));
    // this.addModule(Module.IotCloud, new Cloud(this, "cnCloud"));
        
    if (this.hasEmeter) {
      // this.addModule(Module.Energy, new StripEmeter(this, this.emeterType));
    }
  }

  /**
     * Return if any of the outlets are on.
     * @requiresUpdate
     * @returns {boolean} Any outlet on
     */
  get isOn() {
    return this.children.some(plug => plug.isOn);
  }

  /**
     * Update some of the attributes.
     * Needed for methods that are decorated with requiresUpdate.
     * @param {boolean} [updateChildren=true] - Update children devices
     * @returns {Promise<void>}
     */
  async update(updateChildren = true) {
    // Super initializes modules and features
    await super.update(updateChildren);

    const initializeChildren = this.children.length === 0;
        
    // Initialize the child devices during the first update.
    if (initializeChildren) {
      const children = this.sysInfo.children;
            
      this._children.clear();
      for (const child of children) {
        const childKey = `${this.mac}_${child.id}`;
        const stripPlug = new IotStripPlug(this.host, { 
          parent: this, 
          childId: child.id 
        });
        this._children.set(childKey, stripPlug);
      }
            
      for (const child of this._children.values()) {
        await child._initializeModules();
      }
    }

    if (updateChildren) {
      for (const plug of this.children) {
        await plug._update();
      }
    }

    if (Object.keys(this.features).length === 0) {
      await this._initializeFeatures();
    }
  }

  /**
     * Initialize common features.
     * @protected
     */
  async _initializeFeatures() {
    // Do not initialize features until children are created
    if (this.children.length === 0) {
      return;
    }
    await super._initializeFeatures();
  }

  /**
     * Turn the strip on.
     * @param {Object} [kwargs] - Additional parameters
     * @returns {Promise<Object>} Command result
     */
  async turnOn(kwargs = {}) {
    for (const plug of this.children) {
      if (plug.isOff) {
        await plug.turnOn();
      }
    }
    return {};
  }

  /**
     * Turn the strip off.
     * @param {Object} [kwargs] - Additional parameters
     * @returns {Promise<Object>} Command result
     */
  async turnOff(kwargs = {}) {
    for (const plug of this.children) {
      if (plug.isOn) {
        await plug.turnOff();
      }
    }
    return {};
  }

  /**
     * Return the maximum on-time of all outlets.
     * @requiresUpdate
     * @returns {Date|null} Maximum on time
     */
  get onSince() {
    if (this.isOff) {
      return null;
    }

    const onTimes = this.children
      .filter(plug => plug.onSince !== null)
      .map(plug => plug.onSince);
        
    if (onTimes.length === 0) {
      return null;
    }

    return new Date(Math.min(...onTimes.map(time => time.getTime())));
  }
}

/**
 * Representation of a single socket on a power strip.
 */
export class IotStripPlug extends IotPlug {
  /**
     * Create a new IotStripPlug instance.
     * @param {string} host - Host name or IP address of the device
     * @param {Object} options - Configuration options
     * @param {IotStrip} options.parent - Parent strip device
     * @param {string} options.childId - Child socket ID
     * @param {DeviceConfig} [options.config] - Device configuration
     * @param {BaseProtocol} [options.protocol] - Protocol for communicating with the device
     */
  constructor(host, { parent, childId, config = null, protocol = null } = {}) {
    super(host, { config, protocol });
    this._parent = parent;
    this.childId = childId;
    this._deviceType = DeviceType.StripSocket;
        
    // Copy protocol from parent
    this.protocol = parent.protocol;
  }

  /**
     * Initialize modules.
     * @protected
     */
  async _initializeModules() {
  }

  /**
     * Update the child socket.
     * @protected
     */
  async _update() {
    // Child sockets get their data from the parent's system info
    const parentSysInfo = this._parent.sysInfo;
    if (parentSysInfo && parentSysInfo.children) {
      const childInfo = parentSysInfo.children.find(child => child.id === this.childId);
      if (childInfo) {
        this._sysInfo = childInfo;
        this._lastUpdate = { system: { get_sysinfo: childInfo } };
      }
    }
  }

  /**
     * Return whether device is on.
     * @requiresUpdate
     * @returns {boolean} Device on state
     */
  get isOn() {
    return Boolean(this._sysInfo?.state);
  }

  /**
     * Turn the socket on.
     * @param {Object} [kwargs] - Additional parameters
     * @returns {Promise<Object>} Command result
     */
  async turnOn(kwargs = {}) {
    return this._parent._queryHelper('system', 'set_relay_state', {
      'state': 1
    }, [this.childId]);
  }

  /**
     * Turn the socket off.
     * @param {Object} [kwargs] - Additional parameters
     * @returns {Promise<Object>} Command result
     */
  async turnOff(kwargs = {}) {
    return this._parent._queryHelper('system', 'set_relay_state', {
      'state': 0
    }, [this.childId]);
  }

  /**
     * Return the device alias.
     * @requiresUpdate
     * @returns {string|null} Device alias
     */
  get alias() {
    return this._sysInfo?.alias || `Plug ${this.childId}`;
  }

  /**
     * Set the device alias.
     * @param {string} alias - New alias
     * @returns {Promise<Object>} Command result
     */
  async setAlias(alias) {
    return this._parent._queryHelper('system', 'set_dev_alias', {
      'alias': alias
    }, [this.childId]);
  }

  /**
     * Return the device model.
     * @returns {string} Device model
     */
  get model() {
    return `${this._parent.model} Socket ${this.childId}`;
  }

  /**
     * Return consumption since reboot in minutes.
     * @requiresUpdate
     * @returns {number} On time in minutes
     */
  get onSince() {
    if (!this.isOn) {
      return null;
    }
        
    const onTime = this._sysInfo?.on_time;
    if (onTime) {
      return new Date(Date.now() - (onTime * 1000));
    }
        
    return null;
  }
}

/**
 * Energy module implementation to aggregate child modules.
 */
export class StripEmeter extends IotModule {
  /**
     * Return True if module supports the feature.
     * @param {string} moduleFeature - Module feature
     * @returns {boolean} Supports feature
     */
  supports(moduleFeature) {
    const supported = new Set([
      'CONSUMPTION_TOTAL',
      'PERIODIC_STATS', 
      'VOLTAGE_CURRENT'
    ]);
    return supported.has(moduleFeature);
  }

  /**
     * Return module query.
     * @returns {Object} Query object
     */
  query() {
    return {
      [this._module]: {
        'get_realtime': {},
        'get_daystat': { 'year': new Date().getFullYear() },
        'get_monthstat': { 'year': new Date().getFullYear() }
      }
    };
  }

}

export { mergeSums };