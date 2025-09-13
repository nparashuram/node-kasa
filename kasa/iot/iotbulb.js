/**
 * Module for bulbs (LB*, KL*, KB*).
 */

import { DeviceType } from '../deviceType.js';
import { DeviceConfig } from '../deviceconfig.js';
import { Module } from '../module.js';
import { IotDevice, requiresUpdate } from './iotdevice.js';
import { KasaException } from '../exceptions.js';
// import { HSV, ColorTempRange } from '../interfaces/light.js';
// import { Antitheft, Cloud, Countdown, Emeter, Light, LightPreset, Schedule, Time, Usage } from './modules/index.js';

const _LOGGER = console; // Simple logger replacement

/**
 * Enum to present type of turn on behavior.
 */
export const BehaviorMode = {
  /** Return to the last state known state. */
  Last: 'last_status',
  /** Use chosen preset. */
  Preset: 'customize_preset',
  /** Circadian */
  Circadian: 'circadian'
};

/**
 * Model to present a single turn on behavior.
 */
export class TurnOnBehavior {
  /**
     * Create a turn on behavior.
     * @param {string} mode - Behavior mode
     * @param {number|null} [preset=null] - Index of preset to use, or null for the last known state
     * @param {number|null} [brightness=null] - Brightness
     * @param {number|null} [colorTemp=null] - Color temperature
     * @param {number|null} [hue=null] - Hue
     * @param {number|null} [saturation=null] - Saturation
     */
  constructor(mode, { preset = null, brightness = null, colorTemp = null, hue = null, saturation = null } = {}) {
    this.mode = mode;
    this.preset = preset;
    this.brightness = brightness;
    this.colorTemp = colorTemp;
    this.hue = hue;
    this.saturation = saturation;
  }

  /**
     * Convert to dictionary.
     * @returns {Object} Dictionary representation
     */
  toDict() {
    const result = { mode: this.mode };
    if (this.preset !== null) result.index = this.preset;
    if (this.brightness !== null) result.brightness = this.brightness;
    if (this.colorTemp !== null) result.color_temp = this.colorTemp;
    if (this.hue !== null) result.hue = this.hue;
    if (this.saturation !== null) result.saturation = this.saturation;
    return result;
  }
}

/**
 * Model to contain turn on behaviors.
 */
export class TurnOnBehaviors {
  /**
     * Create turn on behaviors.
     * @param {TurnOnBehavior} soft - The behavior when the bulb is turned on programmatically
     * @param {TurnOnBehavior} hard - The behavior when the bulb has been off from mains power
     */
  constructor(soft, hard) {
    this.soft = soft;
    this.hard = hard;
  }
}

// TP-Link Kelvin ranges by model
const TPLINK_KELVIN = {
  'LB130': { min: 2500, max: 9000 },
  'LB120': { min: 2700, max: 6500 },
  'LB230': { min: 2500, max: 9000 },
  'KB130': { min: 2500, max: 9000 },
  'KL130': { min: 2500, max: 9000 },
  'KL125': { min: 2500, max: 6500 },
  'KL135': { min: 2500, max: 9000 },
  'KL120\\(EU\\)': { min: 2700, max: 6500 },
  'KL120\\(US\\)': { min: 2700, max: 5000 },
  'KL430': { min: 2500, max: 9000 },
};

const NON_COLOR_MODE_FLAGS = new Set(['transition_period', 'on_off']);

/**
 * Representation of a TP-Link Smart Bulb.
 *
 * To initialize, you have to await update() at least once.
 * This will allow accessing the properties using the exposed properties.
 *
 * All changes to the device are done using awaitable methods,
 * which will not change the cached values,
 * so you must await update() to fetch updates values from the device.
 *
 * Errors reported by the device are raised as KasaException,
 * and should be handled by the user of the library.
 *
 * @example
 * import { IotBulb } from 'node-kasa';
 * 
 * const bulb = new IotBulb("127.0.0.1");
 * await bulb.update();
 * console.log(bulb.alias);
 * // Bulb2
 * 
 * // Bulbs, like any other supported devices, can be turned on and off:
 * await bulb.turnOff();
 * await bulb.turnOn();
 * await bulb.update();
 * console.log(bulb.isOn);
 * // true
 * 
 * // You can use the is-prefixed properties to check for supported features:
 * console.log(bulb.isDimmable);
 * // true
 * console.log(bulb.isColor);
 * // true
 * console.log(bulb.isVariableColorTemp);
 * // true
 * 
 * // All known bulbs support changing the brightness:
 * console.log(bulb.brightness);
 * // 30
 * await bulb.setBrightness(50);
 * await bulb.update();
 * console.log(bulb.brightness);
 * // 50
 */
