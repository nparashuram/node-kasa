/**
 * Implementation of vehicle detection module.
 */

import { SmartCamModule } from '../smartcammodule.js';
import { DetectionModule } from './detectionmodule.js';

/**
 * Implementation of vehicle detection module.
 */
export class VehicleDetection extends DetectionModule {
  static REQUIRED_COMPONENT = 'vehicleDetection';
  static NAME = 'vehicledetection';

  static QUERY_GETTER_NAME = 'getVehicleDetectionConfig';
  static QUERY_MODULE_NAME = 'vehicle_detection';
  static QUERY_SECTION_NAMES = 'detection';

  static DETECTION_FEATURE_ID = 'vehicle_detection';
  static DETECTION_FEATURE_NAME = 'Vehicle detection';
  static QUERY_SETTER_NAME = 'setVehicleDetectionConfig';
  static QUERY_SET_SECTION_NAME = 'detection';
}

SmartCamModule.registerModule(VehicleDetection);
