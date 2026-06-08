/**
 * Implementation of line crossing detection module.
 */

import { SmartCamModule } from '../smartcammodule.js';
import { DetectionModule } from './detectionmodule.js';

/**
 * Implementation of line crossing detection module.
 */
export class LineCrossingDetection extends DetectionModule {
  static REQUIRED_COMPONENT = 'lineCrossingDetection';
  static NAME = 'linecrossingdetection';

  static QUERY_GETTER_NAME = 'getLineCrossingDetectionConfig';
  static QUERY_MODULE_NAME = 'line_crossing_detection';
  static QUERY_SECTION_NAMES = 'detection';

  static DETECTION_FEATURE_ID = 'line_crossing_detection';
  static DETECTION_FEATURE_NAME = 'Line crossing detection';
  static QUERY_SETTER_NAME = 'setLineCrossingDetectionConfig';
  static QUERY_SET_SECTION_NAME = 'detection';
}

SmartCamModule.registerModule(LineCrossingDetection);