export class IotBulb extends IotDevice {
  static LIGHT_SERVICE = 'smartlife.iot.smartbulb.lightingservice';
  static SET_LIGHT_METHOD = 'transition_light_state';

  /**
     * Create a new IotBulb instance.
     * @param {string} host - Host name or IP address of the device
     * @param {Object} options - Configuration options
     * @param {DeviceConfig} [options.config] - Device configuration
     * @param {BaseProtocol} [options.protocol] - Protocol for communicating with the device
     */
  constructor(host, { config = null, protocol = null } = {}) {
    super(host, { config, protocol });
    this._deviceType = DeviceType.Bulb;
    this.emeterType = 'smartlife.iot.common.emeter';
  }

  /**
     * Initialize modules not added in init.
     * @protected
     */
  async _initializeModules() {
    await super._initializeModules();
        
    // this.addModule(Module.IotSchedule, new Schedule(this, "smartlife.iot.common.schedule"));
    // this.addModule(Module.IotUsage, new Usage(this, "smartlife.iot.common.schedule"));
    // this.addModule(Module.IotAntitheft, new Antitheft(this, "smartlife.iot.common.anti_theft"));
    // this.addModule(Module.Time, new Time(this, "smartlife.iot.common.timesetting"));
    // this.addModule(Module.Energy, new Emeter(this, this.emeterType));
    // this.addModule(Module.IotCountdown, new Countdown(this, "countdown"));
    // this.addModule(Module.IotCloud, new Cloud(this, "smartlife.iot.common.cloud"));
    // this.addModule(Module.Light, new Light(this, IotBulb.LIGHT_SERVICE));
    // this.addModule(Module.LightPreset, new LightPreset(this, IotBulb.LIGHT_SERVICE));
  }

  /**
     * Whether the bulb supports color changes.
     * @requiresUpdate
     * @returns {boolean} Supports color
     * @private
     */
  get _isColor() {
    const sysInfo = this.sysInfo;
    return Boolean(sysInfo.is_color);
  }

  /**
     * Whether the bulb supports brightness changes.
     * @requiresUpdate
     * @returns {boolean} Supports dimming
     * @private
     */
  get _isDimmable() {
    const sysInfo = this.sysInfo;
    return Boolean(sysInfo.is_dimmable);
  }

  /**
     * Whether the bulb supports color temperature changes.
     * @requiresUpdate
     * @returns {boolean} Supports variable color temperature
     * @private
     */
  get _isVariableColorTemp() {
    const sysInfo = this.sysInfo;
    return Boolean(sysInfo.is_variable_color_temp);
  }

  /**
     * Return the device-specific white temperature range (in Kelvin).
     * @requiresUpdate
     * @returns {Object} White temperature range in Kelvin (minimum, maximum)
     * @private
     */
  get _validTemperatureRange() {
    if (!this._isVariableColorTemp) {
      throw new KasaException('Color temperature not supported');
    }

    const sysInfo = this.sysInfo;
    for (const [model, tempRange] of Object.entries(TPLINK_KELVIN)) {
      const regex = new RegExp(model);
      if (regex.test(sysInfo.model)) {
        return tempRange;
      }
    }

    return { min: 2700, max: 5000 };
  }

