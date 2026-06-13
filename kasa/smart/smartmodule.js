/**
 * Base implementation for SMART modules.
 */

import { DeviceError, KasaException, SmartErrorCode } from '../exceptions.js';
import { Module } from '../module.js';

const _LOGGER = console; // Simple logger replacement

/**
 * Define a wrapper to set _lastUpdateTime to null.
 * This will ensure that a module is updated in the next update cycle after
 * a value has been changed.
 * @param {Function} target - The target method
 * @param {string} propertyKey - The property key
 * @param {PropertyDescriptor} descriptor - The property descriptor
 * @returns {PropertyDescriptor} The decorated descriptor
 */
export function allowUpdateAfter(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args) {
    try {
      return await originalMethod.apply(this, args);
    } finally {
      this._lastUpdateTime = null;
    }
  };

  return descriptor;
}

/**
 * Define a wrapper to raise an error if the last module update was an error.
 * @param {Function} target - The target method
 * @param {string} propertyKey - The property key
 * @param {PropertyDescriptor} descriptor - The property descriptor
 * @returns {PropertyDescriptor} The decorated descriptor
 */
export function raiseIfUpdateError(target, propertyKey, descriptor) {
  const originalMethod = descriptor.get || descriptor.value;

  if (descriptor.get) {
    descriptor.get = function () {
      if (this._lastUpdateError) {
        throw this._lastUpdateError;
      }
      return originalMethod.apply(this);
    };
  } else {
    descriptor.value = function (...args) {
      if (this._lastUpdateError) {
        throw this._lastUpdateError;
      }
      return originalMethod.apply(this, args);
    };
  }

  return descriptor;
}

/**
 * Base class for SMART modules.
 */
export class SmartModule extends Module {
  // Static properties that can be overridden by subclasses
  static NAME = '';
  static REQUIRED_COMPONENT = null;
  static SYSINFO_LOOKUP_KEYS = [];
  static QUERY_GETTER_NAME = '';
  static REGISTERED_MODULES = {};
    
  static MINIMUM_UPDATE_INTERVAL_SECS = 0;
  static MINIMUM_HUB_CHILD_UPDATE_INTERVAL_SECS = 60 * 60 * 24;
  static UPDATE_INTERVAL_AFTER_ERROR_SECS = 30;
  static DISABLE_AFTER_ERROR_COUNT = 10;

  /**
     * Create a SmartModule instance.
     * @param {SmartDevice} device - The device instance
     * @param {string} module - Module name
     */
  constructor(device, module) {
    super(device, module);
    this._lastUpdateTime = null;
    this._lastUpdateError = null;
    this._errorCount = 0;
    this._loggedRemoveKeys = [];
  }

  /**
     * Register a module class.
     * @param {Function} cls - Module class to register
     * @static
     */
  static registerModule(cls) {
    SmartModule.REGISTERED_MODULES[cls._moduleName()] = cls;
  }

  /**
     * Get the module name.
     * @returns {string} Module name
     * @static
     */
  static _moduleName() {
    return this.NAME || this.name.toLowerCase();
  }

  /**
     * Set error state for the module.
     * @param {Error|null} err - Error or null to clear
     * @private
     */
  _setError(err) {
    if (err === null) {
      this._errorCount = 0;
      this._lastUpdateError = null;
    } else {
      this._lastUpdateError = new KasaException('Module update error', err);
      this._errorCount++;
            
    }
  }

  /**
     * Return True if the module is available.
     * @returns {boolean} Is available
     */
  get isAvailable() {
    if (this._errorCount >= SmartModule.DISABLE_AFTER_ERROR_COUNT) {
      return false;
    }
    return true;
  }

