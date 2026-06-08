/**
 * Implementation of alarm module.
 */

import { SmartModule } from '../smartmodule.js';

export const VOLUME_INT_TO_STR = {
  0: 'mute',
  1: 'low',
  2: 'normal',
  3: 'high',
};

export const VOLUME_STR_TO_INT = {
  'mute': 0,
  'low': 1,
  'normal': 2,
  'high': 3,
};

/**
 * Implementation of alarm module.
 */
export class Alarm extends SmartModule {
  static NAME = 'Alarm';
  static REQUIRED_COMPONENT = 'alarm';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {
      'get_alarm_configure': null,
      'get_support_alarm_type_list': null,
    };
  }

  /**
     * Return true if alarm is active.
     * @returns {boolean} Active status
     */
  get active() {
    return this._device.sysInfo.in_alarm;
  }

  /**
     * Return the alarm cause.
     * @returns {string|null} Source
     */
  get source() {
    return this._device.sysInfo.in_alarm_source || null;
  }

  /**
     * Return current alarm sound.
     * @returns {string} Sound type
     */
  get alarmSound() {
    return this.data.get_alarm_configure.type;
  }

  /**
     * Set alarm sound.
     * @param {string} sound - Sound type
     * @returns {Promise<Object>} Result
     */
  async setAlarmSound(sound) {
    const payload = { ...this.data.get_alarm_configure, type: sound };
    return await this.call('set_alarm_configure', payload);
  }

  /**
     * Return list of available alarm sounds.
     * @returns {Array<string>} Sounds
     */
  get alarmSounds() {
    return this.data.get_support_alarm_type_list.alarm_type_list;
  }

  /**
     * Set alarm volume.
     * @param {string|number} volume - Volume string or level
     * @returns {Promise<Object>} Result
     */
  async setAlarmVolume(volume) {
    const payload = { ...this.data.get_alarm_configure, volume: volume };
    return await this.call('set_alarm_configure', payload);
  }

  /**
     * Set alarm duration.
     * @param {number} duration - Duration in seconds
     * @returns {Promise<Object>} Result
     */
  async setAlarmDuration(duration) {
    const payload = { ...this.data.get_alarm_configure, duration: duration };
    return await this.call('set_alarm_configure', payload);
  }

  /**
     * Play alarm.
     * @param {Object} options - Options
     * @returns {Promise<Object>} Result
     */
  async play({ duration = null, volume = null, sound = null } = {}) {
    const params = {};
    if (duration !== null) params.alarm_duration = duration;
    if (volume !== null) params.alarm_volume = volume;
    if (sound !== null) params.alarm_type = sound;
    return await this.call('play_alarm', params);
  }

  /**
     * Stop alarm.
     * @returns {Promise<Object>} Result
     */
  async stop() {
    return await this.call('stop_alarm');
  }
}

SmartModule.registerModule(Alarm);
