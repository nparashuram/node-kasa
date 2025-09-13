/**
 * Package containing all supported protocols.
 */

import { BaseProtocol } from './protocol.js';
import { IotProtocol } from './iotprotocol.js';
import { SmartProtocol } from './smartprotocol.js';
import { SmartCamProtocol } from './smartcamprotocol.js';

export { BaseProtocol } from './protocol.js';
export { IotProtocol } from './iotprotocol.js';
export { SmartProtocol } from './smartprotocol.js';
export { SmartCamProtocol } from './smartcamprotocol.js';

// Export all available protocols
export const protocols = {
  BaseProtocol,
  IotProtocol,
  SmartProtocol,
  SmartCamProtocol,
};

// Export protocol names
export const protocolNames = [
  'BaseProtocol',
  'IotProtocol', 
  'SmartProtocol',
  'SmartCamProtocol',
];