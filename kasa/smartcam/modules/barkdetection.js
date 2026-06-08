/**
 * Implementation of bark detection module.
 */

import { SmartCamModule } from '../smartcammodule.js';
import { DetectionModule } from './detectionmodule.js';

/**
 * Implementation of bark detection module.
 */
export class BarkDetection extends DetectionModule {
  static REQUIRED_COMPONENT = 'barkDetection';
  static NAME = 'barkdetection';

  static QUERY_GETTER_NAME = 'getBarkDetectionConfig';
  static QUERY_MODULE_NAME = 'bark_detection';
  static QUERY_SECTION_NAMES = 'detection';

  static DETECTION_FEATURE_ID = 'bark_detection';
  static DETECTION_FEATURE_NAME = 'Bark detection';
  static QUERY_SETTER_NAME = 'setBarkDetectionConfig';
  static QUERY_SET_SECTION_NAME = 'detection';
}

SmartCamModule.registerModule(BarkDetection);
