/**
 * Interact with modules.
 *
 * Modules are implemented by devices to encapsulate sets of functionality like
 * Light, AutoOff, Firmware etc.
 *
 * @example
 * import { Discover, Module } from 'node-kasa';
 * 
 * const dev = await Discover.discoverSingle(
 *   "127.0.0.3",
 *   { username: "user@example.com", password: "great_password" }
 * );
 * await dev.update();
 * console.log(dev.alias);
 * // Living Room Bulb
 * 
 * // To see whether a device supports a group of functionality
 * // check for the existence of the module:
 * const light = dev.modules.get("Light");
 * if (light) {
 *   console.log(light.brightness);
 *   // 100
 * }
 * 
 * // To see whether a device supports specific functionality, you can check whether the
 * // module has that feature:
 * if (light.hasFeature("hsv")) {
 *   console.log(light.hsv);
 *   // HSV(hue=0, saturation=100, value=100)
 * }
 * 
 * // If you know or expect the module to exist you can access by index:
 * const lightPreset = dev.modules["LightPreset"];
 * console.log(lightPreset.presetList);
 * // ['Not set', 'Light preset 1', 'Light preset 2', ...]
 */

import { KasaException } from './exceptions.js';
import { Feature } from './feature.js';

/**
 * Class for annotating attributes bound to feature.
 */
export class FeatureAttribute {
  /**
   * Create a new FeatureAttribute.
   * @param {string|null} [featureName] - Optional feature name
   */
  constructor(featureName = null) {
    this.featureName = featureName;
  }

  toString() {
    return 'FeatureAttribute';
  }
}

/**
 * Base class implementation for all modules.
 *
 * The base classes should implement `query` to return the query they want to be
 * executed during the regular update cycle.
 */
export class Module {
  // Common Modules
  static Alarm = 'Alarm';
  static ChildSetup = 'ChildSetup';
  static Energy = 'Energy';
  static Fan = 'Fan';
  static LightEffect = 'LightEffect';
  static Led = 'Led';
  static Light = 'Light';
  static LightPreset = 'LightPreset';
  static Thermostat = 'Thermostat';
  static Time = 'Time';

  // IOT only Modules
  static IotAmbientLight = 'ambient';
  static IotAntitheft = 'anti_theft';
  static IotCountdown = 'countdown';
  static IotDimmer = 'dimmer';
  static IotMotion = 'motion';
  static IotSchedule = 'schedule';
  static IotUsage = 'usage';
  static IotCloud = 'cloud';

  // SMART only Modules
  static AutoOff = 'AutoOff';
  static BatterySensor = 'BatterySensor';
  static Brightness = 'Brightness';
  static ChildDevice = 'ChildDevice';
  static Cloud = 'Cloud';
  static Color = 'Color';
  static ColorTemperature = 'ColorTemperature';
  static ContactSensor = 'ContactSensor';
  static DeviceModule = 'DeviceModule';
  static Firmware = 'Firmware';
  static FrostProtection = 'FrostProtection';
  static HumiditySensor = 'HumiditySensor';
  static LightTransition = 'LightTransition';
  static MotionSensor = 'MotionSensor';
  static ReportMode = 'ReportMode';
  static SmartLightEffect = 'LightEffect';
  static IotLightEffect = 'LightEffect';
  static TemperatureSensor = 'TemperatureSensor';
  static TemperatureControl = 'TemperatureControl';
  static WaterleakSensor = 'WaterleakSensor';
  static ChildProtection = 'ChildProtection';
  static ChildLock = 'ChildLock';
  static TriggerLogs = 'TriggerLogs';
  static PowerProtection = 'PowerProtection';
  static HomeKit = 'HomeKit';
  static Matter = 'Matter';

  // SMARTCAM only modules
  static Camera = 'Camera';
  static LensMask = 'LensMask';

  // Vacuum modules
  static Clean = 'Clean';
  static Consumables = 'Consumables';
  static Dustbin = 'Dustbin';
  static Speaker = 'Speaker';
  static Mop = 'Mop';
  static CleanRecords = 'CleanRecords';

  /**
   * Create a new Module instance.
   * @param {Device} device - The device instance
   * @param {string} module - The module name
   */
  constructor(device, module) {
    this._device = device;
    this._module = module;
    this._moduleFeatures = {};
  }

  /**
   * Return the device exposing the module.
   * @returns {Device} The device instance
   */
  get device() {
    return this._device;
  }

  /**
   * Get the features for this module and any sub modules.
   * @returns {Object<string, Feature>} Feature map
   */
  get _allFeatures() {
    return this._moduleFeatures;
  }

  /**
   * Return True if the module attribute feature is supported.
   * @param {string|Function} attribute - The attribute to check
   * @returns {boolean} True if feature is supported
   */
  hasFeature(attribute) {
    return this.getFeature(attribute) !== null;
  }

