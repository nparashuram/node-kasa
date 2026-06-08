/**
 * Implementation of tamper detection module.
 */

import { SmartCamModule } from '../smartcammodule.js';
import { DetectionModule } from './detectionmodule.js';

/**
 * Implementation of tamper detection module.
 */
export class TamperDetection extends DetectionModule {
  static REQUIRED_COMPONENT = 'tamperDetection';
  static NAME = 'tamperdetection';

  static QUERY_GETTER_NAME = 'getTamperDetectionConfig';
  static QUERY_MODULE_NAME = 'tamper_detection';
  static QUERY_SECTION_NAMES = 'tamper_det';

  static DETECTION_FEATURE_ID = 'tamper_detection';
  static DETECTION_FEATURE_NAME = 'Tamper detection';
  static QUERY_SETTER_NAME = 'setTamperDetectionConfig';
  static QUERY_SET_SECTION_NAME = 'tamper_det';
}

SmartCamModule.registerModule(TamperDetection);
