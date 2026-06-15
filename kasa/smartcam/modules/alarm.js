/**
 * Implementation of alarm module.
 */

import { Feature } from '../../feature.js';
import { Alarm as AlarmInterface } from '../../interfaces/alarm.js';
import { SmartCamModule } from '../smartcammodule.js';
import { allowUpdateAfter } from '../../smart/smartmodule.js';

const DURATION_MIN = 0;
const DURATION_MAX = 6000;
const VOLUME_MIN = 0;
const VOLUME_MAX = 10;

/**
 * Implementation of alarm module.
 */
export class Alarm extends SmartCamModule {
  static NAME = 'Alarm';
  static REQUIRED_COMPONENT = 'siren';
  static QUERY_GETTER_NAME = 'getSirenStatus';
  static QUERY_MODULE_NAME = 'siren';

  /**
   * Query to execute during the update cycle.
   * @returns {Object} Query
   */
  query() {
    const q = super.query();
    q.getSirenConfig = { [this.constructor.QUERY_MODULE_NAME]: {} };
    q.getSirenTypeList = { [this.constructor.QUERY_MODULE_NAME]: {} };
    return q;
  }

  /**
   * Initialize features.
   * @protected
   */
  _initializeFeatures() {
    const device = this._device;
    this._addFeature(
      new Feature({
        device,
        id: 'alarm',
        name: 'Alarm',
        container: this,
        attributeGetter: 'active',
        icon: 'mdi:bell',
        category: Feature.Category.Debug,
        type: Feature.Type.BinarySensor,
      })
    );
    this._addFeature(
      new Feature({
        device,
        id: 'alarm_sound',
        name: 'Alarm sound',
        container: this,
        attributeGetter: 'alarmSound',
        attributeSetter: 'setAlarmSound',
        category: Feature.Category.Config,
        type: Feature.Type.Choice,
        choicesGetter: 'alarmSounds',
      })
    );
    this._addFeature(
      new Feature({
        device,
        id: 'alarm_volume',
        name: 'Alarm volume',
        container: this,
        attributeGetter: 'alarmVolume',
        attributeSetter: 'setAlarmVolume',
        category: Feature.Category.Config,
        type: Feature.Type.Number,
        rangeGetter: () => [VOLUME_MIN, VOLUME_MAX],
      })
    );
    this._addFeature(
      new Feature({
        device,
        id: 'alarm_duration',
        name: 'Alarm duration',
        container: this,
        attributeGetter: 'alarmDuration',
        attributeSetter: 'setAlarmDuration',
        category: Feature.Category.Config,
        type: Feature.Type.Number,
        rangeGetter: () => [DURATION_MIN, DURATION_MAX],
      })
    );
    this._addFeature(
      new Feature({
        device,
        id: 'test_alarm',
        name: 'Test alarm',
        container: this,
        attributeSetter: 'play',
        type: Feature.Type.Action,
      })
    );
    this._addFeature(
      new Feature({
        device,
        id: 'stop_alarm',
        name: 'Stop alarm',
        container: this,
        attributeSetter: 'stop',
        type: Feature.Type.Action,
      })
    );
  }

  /**
   * Return current alarm sound.
   * @returns {string} Alarm sound
   */
  get alarmSound() {
    return this.data.getSirenConfig.siren_type;
  }

  /**
   * Set alarm sound.
   * @param {string} sound - Sound type
   * @returns {Promise<Object>} Result
   */
  async setAlarmSound(sound) {
    const config = this._validateAndGetConfig({ sound });
    return await this.call('setSirenConfig', { siren: config });
  }

  /**
   * Return list of available alarm sounds.
   * @returns {string[]} Alarm sounds
   */
  get alarmSounds() {
    return this.data.getSirenTypeList.siren_type_list;
  }

  /**
   * Return alarm volume.
   * @returns {number} Volume
   */
  get alarmVolume() {
    return parseInt(this.data.getSirenConfig.volume);
  }

  /**
   * Set alarm volume.
   * @param {number} volume - Volume
   * @returns {Promise<Object>} Result
   */
  async setAlarmVolume(volume) {
    const config = this._validateAndGetConfig({ volume });
    return await this.call('setSirenConfig', { siren: config });
  }

  /**
   * Return alarm duration.
   * @returns {number} Duration
   */
  get alarmDuration() {
    return this.data.getSirenConfig.duration;
  }

  /**
   * Set alarm duration.
   * @param {number} duration - Duration
   * @returns {Promise<Object>} Result
   */
  async setAlarmDuration(duration) {
    const config = this._validateAndGetConfig({ duration });
    return await this.call('setSirenConfig', { siren: config });
  }

  /**
   * Return true if alarm is active.
   * @returns {boolean} Active
   */
  get active() {
    return this.data.getSirenStatus.status !== 'off';
  }

  /**
   * Play alarm.
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async play({ duration = null, volume = null, sound = null } = {}) {
    const config = this._validateAndGetConfig({ duration, volume, sound });
    if (Object.keys(config).length > 0) {
      await this.call('setSirenConfig', { siren: config });
    }
    return await this.call('setSirenStatus', { siren: { status: 'on' } });
  }

  /**
   * Stop alarm.
   * @returns {Promise<Object>} Result
   */
  async stop() {
    return await this.call('setSirenStatus', { siren: { status: 'off' } });
  }

  /**
   * Validate and get config object.
   * @private
   */
  _validateAndGetConfig({ duration = null, volume = null, sound = null }) {
    if (sound && !this.alarmSounds.includes(sound)) {
      throw new Error(`sound must be one of ${this.alarmSounds.join(', ')}: ${sound}`);
    }
    if (duration !== null && (duration < DURATION_MIN || duration > DURATION_MAX)) {
      throw new Error(`duration must be between ${DURATION_MIN} and ${DURATION_MAX}`);
    }
    if (volume !== null && (volume < VOLUME_MIN || volume > VOLUME_MAX)) {
      throw new Error(`volume must be between ${VOLUME_MIN} and ${VOLUME_MAX}`);
    }
    const config = {};
    if (sound) config.siren_type = sound;
    if (duration !== null) config.duration = duration;
    if (volume !== null) config.volume = volume.toString();
    return config;
  }
}

allowUpdateAfter(Alarm.prototype, 'setAlarmSound', Object.getOwnPropertyDescriptor(Alarm.prototype, 'setAlarmSound'));
allowUpdateAfter(Alarm.prototype, 'setAlarmVolume', Object.getOwnPropertyDescriptor(Alarm.prototype, 'setAlarmVolume'));
allowUpdateAfter(Alarm.prototype, 'setAlarmDuration', Object.getOwnPropertyDescriptor(Alarm.prototype, 'setAlarmDuration'));

SmartCamModule.registerModule(Alarm);
