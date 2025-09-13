/**
 * Package for supporting legacy kasa devices.
 */

export { IotDevice } from './iotdevice.js';
export { IotPlug, IotWallSwitch } from './iotplug.js';
export { IotBulb } from './iotbulb.js';
export { IotStrip, IotStripPlug } from './iotstrip.js';
export { IotDimmer } from './iotdimmer.js';
export { IotLightStrip } from './iotlightstrip.js';
// export { IotCamera } from './iotcamera.js';

// Export module base classes
export { IotModule } from './iotmodule.js';

// Export enums and utility classes
export { 
  BehaviorMode, 
  TurnOnBehavior, 
  TurnOnBehaviors 
} from './iotbulb.js';

export { 
  ButtonAction, 
  ActionType, 
  FadeType 
} from './iotdimmer.js';

export { 
  mergeSums, 
  StripEmeter 
} from './iotstrip.js';

// Export utility functions
export { 
  requiresUpdate, 
  parseFeatures, 
  extractSysInfo 
} from './iotdevice.js';

// Export merge function
export { merge } from './iotmodule.js';