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
  }

  /**
   * @protected
   */
  async _postUpdateHook() {
    let index = 0;
    this._presets = {};
    const stateKey = !this._stateInSysinfo ? 'states' : LightPreset.SYS_INFO_STATE_KEY;
    const presetStates = this.data[stateKey];

    if (presetStates) {
      for (const presetState of presetStates) {
        if (!('brightness' in presetState)) {
          if (!('lighting_effect' in presetState)) {
            console.log('Unexpected keys in preset', Object.keys(presetState));
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

    this._presetList = [LightPresetInterface.PRESET_NOT_SET, ...Object.keys(this._presets)];
  }

  /**
   * Return built-in effects list.
   * @returns {string[]} List of presets
   */
  get presetList() {
    return this._presetList;
  }

  /**
   * Return list of preset states.
   * @returns {LightState[]} List of states
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
    const brightness = light.brightness;
    const colorTemp = light.hasFeature('color_temp') ? light.colorTemp : null;
    let h = null, s = null;
    if (light.hasFeature('hsv')) {
      h = light.hsv.hue;
      s = light.hsv.saturation;
    }

    for (const [presetName, preset] of Object.entries(this._presets)) {
      if (
        preset.brightness === brightness &&
        (preset.colorTemp === colorTemp || !light.hasFeature('color_temp')) &&
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
   * @returns {Promise<Object>} Result
   */
  async setPreset(presetName) {
    const light = this._device.modules[Module.Light];
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
        throw new Error(`${presetName} is not a valid preset: ${this.presetList}`);
      }
    }
    return await light.setState(preset);
  }

  /**
   * Update the preset with presetName with the new presetInfo.
   * @param {string} presetName - Preset name
   * @param {LightState} presetState - New state
   * @returns {Promise<Object>} Result
   */
  async savePreset(presetName, presetState) {
    if (!(presetName in this._presets)) {
      throw new Error(`${presetName} is not a valid preset: ${this.presetList}`);
    }
    const index = Object.keys(this._presets).indexOf(presetName);
    if (this._brightnessOnly) {
      const brightList = Object.values(this._presets).map(s => s.brightness);
      brightList[index] = presetState.brightness;
      return await this.call('set_preset_rules', { brightness: brightList });
    } else {
      const newInfo = {};
      if (presetState.brightness !== null) newInfo.brightness = presetState.brightness;
      if (presetState.hue !== null) newInfo.hue = presetState.hue;
      if (presetState.saturation !== null) newInfo.saturation = presetState.saturation;
      if (presetState.colorTemp !== null) newInfo.color_temp = presetState.colorTemp;
      return await this.call('edit_preset_rules', { index, state: newInfo });
    }
  }

  /**
   * Return True if the device supports updating presets.
   * @returns {boolean} Supports save
   */
  get hasSavePreset() {
    return true;
  }

  /**
   * Query to execute during the update cycle.
   * @returns {Object} Query
   */
  query() {
    if (this._stateInSysinfo) {
      return {};
    }
    // Note: supportedVersion check missing from SmartModule, assuming this._device.supportedVersion
    if (this._device.supportedVersion < 3) {
      return { [this.constructor.QUERY_GETTER_NAME]: null };
    }
    return { [this.constructor.QUERY_GETTER_NAME]: { 'start_index': 0 } };
  }

  /**
   * Additional check to see if the module is supported by the device.
   * @returns {Promise<boolean>} Supported
   * @protected
   */
  async _checkSupported() {
    return 'brightness' in this._device.sysInfo;
  }
}

allowUpdateAfter(LightPreset.prototype, 'savePreset', Object.getOwnPropertyDescriptor(LightPreset.prototype, 'savePreset'));

SmartModule.registerModule(LightPreset);
