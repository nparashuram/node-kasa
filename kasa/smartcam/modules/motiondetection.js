/**
 * Implementation of motion detection module for cameras.
 */

import { SmartCamModule } from '../smartcammodule.js';
import { DetectionModule } from './detectionmodule.js';

/**
 * Implementation of motion detection module.
 */
export class MotionDetection extends DetectionModule {
  static REQUIRED_COMPONENT = 'detection';
  static NAME = 'motiondetection';

  static QUERY_GETTER_NAME = 'getDetectionConfig';
  static QUERY_MODULE_NAME = 'motion_detection';
  static QUERY_SECTION_NAMES = 'motion_det';

  static DETECTION_FEATURE_ID = 'motion_detection';
  static DETECTION_FEATURE_NAME = 'Motion detection';
  static QUERY_SETTER_NAME = 'setDetectionConfig';
  static QUERY_SET_SECTION_NAME = 'motion_det';
}

SmartCamModule.registerModule(MotionDetection);