  /**
     * Check if module is supported by the device.
     * @param {SmartDevice} device - Device instance
     * @returns {boolean} Is supported
     */
  static isSupported(device) {
    const cls = this;
        
    // Check for required component
    if (cls.REQUIRED_COMPONENT) {
      if (!(cls.REQUIRED_COMPONENT in device._components)) {
        return false;
      }
    }

    // Check for sysinfo lookup keys
    if (cls.SYSINFO_LOOKUP_KEYS && cls.SYSINFO_LOOKUP_KEYS.length > 0) {
      const sysInfo = device.sysInfo;
      return cls.SYSINFO_LOOKUP_KEYS.some(key => key in sysInfo);
    }

    return true;
  }

  /**
     * Execute module query.
     * @param {string} req - Request name
     * @param {Object|null} [args=null] - Request arguments
     * @returns {Promise<Object>} Query result
     */
  async call(req, args = null) {
    try {
      const result = await this._device.protocol.query({ [req]: args });
            
      if (result[req] instanceof SmartErrorCode) {
        const err = new DeviceError(
          `Error ${result[req]} calling ${req}`,
          result[req]
        );
        this._setError(err);
        throw err;
      }
            
      this._setError(null);
      return result[req];
    } catch (error) {
      this._setError(error);
      throw error;
    }
  }

  /**
     * Query to execute during the main update cycle.
     * @returns {Object|null} Query object or null
     */
  query() {
    if (this.constructor.QUERY_GETTER_NAME) {
      return { [this.constructor.QUERY_GETTER_NAME]: null };
    }
    return null;
  }

  /**
     * Process module update.
     * @param {Object} data - Update data
     * @returns {Promise<void>}
     */
  async update(data) {
    // Default implementation - can be overridden by subclasses
    this._lastUpdateTime = Date.now();
  }

  /**
     * Return response data for the module.
     */
  get data() {
    const dev = this._device;
    const q = this.query();

    if (!q) {
      return dev.sysInfo;
    }

    const qKeys = Object.keys(q);
    const queryKey = qKeys[0];

    if (!(queryKey in dev._lastUpdate)) {
      if (dev.parent && queryKey in dev.parent._lastUpdate) {
        // Fallback to parent if needed
        return dev.parent._lastUpdate;
      } else {
        throw new KasaException(
          `You need to call update() prior accessing module data for '${this._module}'`
        );
      }
    }

    const filteredData = {};
    for (const k of qKeys) {
      if (k in dev._lastUpdate) {
        filteredData[k] = dev._lastUpdate[k];
      }
    }

    const removeKeys = [];
    for (const key of Object.keys(filteredData)) {
      if (filteredData[key] instanceof SmartErrorCode) {
        if (this.optionalResponseKeys && this.optionalResponseKeys.includes(key)) {
          removeKeys.push(key);
        } else {
          throw new DeviceError(
            `${key} for ${this.name}`,
            filteredData[key]
          );
        }
      }
    }

    for (const key of removeKeys) {
      delete filteredData[key];
    }

    if (Object.keys(filteredData).length === 1 && removeKeys.length === 0) {
      return Object.values(filteredData)[0];
    }

    return filteredData;
  }

  /**
     * Return optional response keys for the module.
     */
  get optionalResponseKeys() {
    return [];
  }

  /**
     * Return version supported by the device.
     */
  get supportedVersion() {
    if (this.constructor.REQUIRED_COMPONENT !== null) {
      return this._device._components[this.constructor.REQUIRED_COMPONENT] || -1;
    }
    return -1;
  }

  /**
     * Additional check to see if the module is supported by the device.
     */
  async _checkSupported() {
    return true;
  }

  /**
     * Return True if there is a data error.
     */
  _hasDataError() {
    try {
      return !this.data;
    } catch (e) {
      return true;
    }
  }

  /**
     * Return the estimated query response size.
     * @returns {number} Estimated size
     */
  get estimatedQueryResponseSize() {
    return 512; // Default estimate
  }

  /**
     * Return the name of the module.
     * @returns {string} Module name
     */
  get name() {
    return this.constructor.NAME || this.constructor.name;
  }
}
