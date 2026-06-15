/**
 * Implementation of motion sensor module.
 */

import { Feature } from '../../feature.js';
import { SmartModule } from '../smartmodule.js';

/**
 * Implementation of motion sensor module.
 */
export class MotionSensor extends SmartModule {
  static NAME = 'MotionSensor';
  static REQUIRED_COMPONENT = 'sensitivity';

  /**
   * Initialize features.
   * @protected
   */
  _initializeFeatures() {
    this._addFeature(
      new Feature({
        device: this._device,
        id: 'motion_detected',
        name: 'Motion detected',
        container: this,
        attributeGetter: 'motionDetected',
        icon: 'mdi:motion-sensor',
        category: Feature.Category.Primary,
        type: Feature.Type.BinarySensor,
      })
    );
  }

  /**
   * Query to execute during the update cycle.
   * @returns {Object} Query object
   */
  query() {
    return {};
  }

  /**
   * Return True if the motion has been detected.
   * @returns {boolean} Motion detected
   */
  get motionDetected() {
    return !!this._device.sysInfo.detected;
  }
}

SmartModule.registerModule(MotionSensor);