  /**
     * Query the light state.
     * @requiresUpdate
     * @returns {Object} Light state
     */
  get lightState() {
    const sysInfo = this.sysInfo;
    if (!sysInfo) return null;
        
    const lightState = sysInfo.light_state;
    if (lightState === null || lightState === undefined) {
      throw new KasaException(
        'The device has no light_state or you have not called update()'
      );
    }

    // if the bulb is off, its state is stored under a different key
    // as isOn property depends on on_off itself, we check it here manually
    const isOn = lightState.on_off;
    if (!isOn) {
      const offState = { ...lightState.dft_on_state, on_off: isOn };
      return offState;
    }

    return lightState;
  }

  /**
     * Return True if the device supports effects.
     * @requiresUpdate
     * @returns {boolean} Has effects
     * @private
     */
  get _hasEffects() {
    return 'lighting_effect_state' in this.sysInfo;
  }

  /**
     * Return light details.
     * @returns {Promise<Object>} Light details
     */
  async getLightDetails() {
    return this._queryHelper(IotBulb.LIGHT_SERVICE, 'get_light_details');
  }

  /**
     * Return whether device is on.
     * @requiresUpdate
     * @returns {boolean} Device on state
     */
  get isOn() {
    const lightState = this.lightState;
    return Boolean(lightState.on_off);
  }

  /**
     * Turn the bulb on.
     * @param {Object} [options] - Options
     * @param {number} [options.transition] - Transition time in milliseconds
     * @returns {Promise<Object>} Command result
     */
  async turnOn({ transition = null } = {}) {
    const parameters = { on_off: 1 };
    if (transition !== null) {
      parameters.transition_period = transition;
    }
    return this._queryHelper(IotBulb.LIGHT_SERVICE, IotBulb.SET_LIGHT_METHOD, parameters);
  }

  /**
     * Turn the bulb off.
     * @param {Object} [options] - Options
     * @param {number} [options.transition] - Transition time in milliseconds
     * @returns {Promise<Object>} Command result
     */
  async turnOff({ transition = null } = {}) {
    const parameters = { on_off: 0 };
    if (transition !== null) {
      parameters.transition_period = transition;
    }
    return this._queryHelper(IotBulb.LIGHT_SERVICE, IotBulb.SET_LIGHT_METHOD, parameters);
  }

  /**
     * Whether the bulb supports color changes.
     * @returns {boolean} Supports color
     */
  get isColor() {
    return this._isColor;
  }

  /**
     * Whether the bulb supports brightness changes.
     * @returns {boolean} Supports dimming
     */
  get isDimmable() {
    return this._isDimmable;
  }

  /**
     * Whether the bulb supports color temperature changes.
     * @returns {boolean} Supports variable color temperature
     */
  get isVariableColorTemp() {
    return this._isVariableColorTemp;
  }

  /**
     * Return the device-specific white temperature range (in Kelvin).
     * @returns {Object} White temperature range in Kelvin (minimum, maximum)
     */
  get validTemperatureRange() {
    return this._validTemperatureRange;
  }

  /**
     * Return True if the device supports effects.
     * @returns {boolean} Has effects
     */
  get hasEffects() {
    return this._hasEffects;
  }

  /**
     * Return current brightness.
     * @requiresUpdate
     * @returns {number} Current brightness (0-100)
     */
  get brightness() {
    const lightState = this.lightState;
    if (!lightState) return null;
    return lightState.brightness || 0;
  }

  /**
     * Set the brightness of the device.
     * @param {number} brightness - Brightness value (0-100)
     * @param {Object} [options] - Options
     * @param {number} [options.transition] - Transition time in milliseconds
     * @returns {Promise<Object>} Command result
     */
  async setBrightness(brightness, { transition = null } = {}) {
    if (brightness < 0 || brightness > 100) {
      throw new KasaException('Brightness must be between 0 and 100');
    }

    const parameters = { brightness };
    if (transition !== null) {
      parameters.transition_period = transition;
    }
    return this._queryHelper(IotBulb.LIGHT_SERVICE, IotBulb.SET_LIGHT_METHOD, parameters);
  }

