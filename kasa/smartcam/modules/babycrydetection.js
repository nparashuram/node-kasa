/**
 * Implementation of baby cry detection module.
 */

import { SmartCamModule } from '../smartcammodule.js';
import { DetectionModule } from './detectionmodule.js';

/**
 * Implementation of baby cry detection module.
 */
export class BabyCryDetection extends DetectionModule {
  static REQUIRED_COMPONENT = 'babyCryDetection';
  static NAME = 'babycrydetection';

  static QUERY_GETTER_NAME = 'getBabyCryDetectionConfig';
  static QUERY_MODULE_NAME = 'baby_cry_detection';
  static QUERY_SECTION_NAMES = 'detection';

  static DETECTION_FEATURE_ID = 'baby_cry_detection';
  static DETECTION_FEATURE_NAME = 'Baby cry detection';
  static QUERY_SETTER_NAME = 'setBabyCryDetectionConfig';
  static QUERY_SET_SECTION_NAME = 'detection';
}

SmartCamModule.registerModule(BabyCryDetection);
