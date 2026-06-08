/**
 * Implementation of vacuum clean module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Status of vacuum.
 */
export const Status = {
  Idle: 0,
  Cleaning: 1,
  Mapping: 2,
  GoingHome: 4,
  Charging: 5,
  Charged: 6,
  Paused: 7,
  Undocked: 8,
  Error: 100,
  UnknownInternal: -1000
};

/**
 * Implementation of vacuum clean module.
 */
export class Clean extends SmartModule {
  static NAME = 'Clean';
  static REQUIRED_COMPONENT = 'clean';

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {
      'getVacStatus': {},
      'getCleanInfo': {},
      'getCarpetClean': {},
      'getAreaUnit': {},
      'getBatteryInfo': {},
      'getCleanStatus': {},
      'getCleanAttr': { 'type': 'global' },
    };
  }

  /**
     * Start cleaning.
     * @returns {Promise<Object>} Result
     */
  async start() {
    if (this.status === Status.Paused) {
      return await this.resume();
    }
    return await this.call('setSwitchClean', {
      'clean_mode': 0,
      'clean_on': true,
      'clean_order': true,
      'force_clean': false,
    });
  }

  /**
     * Pause cleaning.
     * @returns {Promise<Object>} Result
     */
  async pause() {
    return await this.call('setRobotPause', { 'pause': true });
  }

  /**
     * Resume cleaning.
     * @returns {Promise<Object>} Result
     */
  async resume() {
    return await this.call('setRobotPause', { 'pause': false });
  }

  /**
     * Return home.
     * @returns {Promise<Object>} Result
     */
  async returnHome() {
    return await this.call('setSwitchCharge', { 'switch_charge': true });
  }

  /**
     * Return current status.
     * @returns {number} Status code
     */
  get status() {
    return this.data.getVacStatus.status;
  }

  /**
     * Return battery level.
     * @returns {number} Battery percentage
     */
  get battery() {
    return this.data.getBatteryInfo.battery_percentage;
  }
}

SmartModule.registerModule(Clean);
