/**
 * Base implementation for SMART camera modules.
 */

import { DeviceError, KasaException, SmartErrorCode } from '../exceptions.js';
import { SmartModule } from '../smart/smartmodule.js';

const _LOGGER = console; // Simple logger replacement

/**
 * Base class for SMARTCAM modules.
 * 
 * SmartCam modules extend SmartModule but provide camera-specific functionality
 * and module definitions.
 */
export class SmartCamModule extends SmartModule {
  // Module name constants for smart cameras
  static SmartCamAlarm = 'SmartCamAlarm';
  static SmartCamMotionDetection = 'MotionDetection';
  static SmartCamPersonDetection = 'PersonDetection';
  static SmartCamPetDetection = 'PetDetection';
  static SmartCamTamperDetection = 'TamperDetection';
  static SmartCamBabyCryDetection = 'BabyCryDetection';
  static SmartCamLineCrossingDetection = 'LineCrossingDetection';
  static SmartCamBarkDetection = 'BarkDetection';
  static SmartCamGlassDetection = 'GlassDetection';
  static SmartCamMeowDetection = 'MeowDetection';
  static SmartCamVehicleDetection = 'VehicleDetection';
  static SmartCamLensMask = 'LensMask';
  static SmartCamPanTilt = 'PanTilt';
  static SmartCamCamera = 'Camera';
  static SmartCamBattery = 'Battery';
  static SmartCamLed = 'Led';
  static SmartCamHomekit = 'Homekit';
  static SmartCamMatter = 'Matter';
  static SmartCamTime = 'Time';
  static SmartCamChildSetup = 'ChildSetup';
  static SmartCamChildDevice = 'ChildDevice';
  static SmartCamDevice = 'Device';

  // Registry for SmartCam modules
  static REGISTERED_MODULES = {};

  /**
     * Create a SmartCamModule instance.
     * @param {SmartCamDevice} device - The camera device instance
     * @param {string} module - Module name
     */
  constructor(device, module) {
    super(device, module);
    this._device = device; // Ensure type is SmartCamDevice
  }

  /**
     * Register a SmartCam module class.
     * @param {Function} cls - Module class to register
     * @static
     */
  static registerModule(cls) {
    SmartCamModule.REGISTERED_MODULES[cls._moduleName()] = cls;
  }

  /**
     * Check if the module is supported by the device.
     * This can be overridden by subclasses for more specific checks.
     * @returns {Promise<boolean>} True if supported
     * @protected
     */
  async _checkSupported() {
    // Default implementation - subclasses can override
    return this.constructor.isSupported ? this.constructor.isSupported(this._device) : true;
  }

  /**
     * Initialize module features.
     * This can be overridden by subclasses to add module-specific features.
     * @protected
     */
  _initializeFeatures() {
    this._moduleFeatures = this._moduleFeatures || {};
    // Default implementation - subclasses can add specific features
  }

  /**
     * Execute a camera-specific query with module and section structure.
     * @param {string} method - Method name (e.g., "setLensMaskConfig")
     * @param {string} module - Module name (e.g., "lens_mask")
     * @param {string} section - Section name (e.g., "lens_mask_info")
     * @param {Object|null} [params=null] - Parameters
     * @returns {Promise<Object>} Query result
     */
  async callCameraMethod(method, module, section, params = null) {
    return this._device._querySetterHelper(method, module, section, params);
  }

  /**
     * Get camera-specific configuration.
     * @param {string} method - Method name (e.g., "getLensMaskConfig")
     * @param {string} module - Module name (e.g., "lens_mask")
     * @returns {Promise<Object>} Configuration data
     */
  async getCameraConfig(method, module) {
    const result = await this._device.protocol.query({
      [method]: { [module]: {} }
    });
        
    if (result[method] instanceof SmartErrorCode) {
      const err = new DeviceError(
        `Error ${result[method]} calling ${method}`,
        result[method]
      );
      this._setError(err);
      throw err;
    }
        
    this._setError(null);
    return result[method];
  }

  /**
     * Set camera-specific configuration.
     * @param {string} method - Method name (e.g., "setLensMaskConfig")
     * @param {string} module - Module name (e.g., "lens_mask")
     * @param {string} section - Section name (e.g., "lens_mask_info")
     * @param {Object} params - Parameters to set
     * @returns {Promise<Object>} Set result
     */
  async setCameraConfig(method, module, section, params) {
    return this.callCameraMethod(method, module, section, params);
  }
}