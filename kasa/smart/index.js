/**
 * Package for supporting tapo-branded and newer kasa devices.
 */

export { SmartDevice } from './smartdevice.js';
// export { SmartChildDevice } from './smartchilddevice.js';

// Export module base classes
export { SmartModule } from './smartmodule.js';

// Export decorators and utilities
export { 
  allowUpdateAfter, 
  raiseIfUpdateError 
} from './smartmodule.js';

// Export constants
export { NON_HUB_PARENT_ONLY_MODULES } from './smartdevice.js';