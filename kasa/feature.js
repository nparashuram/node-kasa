/**
 * Interact with feature.
 *
 * Features are implemented by devices to represent individual pieces of functionality like
 * state, time, firmware.
 *
 * Features allow for introspection and can be interacted with as new features are added
 * to the API:
 *
 * @example
 * import { Discover } from 'node-kasa';
 * const dev = await Discover.discoverSingle(
 *   "127.0.0.3", 
 *   { username: "user@example.com", password: "great_password" }
 * );
 * await dev.update();
 * console.log(dev.alias);
 * // Living Room Bulb
 *
 * for (const [featureId, feature] of Object.entries(dev.features)) {
 *   console.log(`${feature.name} (${featureId}): ${feature.value}`);
 * }
 */

/**
 * Feature defines a generic interface for device features.
 */
export class Feature {
  /**
   * Type to help decide how to present the feature.
   * @readonly
   * @enum {number}
   */
  static Type = {
    /** Sensor is an informative read-only value */
    Sensor: 1,
    /** BinarySensor is a read-only boolean */
    BinarySensor: 2,
    /** Switch is a boolean setting */
    Switch: 3,
    /** Action triggers some action on device */
    Action: 4,
    /** Number defines a numeric setting */
    Number: 5,
    /** Choice defines a setting with pre-defined values */
    Choice: 6,
    Unknown: -1
  };

  // Aliases for easy access
  static Sensor = Feature.Type.Sensor;
  static BinarySensor = Feature.Type.BinarySensor;
  static Switch = Feature.Type.Switch;
  static Action = Feature.Type.Action;
  static Number = Feature.Type.Number;
  static Choice = Feature.Type.Choice;

  static DEFAULT_MAX = Math.pow(2, 16); // Arbitrary max

  /**
   * Category hint to allow feature grouping.
   * @readonly
   * @enum {number}
   */
  static Category = {
    /** Primary features control the device state directly */
    Primary: 1,
    /** Config features change device behavior without immediate state changes */
    Config: 2,
    /** Informative/sensor features deliver some potentially interesting information */
    Info: 3,
    /** Debug features deliver more verbose information than informative features */
    Debug: 4,
    /** The default category if none is specified */
    Unset: -1
  };

  /**
   * Create a new Feature instance.
   * @param {Object} params - Feature parameters
   * @param {Device} params.device - Device instance required for getting and setting values
   * @param {string} params.id - Identifier
   * @param {string} params.name - User-friendly short description
   * @param {number} params.type - Type of the feature
   * @param {string|Function} [params.attributeGetter] - Callable or name of the property that allows accessing the value
   * @param {string|Function} [params.attributeSetter] - Callable coroutine or name of the method that allows changing the value
   * @param {Device|Module} [params.container] - Container storing the data, this overrides 'device' for getters
   * @param {string} [params.icon] - Icon suggestion
   * @param {string|Function} [params.unitGetter] - Attribute containing the name of the unit getter property
   * @param {number} [params.category] - Category hint for downstreams
   * @param {number} [params.precisionHint] - Hint to help rounding the sensor values to given after-comma digits
   * @param {string|Function} [params.rangeGetter] - Attribute containing the name of the range getter property
   * @param {string|Function} [params.choicesGetter] - Attribute name of the choices getter property
   */
  constructor({
    device,
    id,
    name,
    type,
    attributeGetter = null,
    attributeSetter = null,
    container = null,
    icon = null,
    unitGetter = null,
    category = Feature.Category.Unset,
    precisionHint = null,
    rangeGetter = null,
    choicesGetter = null
  }) {
    this.device = device;
    this.id = id;
    this.name = name;
    this.type = type;
    this.attributeGetter = attributeGetter;
    this.attributeSetter = attributeSetter;
    this.container = container;
    this.icon = icon;
    this.unitGetter = unitGetter;
    this.category = category;
    this.precisionHint = precisionHint;
    this.rangeGetter = rangeGetter;
    this.choicesGetter = choicesGetter;

    // Handle late-binding of members
    this._container = this.container !== null ? this.container : this.device;

    // Set the category, if unset
    if (this.category === Feature.Category.Unset) {
      if (this.attributeSetter) {
        this.category = Feature.Category.Config;
      } else {
        this.category = Feature.Category.Info;
      }
    }

    // Validation
    if (this.type === Feature.Type.Sensor || this.type === Feature.Type.BinarySensor) {
      if (this.category === Feature.Category.Config) {
        throw new Error(
          `Invalid type for configurable feature: ${this.name} (${this.id}): ${this.type}`
        );
      }
      if (this.attributeSetter !== null) {
        throw new Error(
          `Read-only feature defines attributeSetter: ${this.name} (${this.id})`
        );
      }
    }

    // Cache for range property
    this._cachedRange = null;
  }

