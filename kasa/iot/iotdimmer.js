/**
 * Module for dimmers (currently only HS220).
 */

import { DeviceType } from '../deviceType.js';
import { DeviceConfig } from '../deviceconfig.js';
import { Module } from '../module.js';
import { IotPlug } from './iotplug.js';
import { requiresUpdate } from './iotdevice.js';
import { KasaException } from '../exceptions.js';
// import { AmbientLight, Dimmer, Light, Motion } from './modules/index.js';

/**
 * Button action enum.
 */
export const ButtonAction = {
  NoAction: 'none',
  Instant: 'instant_on_off', 
  Gentle: 'gentle_on_off',
  Preset: 'customize_preset'
};

/**
 * Action type enum.
 */
export const ActionType = {
  DoubleClick: 'double_click_action',
  LongPress: 'long_press_action'
};

/**
 * Fade on/off setting enum.
 */
export const FadeType = {
  FadeOn: 'fade_on',
  FadeOff: 'fade_off'
};

/**
 * Representation of a TP-Link Smart Dimmer.
 *
 * Dimmers work similarly to plugs, but provide also support for
 * adjusting the brightness. This class extends IotPlug interface.
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
 * import { IotDimmer } from 'node-kasa';
 * 
 * const dimmer = new IotDimmer("192.168.1.105");
 * await dimmer.turnOn();
 * console.log(dimmer.brightness);
 * // 25
 * 
 * await dimmer.setBrightness(50);
 * await dimmer.update();
 * console.log(dimmer.brightness);
 * // 50
 * 
 * // Refer to IotPlug for the full API.
 */
export class IotDimmer extends IotPlug {
  static DIMMER_SERVICE = 'smartlife.iot.dimmer';

  /**
     * Create a new IotDimmer instance.
     * @param {string} host - Host name or IP address of the device
     * @param {Object} options - Configuration options
     * @param {DeviceConfig} [options.config] - Device configuration
     * @param {BaseProtocol} [options.protocol] - Protocol for communicating with the device
     */
  constructor(host, { config = null, protocol = null } = {}) {
    super(host, { config, protocol });
    this._deviceType = DeviceType.Dimmer;
  }

  /**
     * Initialize modules.
     * @protected
     */
  async _initializeModules() {
    await super._initializeModules();
        
    // this.addModule(Module.IotMotion, new Motion(this, "smartlife.iot.PIR"));
    // this.addModule(Module.IotAmbientLight, new AmbientLight(this, "smartlife.iot.LAS"));
    // this.addModule(Module.IotDimmer, new Dimmer(this, "smartlife.iot.dimmer"));
    // this.addModule(Module.Light, new Light(this, "light"));
  }

  /**
     * Return current brightness on dimmers.
     * Will return a range between 0 - 100.
     * @requiresUpdate
     * @returns {number} Current brightness
     * @private
     */
  get _brightness() {
    if (!this._isDimmable) {
      throw new KasaException('Device is not dimmable.');
    }

    const sysInfo = this.sysInfo;
    return parseInt(sysInfo.brightness);
  }

  /**
     * Set the new dimmer brightness level in percentage.
     * @requiresUpdate
     * @param {number} brightness - Brightness level (0-100)
     * @param {Object} [options] - Options
     * @param {number} [options.transition] - Transition duration in milliseconds
     * @returns {Promise<Object>} Command result
     * @private
     */
  async _setBrightness(brightness, { transition = null } = {}) {
    if (!this._isDimmable) {
      throw new KasaException('Device is not dimmable.');
    }

    if (!Number.isInteger(brightness)) {
      throw new TypeError(`Brightness must be integer, not ${typeof brightness}.`);
    }

    if (brightness < 0 || brightness > 100) {
      throw new RangeError(
        `Invalid brightness value: ${brightness} (valid range: 0-100%)`
      );
    }

    // Dimmers do not support a brightness of 0, but bulbs do.
    // Coerce 0 to 1 to maintain the same interface between dimmers and bulbs.
    if (brightness === 0) {
      brightness = 1;
    }

    if (transition !== null) {
      return this.setDimmerTransition(brightness, transition);
    }

    return this._queryHelper(
      IotDimmer.DIMMER_SERVICE, 'set_brightness', { 'brightness': brightness }
    );
  }

  /**
     * Turn the dimmer off.
     * @param {Object} [options] - Options
     * @param {number} [options.transition] - Transition duration in milliseconds
     * @param {Object} [kwargs] - Additional parameters
     * @returns {Promise<Object>} Command result
     */
  async turnOff({ transition = null, ...kwargs } = {}) {
    if (transition !== null) {
      return this.setDimmerTransition(0, transition);
    }

    return super.turnOff(kwargs);
  }