  /**
     * Return current color temperature.
     * @requiresUpdate
     * @returns {number} Current color temperature
     */
  get colorTemp() {
    if (!this.isVariableColorTemp) {
      throw new KasaException('Bulb does not support color temperature');
    }
    const lightState = this.lightState;
    return lightState.color_temp || 0;
  }

  /**
     * Set the color temperature of the device.
     * @param {number} temp - Color temperature in Kelvin
     * @param {Object} [options] - Options
     * @param {number} [options.transition] - Transition time in milliseconds
     * @returns {Promise<Object>} Command result
     */
  async setColorTemp(temp, { transition = null } = {}) {
    if (!this.isVariableColorTemp) {
      throw new KasaException('Bulb does not support color temperature');
    }

    const range = this.validTemperatureRange;
    if (temp < range.min || temp > range.max) {
      throw new KasaException(
        `Color temperature must be between ${range.min} and ${range.max}`
      );
    }

    const parameters = { color_temp: temp };
    if (transition !== null) {
      parameters.transition_period = transition;
    }
    return this._queryHelper(IotBulb.LIGHT_SERVICE, IotBulb.SET_LIGHT_METHOD, parameters);
  }

  /**
     * Return current HSV values.
     * @requiresUpdate
     * @returns {Object} Current HSV values
     */
  get hsv() {
    if (!this.isColor) {
      throw new KasaException('Bulb does not support color');
    }
        
    const lightState = this.lightState;
    return {
      hue: lightState.hue || 0,
      saturation: lightState.saturation || 0,
      value: lightState.brightness || 0
    };
  }

  /**
     * Set new HSV values.
     * @param {number} hue - Hue value (0-360)
     * @param {number} saturation - Saturation value (0-100)
     * @param {number} value - Value/brightness (0-100)
     * @param {Object} [options] - Options
     * @param {number} [options.transition] - Transition time in milliseconds
     * @returns {Promise<Object>} Command result
     */
  async setHsv(hue, saturation, value, { transition = null } = {}) {
    if (!this.isColor) {
      throw new KasaException('Bulb does not support color');
    }

    if (hue < 0 || hue > 360) {
      throw new KasaException('Hue must be between 0 and 360');
    }
    if (saturation < 0 || saturation > 100) {
      throw new KasaException('Saturation must be between 0 and 100');
    }
    if (value < 0 || value > 100) {
      throw new KasaException('Value must be between 0 and 100');
    }

    const parameters = {
      hue,
      saturation,
      brightness: value,
      color_temp: 0  // Disable color temp when setting HSV
    };
        
    if (transition !== null) {
      parameters.transition_period = transition;
    }
        
    return this._queryHelper(IotBulb.LIGHT_SERVICE, IotBulb.SET_LIGHT_METHOD, parameters);
  }

  /**
     * Get current turn-on behaviors.
     * @returns {Promise<TurnOnBehaviors>} Turn on behaviors
     */
  async getTurnOnBehaviors() {
    const response = await this._queryHelper(IotBulb.LIGHT_SERVICE, 'get_default_behavior');
        
    const soft = new TurnOnBehavior(response.soft_on.mode, {
      preset: response.soft_on.index,
      brightness: response.soft_on.brightness,
      colorTemp: response.soft_on.color_temp,
      hue: response.soft_on.hue,
      saturation: response.soft_on.saturation
    });
        
    const hard = new TurnOnBehavior(response.hard_on.mode, {
      preset: response.hard_on.index,
      brightness: response.hard_on.brightness,
      colorTemp: response.hard_on.color_temp,
      hue: response.hard_on.hue,
      saturation: response.hard_on.saturation
    });

    return new TurnOnBehaviors(soft, hard);
  }

  /**
     * Set turn-on behaviors.
     * @param {TurnOnBehaviors} behaviors - Turn on behaviors
     * @returns {Promise<Object>} Command result
     */
  async setTurnOnBehaviors(behaviors) {
    const parameters = {
      soft_on: behaviors.soft.toDict(),
      hard_on: behaviors.hard.toDict()
    };
        
    return this._queryHelper(IotBulb.LIGHT_SERVICE, 'set_default_behavior', parameters);
  }
}

