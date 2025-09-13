/**
 * Module for Fan Interface.
 */

import { Module, FeatureAttribute } from '../module.js';

/**
 * Interface for a Fan.
 * @abstract
 */
export class Fan extends Module {
  /**
   * Return fan speed level.
   * @returns {number} Fan speed level
   * @abstract
   */
  get fanSpeedLevel() {
    throw new Error('Abstract property \'fanSpeedLevel\' must be implemented by subclass');
  }

  /**
   * Set fan speed level.
   * @param {number} level - Fan speed level to set
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setFanSpeedLevel(level) {
    throw new Error('Abstract method \'setFanSpeedLevel\' must be implemented by subclass');
  }
}

// Add FeatureAttribute metadata to methods that should be bound to features
Fan.prototype.fanSpeedLevel._featureAttribute = new FeatureAttribute();
Fan.prototype.setFanSpeedLevel._featureAttribute = new FeatureAttribute();