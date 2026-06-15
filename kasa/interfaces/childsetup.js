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
   * @returns {string[]} Supported categories
   * @abstract
   */
  get supportedCategories() {
    throw new Error('Abstract property \'supportedCategories\' must be implemented by subclass');
  }

  /**
   * Scan for new devices and pair them.
   * @param {Object} options - Pairing options
   * @param {number} [options.timeout=10] - Scanning timeout in seconds
   * @returns {Promise<Object[]>} List of added devices
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
