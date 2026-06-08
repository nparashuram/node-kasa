/**
 * Implementation of glass detection module.
 */

import { SmartCamModule } from '../smartcammodule.js';
import { DetectionModule } from './detectionmodule.js';

/**
 * Implementation of glass detection module.
 */
export class GlassDetection extends DetectionModule {
  static REQUIRED_COMPONENT = 'glassDetection';
  static NAME = 'glassdetection';

  static QUERY_GETTER_NAME = 'getGlassBreakDetectionConfig';
  static QUERY_MODULE_NAME = 'glass_break_detection';
  static QUERY_SECTION_NAMES = 'detection';

  static DETECTION_FEATURE_ID = 'glass_break_detection';
  static DETECTION_FEATURE_NAME = 'Glass break detection';
  static QUERY_SETTER_NAME = 'setGlassBreakDetectionConfig';
  static QUERY_SET_SECTION_NAME = 'detection';
}

SmartCamModule.registerModule(GlassDetection);
