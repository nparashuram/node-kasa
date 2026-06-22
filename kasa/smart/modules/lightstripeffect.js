/**
 * Implementation of dynamic light effects for Smart devices.
 */

import { SmartModule, allowUpdateAfter } from '../smartmodule.js';
import { LightEffect as LightEffectInterface } from '../../interfaces/lighteffect.js';
import { Module } from '../../module.js';
import { EFFECT_NAMES, EFFECT_MAPPING } from '../effects.js';

/**
 * Implementation of dynamic light effects.
 */
export class LightStripEffect extends SmartModule {
  static REQUIRED_COMPONENT = 'light_strip_lighting_effect';

  constructor(device, module) {
    super(device, module);
    this._effectList = [LightEffectInterface.LIGHT_EFFECTS_OFF, ...EFFECT_NAMES];
    this._effectMapping = EFFECT_MAPPING;
  }

  /**
   * Name of the module.
   */
  get name() {
    return 'LightEffect';
  }

  /**
   * Return effect name.
   * @returns {string} Effect name
   */
  get effect() {
    const eff = this.data.lighting_effect;
    if (!eff) return LightEffectInterface.LIGHT_EFFECTS_OFF;

    const name = eff.name;
    if (eff.enable && this._effectList.includes(name)) {
      return name;
    }
    if (eff.enable && eff.custom) {
      return name || LightEffectInterface.LIGHT_EFFECTS_UNNAMED_CUSTOM;
    }
    return LightEffectInterface.LIGHT_EFFECTS_OFF;
  }

  /**
   * Return if effect is active.
   * @returns {boolean} Active status
   */
  get isActive() {
    const eff = this.data.lighting_effect;
    return Boolean(eff && eff.enable && this._effectList.includes(eff.name));
  }

  /**
   * Return effect brightness.
   * @returns {number} Brightness
   */
  get brightness() {
    return this.data.lighting_effect ? this.data.lighting_effect.brightness : 0;
  }

  /**
   * Set effect brightness.
   * @param {number} brightness - Brightness
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async setBrightness(brightness, { transition = null } = {}) {
    if (brightness <= 0) {
      return await this.setEffect(LightEffectInterface.LIGHT_EFFECTS_OFF);
    }
    const eff = { 'brightness': brightness, 'bAdjusted': true };
    return await this.setCustomEffect(eff);
  }

  /**
   * Return built-in effects list.
   * @returns {Array<string>} Effect names
   */
  get effectList() {
    return this._effectList;
  }

  /**
   * Set an effect on the device.
   * @param {string} effect - Effect name
   * @param {Object} options - Options
   * @param {number|null} [options.brightness] - Brightness
   * @param {number|null} [options.transition] - Transition
   * @returns {Promise<Object>} Result
   */
  async setEffect(effect, { brightness = null, transition = null } = {}) {
    const brightnessModule = this._device.modules[Module.Brightness];

    if (effect === LightEffectInterface.LIGHT_EFFECTS_OFF) {
      let effectDict;
      if (this._effectMapping[this.effect]) {
        effectDict = { ...this._effectMapping[this.effect] };
      } else {
        effectDict = { ...this._effectMapping['Aurora'] };
      }
      effectDict.enable = 0;
      return await this.setCustomEffect(effectDict);
    }

    if (!this._effectMapping[effect]) {
      throw new Error(`The effect ${effect} is not a built in effect.`);
    }

    const effectDict = { ...this._effectMapping[effect] };
    if (brightness !== null) {
      effectDict.brightness = brightness;
    } else if (brightnessModule && brightnessModule.brightness) {
      effectDict.brightness = brightnessModule.brightness;
    }

    if (transition !== null) {
      effectDict.transition = transition;
    }

    return await this.setCustomEffect(effectDict);
  }

  /**
   * Set a custom effect on the device.
   * @param {Object} effectDict - Effect configuration
   * @returns {Promise<Object>} Result
   */
  async setCustomEffect(effectDict) {
    return await this.call('set_lighting_effect', effectDict);
  }

  /**
   * Return True if the device supports setting custom effects.
   * @returns {boolean}
   */
  get hasCustomEffects() {
    return true;
  }

  /**
   * Query to execute during the update cycle.
   * @returns {Object} Query object
   */
  query() {
    return {};
  }
}

// Manually apply decorators
const setBrightnessDescriptor = Object.getOwnPropertyDescriptor(LightStripEffect.prototype, 'setBrightness');
if (setBrightnessDescriptor) {
  Object.defineProperty(LightStripEffect.prototype, 'setBrightness', allowUpdateAfter(LightStripEffect.prototype, 'setBrightness', setBrightnessDescriptor));
}

const setEffectDescriptor = Object.getOwnPropertyDescriptor(LightStripEffect.prototype, 'setEffect');
if (setEffectDescriptor) {
  Object.defineProperty(LightStripEffect.prototype, 'setEffect', allowUpdateAfter(LightStripEffect.prototype, 'setEffect', setEffectDescriptor));
}

const setCustomEffectDescriptor = Object.getOwnPropertyDescriptor(LightStripEffect.prototype, 'setCustomEffect');
if (setCustomEffectDescriptor) {
  Object.defineProperty(LightStripEffect.prototype, 'setCustomEffect', allowUpdateAfter(LightStripEffect.prototype, 'setCustomEffect', setCustomEffectDescriptor));
}

SmartModule.registerModule(LightStripEffect);
