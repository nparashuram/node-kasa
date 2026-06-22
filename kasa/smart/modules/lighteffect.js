/**
 * Module for light effects.
 */

import { LightEffect as LightEffectInterface } from '../../interfaces/lighteffect.js';
import { SmartModule, allowUpdateAfter } from '../smartmodule.js';
import { Module } from '../../module.js';

/**
 * Implementation of dynamic light effects.
 */
export class LightEffect extends SmartModule {
  static NAME = 'LightEffect';
  static REQUIRED_COMPONENT = 'light_effect';
  static QUERY_GETTER_NAME = 'get_dynamic_light_effect_rules';
  static MINIMUM_UPDATE_INTERVAL_SECS = 60 * 60 * 24;

  static AVAILABLE_BULB_EFFECTS = {
    'L1': 'Party',
    'L2': 'Relax',
  };

  constructor(device, module) {
    super(device, module);
    this._effect = null;
    this._effectStateList = {};
    this._effectList = [];
    this._scenesNamesToId = {};
  }

  /**
   * Update internal effect state.
   */
  async _postUpdateHook() {
    const effects = {};
    if (this.data.rule_list) {
      for (const effect of this.data.rule_list) {
        const effectCopy = { ...effect };
        if (!effectCopy.scene_name) {
          effectCopy.scene_name = LightEffect.AVAILABLE_BULB_EFFECTS[effectCopy.id];
        } else {
          try {
            effectCopy.scene_name = Buffer.from(effectCopy.scene_name, 'base64').toString('utf8');
          } catch (e) {
            // Keep original name if not base64
          }
        }
        effects[effectCopy.id] = effectCopy;
      }
    }

    this._effectStateList = effects;
    this._effectList = [LightEffectInterface.LIGHT_EFFECTS_OFF];
    this._effectList.push(...Object.values(effects).map(e => e.scene_name));
    this._scenesNamesToId = Object.fromEntries(
      Object.values(effects).map(e => [e.scene_name, e.id])
    );

    if (this._device._info.dynamic_light_effect_enable) {
      const activeId = this._device._info.dynamic_light_effect_id;
      if (this._effectStateList[activeId]) {
        this._effect = this._effectStateList[activeId].scene_name;
      } else {
        this._effect = LightEffectInterface.LIGHT_EFFECTS_OFF;
      }
    } else {
      this._effect = LightEffectInterface.LIGHT_EFFECTS_OFF;
    }
  }

  /**
   * Return built-in effects list.
   * @returns {Array<string>} Effect names
   */
  get effectList() {
    return this._effectList;
  }

  /**
   * Return effect name.
   * @returns {string} Effect name
   */
  get effect() {
    return this._effect;
  }

  /**
   * Set an effect for the device.
   * @param {string} effect - Effect name
   * @param {Object} options - Options
   * @param {number|null} [options.brightness] - Brightness
   * @param {number|null} [options.transition] - Transition
   * @returns {Promise<Object>} Command result
   */
  async setEffect(effect, { brightness = null, transition = null } = {}) {
    if (effect !== LightEffectInterface.LIGHT_EFFECTS_OFF && !this._scenesNamesToId[effect]) {
      throw new Error(`The effect ${effect} is not a built in effect. Possible values are: ${this._effectList.join(', ')}`);
    }

    const enable = effect !== LightEffectInterface.LIGHT_EFFECTS_OFF;
    const params = { enable };

    if (enable) {
      const effectId = this._scenesNamesToId[effect];
      params.id = effectId;

      const brightnessModule = this._device.modules[Module.Brightness];
      const targetBrightness = brightness !== null ? brightness : brightnessModule.brightness;

      await this.setBrightness(targetBrightness, { effectId });
    }

    return await this.call('set_dynamic_light_effect_rule_enable', params);
  }

  /**
   * Return True if effect is active.
   * @returns {boolean} Active status
   */
  get isActive() {
    return Boolean(this._device._info.dynamic_light_effect_enable);
  }

  /**
   * Return effect data for the effectId.
   * @param {string|null} [effectId=null] - Effect ID
   * @returns {Object} Effect data
   * @private
   */
  _getEffectData(effectId = null) {
    if (effectId === null) {
      effectId = this.data.current_rule_id;
    }
    return this._effectStateList[effectId];
  }

  /**
   * Return effect brightness.
   * @returns {number} Brightness
   */
  get brightness() {
    const data = this._getEffectData();
    if (data && data.color_status_list && data.color_status_list[0]) {
      return data.color_status_list[0][0];
    }
    return 0;
  }

  /**
   * Set effect brightness.
   * @param {number} brightness - Brightness
   * @param {Object} options - Options
   * @param {number|null} [options.transition] - Transition
   * @param {string|null} [options.effectId] - Effect ID
   * @returns {Promise<Object>} Command result
   */
  async setBrightness(brightness, { transition = null, effectId = null } = {}) {
    const currentData = this._getEffectData(effectId);
    if (!currentData) throw new Error('Effect data not found');

    const newData = { ...currentData };
    newData.color_status_list = currentData.color_status_list.map(state => [
      brightness, state[1], state[2], state[3]
    ]);

    return await this.call('edit_dynamic_light_effect_rule', newData);
  }

  /**
   * Set a custom effect on the device.
   * @param {Object} effectDict - Custom effect configuration
   * @returns {Promise<Object>} Command result
   */
  async setCustomEffect(effectDict) {
    throw new Error('Device does not support setting custom effects. Use hasCustomEffects to check for support.');
  }

  /**
   * Return True if the device supports setting custom effects.
   * @returns {boolean}
   */
  get hasCustomEffects() {
    return false;
  }

  /**
   * Query to execute during the update cycle.
   * @returns {Object} Query object
   */
  query() {
    return { [LightEffect.QUERY_GETTER_NAME]: { start_index: 0 } };
  }
}

// Manually apply decorators
const setEffectDescriptor = Object.getOwnPropertyDescriptor(LightEffect.prototype, 'setEffect');
if (setEffectDescriptor) {
  Object.defineProperty(LightEffect.prototype, 'setEffect', allowUpdateAfter(LightEffect.prototype, 'setEffect', setEffectDescriptor));
}

const setBrightnessDescriptor = Object.getOwnPropertyDescriptor(LightEffect.prototype, 'setBrightness');
if (setBrightnessDescriptor) {
  Object.defineProperty(LightEffect.prototype, 'setBrightness', allowUpdateAfter(LightEffect.prototype, 'setBrightness', setBrightnessDescriptor));
}

const setCustomEffectDescriptor = Object.getOwnPropertyDescriptor(LightEffect.prototype, 'setCustomEffect');
if (setCustomEffectDescriptor) {
  Object.defineProperty(LightEffect.prototype, 'setCustomEffect', allowUpdateAfter(LightEffect.prototype, 'setCustomEffect', setCustomEffectDescriptor));
}

SmartModule.registerModule(LightEffect);
