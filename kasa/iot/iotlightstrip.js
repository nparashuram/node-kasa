/**
 * Module for light strips (KL430).
 */

import { DeviceType } from '../deviceType.js';
import { DeviceConfig } from '../deviceconfig.js';
import { Module } from '../module.js';
import { IotBulb } from './iotbulb.js';
import { requiresUpdate } from './iotdevice.js';
// import { LightEffect } from './modules/lighteffect.js';

/**
 * Representation of a TP-Link Smart light strip.
 *
 * Light strips work similarly to bulbs, but use a different service for controlling,
 * and expose some extra information (such as length and active effect).
 * This class extends IotBulb interface.
 *
 * @example
 * import { IotLightStrip } from 'node-kasa';
 * 
 * const strip = new IotLightStrip("127.0.0.1");
 * await strip.update();
 * console.log(strip.alias);
 * // Bedroom Lightstrip
 * 
 * // Getting the length of the strip:
 * console.log(strip.length);
 * // 16
 * 
 * // Currently active effect:
 * console.log(strip.effect);
 * // { brightness: 100, custom: 0, enable: 0,
 * //   id: 'bCTItKETDFfrKANolgldxfgOakaarARs', name: 'Flicker' }
 * 
 * // Note: The device supports some features that are not currently implemented,
 * // feel free to find out how to control them and create a PR!
 * 
 * // See IotBulb for more examples.
 */
export class IotLightStrip extends IotBulb {
  static LIGHT_SERVICE = 'smartlife.iot.lightStrip';
  static SET_LIGHT_METHOD = 'set_light_state';

  /**
     * Create a new IotLightStrip instance.
     * @param {string} host - Host name or IP address of the device
     * @param {Object} options - Configuration options
     * @param {DeviceConfig} [options.config] - Device configuration
     * @param {BaseProtocol} [options.protocol] - Protocol for communicating with the device
     */
  constructor(host, { config = null, protocol = null } = {}) {
    super(host, { config, protocol });
    this._deviceType = DeviceType.LightStrip;
  }

  /**
     * Initialize modules not added in init.
     * @protected
     */
  async _initializeModules() {
    await super._initializeModules();
        
    // this.addModule(Module.LightEffect, new LightEffect(this, "smartlife.iot.lighting_effect"));
  }

  /**
     * Return length of the strip.
     * @requiresUpdate
     * @returns {number} Strip length
     */
  get length() {
    return this.sysInfo.length;
  }
}