/**
 * Implementation of vacuum speaker.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of vacuum speaker.
 */
export class Speaker extends SmartModule {
  static NAME = 'Speaker';
  static REQUIRED_COMPONENT = 'speaker';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return { 'getVolume': null };
  }

  /**
     * Return volume.
     * @returns {number} Volume
     */
  get volume() {
    return this.data.volume;
  }

  /**
     * Set volume.
     * @param {number} volume - Volume (0-100)
     * @returns {Promise<Object>} Result
     */
  async setVolume(volume) {
    return await this.call('setVolume', { 'volume': volume });
  }

  /**
     * Play sound to locate the device.
     * @returns {Promise<Object>} Result
     */
  async locate() {
    return await this.call('playSelectAudio', { 'audio_type': 'seek_me' });
  }
}

SmartModule.registerModule(Speaker);
