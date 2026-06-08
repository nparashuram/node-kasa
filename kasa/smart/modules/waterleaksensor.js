/**
 * Implementation of waterleak module.
 */

import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of waterleak module.
 */
export class WaterleakSensor extends SmartModule {
  static NAME = 'WaterleakSensor';
  static REQUIRED_COMPONENT = 'sensor_alarm';

  /**
     * Return True if alarm is active.
     * @returns {boolean} Alert status
     */
  get alert() {
    return this._device.sysInfo.in_alarm;
  }

  /**
     * Query to execute during the update cycle.
     * @returns {Object} Query object
     */
  query() {
    return {};
  }
}

SmartModule.registerModule(WaterleakSensor);
