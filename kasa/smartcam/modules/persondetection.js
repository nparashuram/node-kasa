/**
 * Implementation of person detection module for cameras.
 */

import { SmartCamModule } from '../smartcammodule.js';
import { DetectionModule } from './detectionmodule.js';

/**
 * Implementation of person detection module.
 */
export class PersonDetection extends DetectionModule {
  static REQUIRED_COMPONENT = 'personDetection';
  static NAME = 'persondetection';

  static QUERY_GETTER_NAME = 'getPersonDetectionConfig';
  static QUERY_MODULE_NAME = 'people_detection';
  static QUERY_SECTION_NAMES = 'detection';

  static DETECTION_FEATURE_ID = 'person_detection';
  static DETECTION_FEATURE_NAME = 'Person detection';
  static QUERY_SETTER_NAME = 'setPersonDetectionConfig';
  static QUERY_SET_SECTION_NAME = 'detection';
}

SmartCamModule.registerModule(PersonDetection);