  /**
     * Turn the dimmer on.
     * @requiresUpdate
     * @param {Object} [options] - Options
     * @param {number} [options.transition] - Transition duration in milliseconds
     * @param {Object} [kwargs] - Additional parameters
     * @returns {Promise<Object>} Command result
     */
  async turnOn({ transition = null, ...kwargs } = {}) {
    if (transition !== null) {
      return this.setDimmerTransition(this._brightness, transition);
    }

    return super.turnOn(kwargs);
  }

  /**
     * Turn the dimmer on to brightness percentage over transition milliseconds.
     * A brightness value of 0 will turn off the dimmer.
     * @param {number} brightness - Brightness level (0-100)
     * @param {number} transition - Transition duration in milliseconds
     * @returns {Promise<Object>} Command result
     */
  async setDimmerTransition(brightness, transition) {
    if (!Number.isInteger(brightness)) {
      throw new TypeError(`Brightness must be an integer, not ${typeof brightness}.`);
    }

    if (brightness < 0 || brightness > 100) {
      throw new RangeError(
        `Invalid brightness value: ${brightness} (valid range: 0-100%)`
      );
    }

    // If zero set to 1 millisecond
    if (transition === 0) {
      transition = 1;
    }
    if (!Number.isInteger(transition)) {
      throw new TypeError(`Transition must be integer, not ${typeof transition}.`);
    }
    if (transition <= 0) {
      throw new RangeError(`Transition value ${transition} is not valid.`);
    }

    return this._queryHelper(
      IotDimmer.DIMMER_SERVICE,
      'set_dimmer_transition',
      { 'brightness': brightness, 'duration': transition }
    );
  }

  /**
     * Return button behavior settings.
     * @requiresUpdate
     * @returns {Promise<Object>} Button behaviors
     */
  async getBehaviors() {
    const behaviors = await this._queryHelper(
      IotDimmer.DIMMER_SERVICE, 'get_default_behavior', {}
    );
    return behaviors;
  }

  /**
     * Set action to perform on button click/hold.
     * @requiresUpdate
     * @param {string} actionType - Whether to control double click or hold action
     * @param {string} action - What should the button do (nothing, instant, gentle, change preset)
     * @param {number|null} [index=null] - In case of preset change, the preset to select
     * @returns {Promise<Object>} Command result
     */
  async setButtonAction(actionType, action, index = null) {
    const actionTypeSetter = `set_${actionType}`;

    const payload = { 'mode': action };
    if (index !== null) {
      payload.index = index;
    }

    return this._queryHelper(
      IotDimmer.DIMMER_SERVICE, actionTypeSetter, payload
    );
  }

  /**
     * Set time for fade in / fade out.
     * @requiresUpdate
     * @param {string} fadeType - Fade type (fade_on or fade_off)
     * @param {number} time - Fade time
     * @returns {Promise<Object>} Command result
     */
  async setFadeTime(fadeType, time) {
    const fadeTypeSetter = `set_${fadeType}_time`;
    const payload = { 'fadeTime': time };

    return this._queryHelper(IotDimmer.DIMMER_SERVICE, fadeTypeSetter, payload);
  }

  /**
     * Whether the switch supports brightness changes.
     * @requiresUpdate
     * @returns {boolean} Is dimmable
     * @private
     */
  get _isDimmable() {
    const sysInfo = this.sysInfo;
    return 'brightness' in sysInfo;
  }

  /**
     * Whether the device supports variable color temp.
     * @returns {boolean} Supports variable color temp
     * @private
     */
  get _isVariableColorTemp() {
    return false;
  }

  /**
     * Whether the device supports color.
     * @returns {boolean} Supports color
     * @private
     */
  get _isColor() {
    return false;
  }

  /**
     * Return current brightness on dimmers.
     * Will return a range between 0 - 100.
     * @returns {number} Current brightness
     */
  get brightness() {
    return this._brightness;
  }

  /**
     * Set the new dimmer brightness level in percentage.
     * @param {number} brightness - Brightness level (0-100)
     * @param {Object} [options] - Options
     * @param {number} [options.transition] - Transition duration in milliseconds
     * @returns {Promise<Object>} Command result
     */
  async setBrightness(brightness, options = {}) {
    return this._setBrightness(brightness, options);
  }

  /**
     * Whether the switch supports brightness changes.
     * @returns {boolean} Is dimmable
     */
  get isDimmable() {
    return this._isDimmable;
  }

  /**
     * Whether the device supports variable color temp.
     * @returns {boolean} Supports variable color temp
     */
  get isVariableColorTemp() {
    return this._isVariableColorTemp;
  }

  /**
     * Whether the device supports color.
     * @returns {boolean} Supports color
     */
  get isColor() {
    return this._isColor;
  }
}

