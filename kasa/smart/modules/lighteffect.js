/**
 * Module for light effects.
 */

import { LightEffect as LightEffectInterface } from '../../interfaces/lighteffect.js';
import { Module } from '../../module.js';
import { SmartModule, allowUpdateAfter } from '../smartmodule.js';

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

  /**
   * @protected
   */
  async _postUpdateHook() {
    const data = this.data;
    const ruleList = data.rule_list || [];

    const effects = {};
    for (const effect of ruleList) {
      const effectCopy = { ...effect };
      if (!effectCopy.scene_name) {
        effectCopy.scene_name = LightEffect.AVAILABLE_BULB_EFFECTS[effectCopy.id];
      } else {
        try {
          effectCopy.scene_name = Buffer.from(effectCopy.scene_name, 'base64').toString();
        } catch (e) {
          // keep as is
        }
      }
      effects[effectCopy.id] = effectCopy;
    }

    this._effectStateList = effects;
    this._effectList = [LightEffectInterface.LIGHT_EFFECTS_OFF];
    this._effectList.push(...Object.values(effects).map(e => e.scene_name));

    this._scenesNamesToId = {};
    for (const effect of Object.values(effects)) {
      this._scenesNamesToId[effect.scene_name] = effect.id;
    }

    if (this._device._info.dynamic_light_effect_enable) {
      const currentId = this._device._info.dynamic_light_effect_id;
      this._effect = this._effectStateList[currentId]?.scene_name || LightEffectInterface.LIGHT_EFFECTS_OFF;
    } else {
      this._effect = LightEffectInterface.LIGHT_EFFECTS_OFF;
    }
  }

  /**
   * Return built-in effects list.
   * @returns {string[]} List of effects
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
   * @returns {Promise<Object>} Result
   */
  async setEffect(effect, { brightness = null, transition = null } = {}) {
    if (effect !== LightEffectInterface.LIGHT_EFFECTS_OFF && !(effect in this._scenesNamesToId)) {
      throw new Error(`The effect ${effect} is not a built in effect. Possible values are: ${LightEffectInterface.LIGHT_EFFECTS_OFF} ${Object.keys(this._scenesNamesToId).join(' ')}`);
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
   * @returns {boolean} Is active
   */
  get isActive() {
    return !!this._device._info.dynamic_light_effect_enable;
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
    return data.color_status_list[0][0];
  }

  /**
   * Set effect brightness.
   * @param {number} brightness - Brightness
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async setBrightness(brightness, { transition = null, effectId = null } = {}) {
    const effectData = this._getEffectData(effectId);
    const newEffect = { ...effectData };

    newEffect.color_status_list = effectData.color_status_list.map(state => [
      brightness, state[1], state[2], state[3]
    ]);

    return await this.call('edit_dynamic_light_effect_rule', newEffect);
  }

  /**
   * Set a custom effect on the device.
   * @param {Object} effectDict - Custom effect
   */
  async setCustomEffect(effectDict) {
    throw new Error('Device does not support setting custom effects. Use hasCustomEffects to check for support.');
  }

  /**
   * Return True if the device supports setting custom effects.
   * @returns {boolean} Supports custom effects
   */
  get hasCustomEffects() {
    return false;
  }

  /**
   * Query to execute during the update cycle.
   * @returns {Object} Query
   */
  query() {
    return { [this.constructor.QUERY_GETTER_NAME]: { 'start_index': 0 } };
  }
}

allowUpdateAfter(LightEffect.prototype, 'setEffect', Object.getOwnPropertyDescriptor(LightEffect.prototype, 'setEffect'));
allowUpdateAfter(LightEffect.prototype, 'setBrightness', Object.getOwnPropertyDescriptor(LightEffect.prototype, 'setBrightness'));
allowUpdateAfter(LightEffect.prototype, 'setCustomEffect', Object.getOwnPropertyDescriptor(LightEffect.prototype, 'setCustomEffect'));

SmartModule.registerModule(LightEffect);
