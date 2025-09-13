/**
 * Module for time interface.
 */

import { Module } from '../module.js';

/**
 * Base class for tplink time module.
 * @abstract
 */
export class Time extends Module {
  /**
   * Return timezone aware current device time.
   * @returns {Date} Current device time
   * @abstract
   */
  get time() {
    throw new Error('Abstract property \'time\' must be implemented by subclass');
  }

  /**
   * Return current timezone.
   * In JavaScript, this returns a timezone identifier string or offset.
   * @returns {string} Current timezone
   * @abstract
   */
  get timezone() {
    throw new Error('Abstract property \'timezone\' must be implemented by subclass');
  }

  /**
   * Set the device time.
   * @param {Date} dt - Date/time to set
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setTime(dt) {
    throw new Error('Abstract method \'setTime\' must be implemented by subclass');
  }
}