/**
 * Module for childsetup interface.
 */

import { Module } from '../module.js';

/**
 * Interface for child setup on hubs.
 * @abstract
 */
export class ChildSetup extends Module {
  /**
   * Supported child device categories.
   * @returns {Array<string>} Categories
   * @abstract
   */
  get supportedCategories() {
    throw new Error('Abstract property \'supportedCategories\' must be implemented by subclass');
  }

  /**
   * Scan for new devices and pair them.
   * @param {Object} options - Options
   * @param {number} [options.timeout=10] - Timeout in seconds
   * @returns {Promise<Array<Object>>} List of added devices
   * @abstract
   */
  async pair({ timeout = 10 } = {}) {
    throw new Error('Abstract method \'pair\' must be implemented by subclass');
  }

  /**
   * Remove device from the hub.
   * @param {string} deviceId - Device ID to unpair
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async unpair(deviceId) {
    throw new Error('Abstract method \'unpair\' must be implemented by subclass');
  }
}