  /**
   * Get Feature for a module attribute or null if not supported.
   * @param {string|Function} attribute - The attribute to get feature for
   * @returns {Feature|null} The feature or null
   */
  getFeature(attribute) {
    return _getBoundFeature(this, attribute);
  }

  /**
   * Query to execute during the update cycle.
   *
   * The inheriting modules implement this to include their wanted
   * queries to the query that gets executed when Device.update() gets called.
   * @abstract
   * @returns {Object} The query object
   */
  query() {
    throw new Error('Abstract method \'query\' must be implemented by subclass');
  }

  /**
   * Return the module specific raw data from the last update.
   * @abstract
   * @returns {Object} The raw data
   */
  get data() {
    throw new Error('Abstract property \'data\' must be implemented by subclass');
  }

  /**
   * Initialize features after the initial update.
   *
   * This can be implemented if features depend on module query responses.
   * It will only be called once per module and will always be called
   * after _postUpdateHook has been called for every device module and its
   * children's modules.
   */
  _initializeFeatures() {
    // Default implementation - can be overridden by subclasses
  }

  /**
   * Perform actions after a device update.
   *
   * This can be implemented if a module needs to perform actions each time
   * the device has updated like generating collections for property access.
   * It will be called after every update and will be called prior to
   * _initializeFeatures on the first update.
   * @returns {Promise<void>}
   */
  async _postUpdateHook() {
    // Default implementation - can be overridden by subclasses
  }

  /**
   * Add module feature.
   * @param {Feature} feature - The feature to add
   */
  _addFeature(feature) {
    const id = feature.id;
    if (id in this._moduleFeatures) {
      throw new KasaException(`Duplicate id detected ${id}`);
    }
    this._moduleFeatures[id] = feature;
  }

  /**
   * String representation of the module.
   * @returns {string} String representation
   */
  toString() {
    return `<Module ${this.constructor.name} (${this._module}) for ${this._device.host}>`;
  }
}

/**
 * Check if an attribute is bound to a feature with FeatureAttribute.
 * @param {Function} attribute - The attribute function
 * @returns {FeatureAttribute|null} The feature attribute or null
 */
function _getFeatureAttribute(attribute) {
  // In JavaScript, we'll use a convention where functions with a _featureAttribute
  // property are considered bound to features
  if (typeof attribute === 'function' && attribute._featureAttribute) {
    return attribute._featureAttribute;
  }
  
  // Check if it's a property descriptor with feature metadata
  if (attribute && typeof attribute === 'object' && attribute._featureAttribute) {
    return attribute._featureAttribute;
  }

  return null;
}

/**
 * Cache for bound features to avoid repeated lookups.
 * @type {WeakMap<Module, Map<string|Function, Feature|null>>}
 */
const _boundFeatureCache = new WeakMap();

/**
 * Get Feature for a bound property or null if not supported.
 * @param {Module} module - The module instance
 * @param {string|Function} attribute - The attribute name or function
 * @returns {Feature|null} The feature or null
 */
function _getBoundFeature(module, attribute) {
  // Get or create cache for this module
  let moduleCache = _boundFeatureCache.get(module);
  if (!moduleCache) {
    moduleCache = new Map();
    _boundFeatureCache.set(module, moduleCache);
  }

  // Check cache first
  if (moduleCache.has(attribute)) {
    return moduleCache.get(attribute);
  }

  let attributeName;
  let attributeCallable;

  if (typeof attribute !== 'string') {
    if (typeof attribute === 'function') {
      attributeName = attribute.name;
    } else {
      throw new KasaException(`Invalid attribute type: ${typeof attribute}`);
    }
    attributeCallable = attribute;
  } else {
    attributeName = attribute;
    // Try to get the method/property from the module class
    attributeCallable = module.constructor.prototype[attribute] || module[attribute];
    
    if (!attributeCallable) {
      const error = new KasaException(
        `No attribute named ${attributeName} in module ${module.constructor.name}`
      );
      moduleCache.set(attribute, null);
      throw error;
    }
  }

  const fa = _getFeatureAttribute(attributeCallable);
  if (!fa) {
    const error = new KasaException(
      `Attribute ${attributeName} of module ${module.constructor.name} is not bound to a feature`
    );
    moduleCache.set(attribute, null);
    throw error;
  }

  let result = null;

  // If a feature_name was passed to the FeatureAttribute use that to check
  // for the feature. Otherwise check the getters and setters in the features
  if (fa.featureName) {
    result = module._allFeatures[fa.featureName] || null;
  } else {
    const check = new Set([attributeName, attributeCallable]);
    
    for (const feature of Object.values(module._allFeatures)) {
      const getter = feature.attributeGetter;
      if (getter && check.has(getter)) {
        result = feature;
        break;
      }

      const setter = feature.attributeSetter;
      if (setter && check.has(setter)) {
        result = feature;
        break;
      }
    }
  }

  // Cache the result
  moduleCache.set(attribute, result);
  return result;
}