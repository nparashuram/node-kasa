/**
 * Module for base alarm module.
 */

import { Module, FeatureAttribute } from '../module.js';

/**
 * Base interface to represent an alarm module.
 * @abstract
 */
export class Alarm extends Module {
  /**
   * Return current alarm sound.
   * @returns {string} Current alarm sound
   * @abstract
   */
  get alarmSound() {
    throw new Error('Abstract property \'alarmSound\' must be implemented by subclass');
  }

  /**
   * Set alarm sound.
   *
   * See alarmSounds for list of available sounds.
   * @param {string} sound - Alarm sound to set
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setAlarmSound(sound) {
    throw new Error('Abstract method \'setAlarmSound\' must be implemented by subclass');
  }

  /**
   * Return list of available alarm sounds.
   * @returns {string[]} Available alarm sounds
   * @abstract
   */
  get alarmSounds() {
    throw new Error('Abstract property \'alarmSounds\' must be implemented by subclass');
  }

  /**
   * Return alarm volume.
   * @returns {number} Alarm volume
   * @abstract
   */
  get alarmVolume() {
    throw new Error('Abstract property \'alarmVolume\' must be implemented by subclass');
  }

  /**
   * Set alarm volume.
   * @param {number} volume - Volume to set
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setAlarmVolume(volume) {
    throw new Error('Abstract method \'setAlarmVolume\' must be implemented by subclass');
  }

  /**
   * Return alarm duration.
   * @returns {number} Alarm duration in seconds
   * @abstract
   */
  get alarmDuration() {
    throw new Error('Abstract property \'alarmDuration\' must be implemented by subclass');
  }

  /**
   * Set alarm duration.
   * @param {number} duration - Duration in seconds
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async setAlarmDuration(duration) {
    throw new Error('Abstract method \'setAlarmDuration\' must be implemented by subclass');
  }

  /**
   * Return true if alarm is active.
   * @returns {boolean} True if alarm is active
   * @abstract
   */
  get active() {
    throw new Error('Abstract property \'active\' must be implemented by subclass');
  }

  /**
   * Play alarm.
   *
   * The optional duration, volume, and sound override the device settings.
   * Duration is in seconds.
   * See alarmSounds for the list of sounds available for the device.
   * @param {Object} options - Play options
   * @param {number|null} [options.duration] - Duration in seconds to override device setting
   * @param {number|null} [options.volume] - Volume to override device setting
   * @param {string|null} [options.sound] - Sound to override device setting
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async play({ duration = null, volume = null, sound = null } = {}) {
    throw new Error('Abstract method \'play\' must be implemented by subclass');
  }

  /**
   * Stop alarm.
   * @returns {Promise<Object>} Command result
   * @abstract
   */
  async stop() {
    throw new Error('Abstract method \'stop\' must be implemented by subclass');
  }
}

// Add FeatureAttribute metadata to methods that should be bound to features
Alarm.prototype.alarmSound._featureAttribute = new FeatureAttribute();
Alarm.prototype.setAlarmSound._featureAttribute = new FeatureAttribute();
Alarm.prototype.alarmVolume._featureAttribute = new FeatureAttribute();
Alarm.prototype.setAlarmVolume._featureAttribute = new FeatureAttribute();
Alarm.prototype.alarmDuration._featureAttribute = new FeatureAttribute();
Alarm.prototype.setAlarmDuration._featureAttribute = new FeatureAttribute();