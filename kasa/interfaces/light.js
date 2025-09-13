/**
 * Interact with a TPLink Light.
 *
 * @example
 * import { Discover, Module } from 'node-kasa';
 * 
 * const dev = await Discover.discoverSingle(
 *     "127.0.0.3",
 *     { username: "user@example.com", password: "great_password" }
 * );
 * await dev.update();
 * console.log(dev.alias);
 * // Living Room Bulb
 *
 * // Lights, like any other supported devices, can be turned on and off:
 * console.log(dev.isOn);
 * await dev.turnOn();
 * await dev.update();
 * console.log(dev.isOn);
 * // true
 *
 * // Get the light module to interact:
 * const light = dev.modules.get(Module.Light);
 *
 * // You can use the hasFeature() method to check for supported features:
 * console.log(light.hasFeature("brightness"));
 * // true
 * console.log(light.hasFeature("hsv"));
 * // true
 * console.log(light.hasFeature("color_temp"));
 * // true
 *
 * // All known bulbs support changing the brightness:
 * console.log(light.brightness);
 * // 100
 * await light.setBrightness(50);
 * await dev.update();
 * console.log(light.brightness);
 * // 50
 *
 * // Bulbs supporting color temperature can be queried for the supported range:
 * const colorTempFeature = light.getFeature("color_temp");
 * if (colorTempFeature) {
 *     console.log(`${colorTempFeature.minimumValue}, ${colorTempFeature.maximumValue}`);
 *     // 2500, 6500
 * }
 * await light.setColorTemp(3000);
 * await dev.update();
 * console.log(light.colorTemp);
 * // 3000
 *
 * // Color bulbs can be adjusted by passing hue, saturation and value:
 * await light.setHsv(180, 100, 80);
 * await dev.update();
 * console.log(light.hsv);
 * // HSV(hue=180, saturation=100, value=80)
 */

import { KasaException } from '../exceptions.js';
import { Module, FeatureAttribute } from '../module.js';

/**
 * Class for smart light preset info.
 */
export class LightState {
  /**
   * Create a new LightState.
   * @param {Object} options - Light state options
   * @param {boolean|null} [options.lightOn] - Light on/off state
   * @param {number|null} [options.brightness] - Brightness value
   * @param {number|null} [options.hue] - Hue value
   * @param {number|null} [options.saturation] - Saturation value
   * @param {number|null} [options.colorTemp] - Color temperature
   * @param {number|null} [options.transition] - Transition duration
   */
  constructor({
    lightOn = null,
    brightness = null,
    hue = null,
    saturation = null,
    colorTemp = null,
    transition = null
  } = {}) {
    this.lightOn = lightOn;
    this.brightness = brightness;
    this.hue = hue;
    this.saturation = saturation;
    this.colorTemp = colorTemp;
    this.transition = transition;
  }
}

/**
 * Color temperature range.
 */
export class ColorTempRange {
  /**
   * Create a new ColorTempRange.
   * @param {number} min - Minimum temperature
   * @param {number} max - Maximum temperature
   */
  constructor(min, max) {
    this.min = min;
    this.max = max;
  }
}

/**
 * Hue-saturation-value.
 */
export class HSV {
  /**
   * Create a new HSV.
   * @param {number} hue - Hue in degrees
   * @param {number} saturation - Saturation percentage
   * @param {number} value - Value percentage
   */
  constructor(hue, saturation, value) {
    this.hue = hue;
    this.saturation = saturation;
    this.value = value;
  }

  toString() {
    return `HSV(hue=${this.hue}, saturation=${this.saturation}, value=${this.value})`;
  }
}

/**
 * Base class for TP-Link Light.
 * @abstract
 */
export class Light extends Module {
  /**
   * Return the current HSV state of the bulb.
   * 
   * @returns {HSV} hue, saturation and value (degrees, %, %)
   * @abstract
   */
  get hsv() {
    throw new Error('Abstract property \'hsv\' must be implemented by subclass');
  }

  /**
   * Whether the bulb supports color temperature changes.
   * @returns {number} Color temperature in Kelvin
   * @abstract
   */
  get colorTemp() {
    throw new Error('Abstract property \'colorTemp\' must be implemented by subclass');
  }

  /**
   * Return the current brightness in percentage.
   * @returns {number} Brightness percentage
   * @abstract
   */
  get brightness() {
    throw new Error('Abstract property \'brightness\' must be implemented by subclass');
  }

