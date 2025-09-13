/**
 * Package containing all supported transports.
 */

import { BaseTransport } from './basetransport.js';
import { XorTransport, XorEncryption } from './xortransport.js';
import { AesTransport, AesEncryptionSession } from './aestransport.js';
import { KlapTransport, KlapTransportV2 } from './klaptransport.js';

export { BaseTransport } from './basetransport.js';
export { XorTransport, XorEncryption } from './xortransport.js';
export { AesTransport, AesEncryptionSession } from './aestransport.js';
export { KlapTransport, KlapTransportV2 } from './klaptransport.js';

// Export all available transports
export const transports = {
  BaseTransport,
  XorTransport,
  AesTransport,
  KlapTransport,
  KlapTransportV2,
};

// Export transport names
export const transportNames = [
  'BaseTransport',
  'XorTransport',
  'AesTransport',
  'KlapTransport', 
  'KlapTransportV2',
];

// Export encryption classes
export const encryptionClasses = {
  XorEncryption,
  AesEncryptionSession,
};