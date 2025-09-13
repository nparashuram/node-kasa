/**
 * Module for smart plugs (HS100, HS110, ..).
 */

import { DeviceType } from '../deviceType.js';
import { DeviceConfig } from '../deviceconfig.js';
import { Module } from '../module.js';
import { IotDevice, requiresUpdate } from './iotdevice.js';
const _LOGGER = console;

/**
 * Representation of a TP-Link Smart Plug.
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
 * import { IotPlug } from 'node-kasa';
 *
 * const plug = new IotPlug("127.0.0.1");
 * await plug.update();
 * console.log(plug.alias);
 * // Bedroom Lamp Plug
 *
 * // Setting the LED state:
 * await plug.setLed(true);
 * await plug.update();
 * console.log(plug.led);
 * // true
 *
 * // For more examples, see the Device class.
 */
export class IotPlug extends IotDevice {
  /**
     * Create a new IotPlug instance.
     * @param {string} host - Host name or IP address of the device
     * @param {Object} options - Configuration options
     * @param {DeviceConfig} [options.config] - Device configuration
     * @param {BaseProtocol} [options.protocol] - Protocol for communicating with the device
     */
  constructor(host, { config = null, protocol = null } = {}) {
    super(host, { config, protocol });
    this._deviceType = DeviceType.Plug;
  }

  /**
     * Initialize modules.
     * @protected
     */
  async _initializeModules() {
    await super._initializeModules();
        
  }

  /**
     * @requiresUpdate
     * @returns {boolean} Device on state
     */
  get isOn() {
    const sysInfo = this.sysInfo;
    if (!sysInfo) return null;
    return Boolean(sysInfo.relay_state);
  }

  /**
     * @param {Object} [kwargs] - Additional parameters
     * @returns {Promise<Object>} Command result
     */
  async turnOn(kwargs = {}) {
    return this._queryHelper('system', 'set_relay_state', { 'state': 1 });
  }

  /**
     * @param {Object} [kwargs] - Additional parameters  
     * @returns {Promise<Object>} Command result
     */
  async turnOff(kwargs = {}) {
    return this._queryHelper('system', 'set_relay_state', { 'state': 0 });
  }
}

/**
 * Representation of a TP-Link Smart Wall Switch.
 */
export class IotWallSwitch extends IotPlug {
  /**
     * Create a new IotWallSwitch instance.
     * @param {string} host - Host name or IP address of the device
     * @param {Object} options - Configuration options
     * @param {DeviceConfig} [options.config] - Device configuration
     * @param {BaseProtocol} [options.protocol] - Protocol for communicating with the device
     */
  constructor(host, { config = null, protocol = null } = {}) {
    super(host, { config, protocol });
    this._deviceType = DeviceType.WallSwitch;
  }

  /**
     * Initialize modules.
     * @protected
     */
  async _initializeModules() {
    await super._initializeModules();
        
    const devName = this.sysInfo?.dev_name;
    if (devName && devName.includes('PIR')) {
    }
  }
}