  /**
   * Get property value from getter.
   * @param {string|Function} getter - The getter function or property name
   * @returns {*} The property value
   */
  _getPropertyValue(getter) {
    if (getter === null) {
      return null;
    }
    if (typeof getter === 'string') {
      return this._container[getter];
    }
    if (typeof getter === 'function') {
      return getter();
    }
    throw new Error(`Invalid getter: ${getter}`);
  }

  /**
   * List of choices.
   * @returns {Array<string>|null} List of choices or null
   */
  get choices() {
    return this._getPropertyValue(this.choicesGetter);
  }

  /**
   * Unit if applicable.
   * @returns {string|null} Unit string or null
   */
  get unit() {
    return this._getPropertyValue(this.unitGetter);
  }

  /**
   * Range of values if applicable.
   * @returns {Array<number>|null} Range array [min, max] or null
   */
  get range() {
    if (this._cachedRange === null) {
      this._cachedRange = this._getPropertyValue(this.rangeGetter);
    }
    return this._cachedRange;
  }

  /**
   * Maximum value.
   * @returns {number} Maximum value
   */
  get maximumValue() {
    const range = this.range;
    if (range) {
      return range[1];
    }
    return Feature.DEFAULT_MAX;
  }

  /**
   * Minimum value.
   * @returns {number} Minimum value
   */
  get minimumValue() {
    const range = this.range;
    if (range) {
      return range[0];
    }
    return 0;
  }

  /**
   * Return the current value.
   * @returns {number|boolean|string|Object|null} The current value
   */
  get value() {
    if (this.type === Feature.Type.Action) {
      return '<Action>';
    }
    if (this.attributeGetter === null) {
      throw new Error('Not an action and no attributeGetter set');
    }

    const container = this.container !== null ? this.container : this.device;
    if (typeof this.attributeGetter === 'function') {
      return this.attributeGetter(container);
    }
    return container[this.attributeGetter];
  }

  /**
   * Set the value.
   * @param {number|boolean|string|Object|null} value - The value to set
   * @returns {Promise<*>} Promise that resolves when value is set
   */
  async setValue(value) {
    if (this.attributeSetter === null) {
      throw new Error('Tried to set read-only feature.');
    }

    if (this.type === Feature.Type.Number) {
      if (typeof value !== 'number') {
        throw new Error('value must be a number');
      }
      if (value < this.minimumValue || value > this.maximumValue) {
        throw new Error(
          `Value ${value} out of range [${this.minimumValue}, ${this.maximumValue}]`
        );
      }
    } else if (this.type === Feature.Type.Choice) {
      if (!this.choices || !this.choices.includes(value)) {
        throw new Error(
          `Unexpected value for ${this.name}: '${value}' - allowed: ${this.choices}`
        );
      }
    }

    let attributeSetter;
    if (typeof this.attributeSetter === 'function') {
      attributeSetter = this.attributeSetter;
    } else {
      const container = this.container !== null ? this.container : this.device;
      attributeSetter = container[this.attributeSetter];
    }

    if (this.type === Feature.Type.Action) {
      return await attributeSetter();
    }

    return await attributeSetter(value);
  }

  /**
   * String representation of the feature.
   * @returns {string} String representation
   */
  toString() {
    try {
      let value = this.value;
      const choices = this.choices;

      if (this.type === Feature.Type.Choice) {
        if (!Array.isArray(choices)) {
          return `${this.name} (${this.id}): improperly defined choice set.`;
        }
        
        const valueStr = typeof value === 'object' && value.name ? value.name : value;
        if (!choices.includes(value) && !choices.includes(valueStr)) {
          return `${this.name} (${this.id}): invalid value '${value}' not in ${JSON.stringify(choices)}`;
        }
        
        value = choices.map(choice => {
          const isSelected = choice === value || choice === valueStr;
          return isSelected ? `*${choice}*` : choice;
        }).join(' ');
      }

      if (this.precisionHint !== null && typeof value === 'number') {
        value = parseFloat(value.toFixed(this.precisionHint));
      }

      if (typeof value === 'object' && value !== null) {
        value = value.toString();
      }

      let s = `${this.name} (${this.id}): ${value}`;
      
      const unit = this.unit;
      if (unit !== null) {
        const unitStr = typeof unit === 'object' && unit !== null ? unit.toString() : unit;
        s += ` ${unitStr}`;
      }

      if (this.type === Feature.Type.Number) {
        s += ` (range: ${this.minimumValue}-${this.maximumValue})`;
      }

      return s;
    } catch (ex) {
      return `Unable to read value (${this.id}): ${ex.message}`;
    }
  }
}