/**
 * Module for light presets.
 */

import { LightPreset as LightPresetInterface } from '../../interfaces/lightpreset.js';
import { LightState } from '../../interfaces/light.js';
import { SmartModule, allowUpdateAfter } from '../smartmodule.js';
import { Module } from '../../module.js';

/**
 * Implementation of light presets.
 */
export class LightPreset extends SmartModule {
  static NAME = 'LightPreset';
  static REQUIRED_COMPONENT = 'preset';
  static QUERY_GETTER_NAME = 'get_preset_rules';
  static MINIMUM_UPDATE_INTERVAL_SECS = 60;
  static SYS_INFO_STATE_KEY = 'preset_state';

  constructor(device, module) {
    super(device, module);
    this._stateInSysinfo = LightPreset.SYS_INFO_STATE_KEY in device.sysInfo;
    this._brightnessOnly = false;
    this._presets = {};
    this._presetList = [];
  }

  /**
   * Update the internal presets.
   */
  async _postUpdateHook() {
    let index = 0;
    this._presets = {};
    const stateKey = !this._stateInSysinfo ? 'states' : LightPreset.SYS_INFO_STATE_KEY;
    const presetStates = this.data[stateKey];

    if (presetStates) {
      for (const presetState of presetStates) {
        if (!('brightness' in presetState)) {
          // Some devices can store effects as a preset. These will be ignored
          // and handled in the effects module
          if (!('lighting_effect' in presetState)) {
            console.info('Unexpected keys in preset:', Object.keys(presetState));
          }
          continue;
        }

        const colorTemp = presetState.color_temp;
        const hue = presetState.hue;
        const saturation = presetState.saturation;

        this._presets[`Light preset ${index + 1}`] = new LightState({
          brightness: presetState.brightness,
          colorTemp,
          hue,
          saturation,
        });

        if (colorTemp === undefined && hue === undefined && saturation === undefined) {
          this._brightnessOnly = true;
        }
        index++;
      }
    } else if (this.data.brightness) {
      this._brightnessOnly = true;
      for (const presetBrightness of this.data.brightness) {
        this._presets[`Brightness preset ${index + 1}`] = new LightState({
          brightness: presetBrightness,
        });
        index++;
      }
    }

    this._presetList = [LightPresetInterface.PRESET_NOT_SET];
    this._presetList.push(...Object.keys(this._presets));
  }

  /**
   * Return built-in presets list.
   * @returns {Array<string>} Preset names
   */
  get presetList() {
    return this._presetList;
  }

  /**
   * Return list of preset states.
   * @returns {Array<LightState>} Preset states
   */
  get presetStatesList() {
    return Object.values(this._presets);
  }

  /**
   * Return current preset name.
   * @returns {string} Preset name
   */
  get preset() {
    const light = this._device.modules[Module.Light];
    if (!light) return LightPresetInterface.PRESET_NOT_SET;

    const brightness = light.brightness;
    const colorTemp = light.hasFeature('colorTemp') ? light.colorTemp : null;
    let h = null;
    let s = null;
    if (light.hasFeature('hsv')) {
      h = light.hsv.hue;
      s = light.hsv.saturation;
    }

    for (const [presetName, preset] of Object.entries(this._presets)) {
      if (
        preset.brightness === brightness &&
        (preset.colorTemp === colorTemp || !light.hasFeature('colorTemp')) &&
        preset.hue === h &&
        preset.saturation === s
      ) {
        return presetName;
      }
    }
    return LightPresetInterface.PRESET_NOT_SET;
  }

  /**
   * Set a light preset for the device.
   * @param {string} presetName - Preset name
   * @returns {Promise<Object>} Command result
   */
  async setPreset(presetName) {
    const light = this._device.modules[Module.Light];
    if (!light) throw new Error('Light module not available');

    let preset;
    if (presetName === LightPresetInterface.PRESET_NOT_SET) {
      if (light.hasFeature('hsv')) {
        preset = new LightState({ hue: 0, saturation: 0, brightness: 100 });
      } else {
        preset = new LightState({ brightness: 100 });
      }
    } else {
      preset = this._presets[presetName];
      if (!preset) {
        throw new Error(`${presetName} is not a valid preset: ${this._presetList.join(', ')}`);
      }
    }
    return await light.setState(preset);
  }

  /**
   * Update the preset with presetName with the new presetInfo.
   * @param {string} presetName - Preset name
   * @param {LightState} presetState - New preset state
   * @returns {Promise<Object>} Command result
   */
  async savePreset(presetName, presetState) {
    if (!(presetName in this._presets)) {
      throw new Error(`${presetName} is not a valid preset: ${this._presetList.join(', ')}`);
    }

    const index = Object.keys(this._presets).indexOf(presetName);
    if (this._brightnessOnly) {
      const brightList = Object.values(this._presets).map(state => state.brightness);
      brightList[index] = presetState.brightness;
      return await this.call('set_preset_rules', { brightness: brightList });
    } else {
      const newInfo = {};
      if (presetState.brightness !== null) newInfo.brightness = presetState.brightness;
      if (presetState.colorTemp !== null) newInfo.color_temp = presetState.colorTemp;
      if (presetState.hue !== null) newInfo.hue = presetState.hue;
      if (presetState.saturation !== null) newInfo.saturation = presetState.saturation;

      return await this.call('edit_preset_rules', { index, state: newInfo });
    }
  }

  /**
   * Return True if the device supports updating presets.
   * @returns {boolean}
   */
  get hasSavePreset() {
    return true;
  }

  /**
   * Query to execute during the update cycle.
   * @returns {Object} Query object
   */
  query() {
    if (this._stateInSysinfo) return {};
    return { [LightPreset.QUERY_GETTER_NAME]: { start_index: 0 } };
  }
}

// Manually apply decorators
const savePresetDescriptor = Object.getOwnPropertyDescriptor(LightPreset.prototype, 'savePreset');
if (savePresetDescriptor) {
  Object.defineProperty(LightPreset.prototype, 'savePreset', allowUpdateAfter(LightPreset.prototype, 'savePreset', savePresetDescriptor));
}

SmartModule.registerModule(LightPreset);
