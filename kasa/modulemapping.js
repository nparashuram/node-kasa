/**
 * Module for Implementation for ModuleMapping and ModuleName types.
 * 
 * Custom classes for getting typed modules from the module dict.
 */

/**
 * Generic Module name type.
 * 
 * In JavaScript, this is implemented as a string class with additional metadata.
 * At runtime this is a subclass of String with type information.
 * 
 * @template T - The module type this name refers to
 */
export class ModuleName extends String {
  /**
   * Create a new ModuleName.
   * @param {string} name - The module name
   * @param {Function} [moduleClass] - Optional module class for type checking
   */
  constructor(name, moduleClass = null) {
    super(name);
    this._moduleClass = moduleClass;
  }

  /**
   * Get the module class associated with this name.
   * @returns {Function|null} Module class or null
   */
  get moduleClass() {
    return this._moduleClass;
  }

  /**
   * Check if a module instance matches this name's expected type.
   * @param {*} module - Module instance to check
   * @returns {boolean} True if module matches expected type
   */
  isValidModule(module) {
    if (!this._moduleClass) {
      return true; // No type constraint
    }
    return module instanceof this._moduleClass;
  }

  /**
   * String representation of the module name.
   * @returns {string} The module name
   */
  toString() {
    return super.toString();
  }

  /**
   * JSON representation of the module name.
   * @returns {string} The module name
   */
  toJSON() {
    return this.toString();
  }

  /**
   * Create a typed module name.
   * @template T
   * @param {string} name - The module name
   * @param {Function} moduleClass - The module class
   * @returns {ModuleName<T>} Typed module name
   */
  static typed(name, moduleClass) {
    return new ModuleName(name, moduleClass);
  }
}

/**
 * Enhanced Map for storing modules with type-safe access.
 * 
 * This provides similar functionality to Python's custom dict for getting
 * typed modules from the module dictionary.
 * 
 * @template K, V - Key and value types
 */
export class ModuleMapping extends Map {
  /**
   * Create a new ModuleMapping.
   * @param {Iterable<[K, V]>} [iterable] - Initial entries
   */
  constructor(iterable) {
    super(iterable);
  }

  /**
   * Get a module with type checking.
   * @param {ModuleName<T>|string} key - Module name (typed or string)
   * @returns {T|undefined} Module instance or undefined
   * @template T
   */
  get(key) {
    const module = super.get(key.toString ? key.toString() : key);
    
    // If key is a ModuleName, validate the type
    if (key instanceof ModuleName && module && !key.isValidModule(module)) {
      // Module type mismatch - silently continue
    }
    
    return module;
  }

  /**
   * Set a module with optional type validation.
   * @param {ModuleName<T>|string} key - Module name (typed or string)
   * @param {T} value - Module instance
   * @returns {ModuleMapping} This mapping for chaining
   * @template T
   */
  set(key, value) {
    const keyString = key.toString ? key.toString() : key;
    
    // If key is a ModuleName, validate the type
    if (key instanceof ModuleName && !key.isValidModule(value)) {
      throw new Error(
        `Module ${key} expected type ${key.moduleClass?.name || 'unknown'} ` +
        `but got ${value.constructor.name}`
      );
    }
    
    return super.set(keyString, value);
  }

  /**
   * Check if a module exists.
   * @param {ModuleName<T>|string} key - Module name (typed or string)  
   * @returns {boolean} True if module exists
   * @template T
   */
  has(key) {
    return super.has(key.toString ? key.toString() : key);
  }

  /**
   * Delete a module.
   * @param {ModuleName<T>|string} key - Module name (typed or string)
   * @returns {boolean} True if module was deleted
   * @template T
   */
  delete(key) {
    return super.delete(key.toString ? key.toString() : key);
  }

  /**
   * Get all modules of a specific type.
   * @param {Function} moduleClass - Module class to filter by
   * @returns {Array<T>} Array of modules matching the type
   * @template T
   */
  getByType(moduleClass) {
    const result = [];
    for (const module of this.values()) {
      if (module instanceof moduleClass) {
        result.push(module);
      }
    }
    return result;
  }

  /**
   * Get all module names of a specific type.
   * @param {Function} moduleClass - Module class to filter by
   * @returns {Array<string>} Array of module names matching the type
   */
  getNamesByType(moduleClass) {
    const result = [];
    for (const [name, module] of this.entries()) {
      if (module instanceof moduleClass) {
        result.push(name);
      }
    }
    return result;
  }

  /**
   * Create a filtered view of modules matching a predicate.
   * @param {Function} predicate - Function to test each module
   * @returns {ModuleMapping} New mapping with filtered modules
   */
  filter(predicate) {
    const result = new ModuleMapping();
    for (const [name, module] of this.entries()) {
      if (predicate(module, name)) {
        result.set(name, module);
      }
    }
    return result;
  }

  /**
   * Convert to a plain object.
   * @returns {Object} Plain object representation
   */
  toObject() {
    const result = {};
    for (const [key, value] of this.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Create a ModuleMapping from a plain object.
   * @param {Object} obj - Plain object to convert
   * @returns {ModuleMapping} New module mapping
   */
  static fromObject(obj) {
    return new ModuleMapping(Object.entries(obj));
  }
}