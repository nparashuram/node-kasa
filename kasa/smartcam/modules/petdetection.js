/**
 * Implementation of pet detection module.
 */

import { SmartCamModule } from '../smartcammodule.js';
import { DetectionModule } from './detectionmodule.js';

/**
 * Implementation of pet detection module.
 */
export class PetDetection extends DetectionModule {
  static REQUIRED_COMPONENT = 'petDetection';
  static NAME = 'petdetection';

  static QUERY_GETTER_NAME = 'getPetDetectionConfig';
  static QUERY_MODULE_NAME = 'pet_detection';
  static QUERY_SECTION_NAMES = 'detection';

  static DETECTION_FEATURE_ID = 'pet_detection';
  static DETECTION_FEATURE_NAME = 'Pet detection';
  static QUERY_SETTER_NAME = 'setPetDetectionConfig';
  static QUERY_SET_SECTION_NAME = 'detection';
}

SmartCamModule.registerModule(PetDetection);
