/**
 * Implementation of meow detection module.
 */

import { SmartCamModule } from '../smartcammodule.js';
import { DetectionModule } from './detectionmodule.js';

/**
 * Implementation of meow detection module.
 */
export class MeowDetection extends DetectionModule {
  static REQUIRED_COMPONENT = 'meowDetection';
  static NAME = 'meowdetection';

  static QUERY_GETTER_NAME = 'getMeowDetectionConfig';
  static QUERY_MODULE_NAME = 'meow_detection';
  static QUERY_SECTION_NAMES = 'detection';

  static DETECTION_FEATURE_ID = 'meow_detection';
  static DETECTION_FEATURE_NAME = 'Meow detection';
  static QUERY_SETTER_NAME = 'setMeowDetectionConfig';
  static QUERY_SET_SECTION_NAME = 'detection';
}

SmartCamModule.registerModule(MeowDetection);
