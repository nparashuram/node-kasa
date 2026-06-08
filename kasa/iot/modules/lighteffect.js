/**
 * Module for light effects for IoT devices.
 */

import { IotModule } from '../iotmodule.js';

/**
 * Implementation of dynamic light effects.
 */
export class LightEffect extends IotModule {
  /**
     * Return effect name.
     * @returns {string} Effect name
     */
  get effect() {
    const eff = this.data.lighting_effect_state;
    if (eff && eff.enable) {
      return eff.name || 'Custom';
    }
    return 'None';
  }

  /**
     * Return built-in effects list.
     * @returns {Array<string>} Effect names
     */
  get effectList() {
    // This would ideally come from effects.js constants
    return ['Aurora', 'Bubbling Cauldron', 'Candy Cane', 'Christmas', 'Flicker', 'Hanukkah', 'Haunted Mansion', 'Icicle', 'Lightning', 'Ocean', 'Rainbow', 'Raindrop', 'Spring', 'Valentines'];
  }

  /**
     * Set a custom effect on the device.
     * @param {Object} effectDict - Effect configuration
     * @returns {Promise<Object>} Result
     */
  async setCustomEffect(effectDict) {
    return await this.call('set_lighting_effect', effectDict);
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}