  /**
   * Set new HSV.
   *
   * Note, transition is not supported and will be ignored.
   *
   * @param {number} hue - hue in degrees
   * @param {number} saturation - saturation in percentage [0,100]
   * @param {number|null} [value] - value in percentage [0, 100]
   * @param {Object} options - Additional options
   * @param {number|null} [options.transition] - transition in milliseconds.
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setHsv(hue, saturation, value = null, { transition = null } = {}) {
    throw new Error('Abstract method \'setHsv\' must be implemented by subclass');
  }

  /**
   * Set the color temperature of the device in kelvin.
   *
   * Note, transition is not supported and will be ignored.
   *
   * @param {number} temp - The new color temperature, in Kelvin
   * @param {Object} options - Additional options
   * @param {number|null} [options.brightness] - brightness to set
   * @param {number|null} [options.transition] - transition in milliseconds.
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setColorTemp(temp, { brightness = null, transition = null } = {}) {
    throw new Error('Abstract method \'setColorTemp\' must be implemented by subclass');
  }

  /**
   * Set the brightness in percentage.
   *
   * Note, transition is not supported and will be ignored.
   *
   * @param {number} brightness - brightness in percent
   * @param {Object} options - Additional options
   * @param {number|null} [options.transition] - transition in milliseconds.
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setBrightness(brightness, { transition = null } = {}) {
    throw new Error('Abstract method \'setBrightness\' must be implemented by subclass');
  }

  /**
   * Return the current light state.
   * @returns {LightState} Current light state
   * @abstract
   */
  get state() {
    throw new Error('Abstract property \'state\' must be implemented by subclass');
  }

  /**
   * Set the light state.
   * @param {LightState} state - New light state
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setState(state) {
    throw new Error('Abstract method \'setState\' must be implemented by subclass');
  }

  /**
   * Get deprecated valid temperature range.
   * @returns {ColorTempRange} Temperature range
   * @private
   */
  _deprecatedValidTemperatureRange() {
    const temp = this.getFeature('color_temp');
    if (!temp) {
      throw new KasaException('Color temperature not supported');
    }
    return new ColorTempRange(temp.minimumValue, temp.maximumValue);
  }

  /**
   * Map deprecated attributes to new feature names.
   * @param {string} depName - Deprecated attribute name
   * @returns {string|null} New feature name or null
   * @private
   */
  _deprecatedAttributes(depName) {
    const map = {
      'isColor': 'hsv',
      'isDimmable': 'brightness',
      'isVariableColorTemp': 'color_temp',
    };
    return map[depName] || null;
  }

  /**
   * Handle deprecated attribute access.
   * @param {string} name - Attribute name
   * @returns {*} Attribute value
   */
  __getattr(name) {
    if (name === 'validTemperatureRange') {
      return this._deprecatedValidTemperatureRange();
    }

    if (name === 'hasEffects') {
      return Module.LightEffect in this._device.modules;
    }

    const attr = this._deprecatedAttributes(name);
    if (attr) {
      return this.hasFeature(attr);
    }

    throw new Error(`Light module has no attribute '${name}'`);
  }
}

// Add FeatureAttribute metadata to methods that should be bound to features
// Get property descriptors to avoid triggering getters
const lightProto = Light.prototype;

// For getters, we need to get the descriptor from the prototype
const hsvDescriptor = Object.getOwnPropertyDescriptor(lightProto, 'hsv');
if (hsvDescriptor && hsvDescriptor.get) {
  hsvDescriptor.get._featureAttribute = new FeatureAttribute();
}

const colorTempDescriptor = Object.getOwnPropertyDescriptor(lightProto, 'colorTemp');
if (colorTempDescriptor && colorTempDescriptor.get) {
  colorTempDescriptor.get._featureAttribute = new FeatureAttribute();
}

const brightnessDescriptor = Object.getOwnPropertyDescriptor(lightProto, 'brightness');  
if (brightnessDescriptor && brightnessDescriptor.get) {
  brightnessDescriptor.get._featureAttribute = new FeatureAttribute();
}

// For methods, we can access them directly
if (lightProto.setHsv) {
  lightProto.setHsv._featureAttribute = new FeatureAttribute();
}
if (lightProto.setColorTemp) {
  lightProto.setColorTemp._featureAttribute = new FeatureAttribute();
}
if (lightProto.setBrightness) {
  lightProto.setBrightness._featureAttribute = new FeatureAttribute();
}