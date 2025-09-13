/**
 * JSON abstraction.
 * 
 * This module provides a unified interface for JSON operations,
 * with optional fast JSON parsing/serialization support.
 */

let fastJSON = null;

// Try to use fast JSON library if available
try {
  // Try different fast JSON libraries in order of preference
  try {
    fastJSON = require('@msgpack/msgpack'); // Fast binary JSON
  } catch {
    try {
      fastJSON = require('json-fast-stringify'); // Fast stringify
    } catch {
      // Fall back to native JSON
      fastJSON = null;
    }
  }
} catch {
  // If require fails (e.g., in ESM), use native JSON
  fastJSON = null;
}

/**
 * Dump JavaScript object to JSON string.
 * @param {*} obj - Object to serialize
 * @param {Object} options - Serialization options
 * @param {Function|null} [options.default] - Default function for non-serializable objects
 * @param {boolean} [options.indent=false] - Whether to indent the output
 * @returns {string} JSON string
 */
export function dumps(obj, { default: defaultFn = null, indent = false } = {}) {
  if (fastJSON && fastJSON.stringify) {
    return fastJSON.stringify(obj, indent ? 2 : 0);
  }
  
  // Use native JSON with consistent separators for compatibility
  return JSON.stringify(obj, defaultFn, indent ? 2 : undefined);
}

/**
 * Load JavaScript object from JSON string.
 * @param {string} str - JSON string to parse
 * @returns {*} Parsed JavaScript object
 */
export function loads(str) {
  if (fastJSON && fastJSON.parse) {
    return fastJSON.parse(str);
  }
  
  return JSON.parse(str);
}

/**
 * Base class for objects that can be serialized to/from JSON.
 * This provides a JavaScript equivalent to Python's dataclass JSON mixins.
 */
export class DataClassJSONMixin {
  /**
   * Serialize this object to JSON string.
   * @param {boolean} [indent=false] - Whether to indent the output
   * @returns {string} JSON string
   */
  toJson(indent = false) {
    return dumps(this.toDict(), { indent });
  }

  /**
   * Convert this object to a plain JavaScript object.
   * Override this method in subclasses to customize serialization.
   * @returns {Object} Plain JavaScript object
   */
  toDict() {
    const result = {};
    
    // Get all enumerable properties
    for (const [key, value] of Object.entries(this)) {
      // Skip private properties (starting with _)
      if (key.startsWith('_')) continue;
      
      if (value !== undefined) {
        if (value && typeof value.toDict === 'function') {
          // Nested DataClassJSONMixin
          result[key] = value.toDict();
        } else if (Array.isArray(value)) {
          // Handle arrays
          result[key] = value.map(item => 
            item && typeof item.toDict === 'function' ? item.toDict() : item
          );
        } else if (value instanceof Map) {
          // Handle Maps
          result[key] = Object.fromEntries(value);
        } else if (value instanceof Set) {
          // Handle Sets
          result[key] = Array.from(value);
        } else {
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  /**
   * Create an instance from a JSON string.
   * @param {string} json - JSON string
   * @returns {DataClassJSONMixin} New instance
   */
  static fromJson(json) {
    const data = loads(json);
    return this.fromDict(data);
  }

  /**
   * Create an instance from a plain JavaScript object.
   * Override this method in subclasses to customize deserialization.
   * @param {Object} data - Plain JavaScript object
   * @returns {DataClassJSONMixin} New instance
   */
  static fromDict(data) {
    const instance = new this();
    
    for (const [key, value] of Object.entries(data)) {
      instance[key] = value;
    }
    
    return instance;
  }

  /**
   * Deep clone this object via JSON serialization.
   * @returns {DataClassJSONMixin} Cloned instance
   */
  clone() {
    return this.constructor.fromDict(this.toDict());
  }

  /**
   * Compare this object with another for equality based on their serialized form.
   * @param {*} other - Other object to compare
   * @returns {boolean} True if objects are equal
   */
  equals(other) {
    if (!(other instanceof this.constructor)) {
      return false;
    }
    
    try {
      return this.toJson() === other.toJson();
    } catch {
      return false;
    }
  }
}

// Default export the mixin class for convenience
export default DataClassJSONMixin;