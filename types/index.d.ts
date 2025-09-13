/**
 * Node.js interface for TP-Link's smart home devices.
 *
 * TypeScript definitions for node-kasa library.
 */

export { Discover, DiscoveryOptions, DiscoverSingleOptions } from './discover';
export { DeviceType } from './devicetype';
export { Feature } from './feature';
export { EmeterStatus } from './emeterstatus';
export { Device } from './device';
export { Module } from './module';
export {
  KasaException,
  AuthenticationError,
  DeviceError,
  UnsupportedDeviceError,
  TimeoutError
} from './exceptions';
export { Credentials } from './credentials';
export {
  DeviceConfig,
  DeviceConnectionParameters,
  DeviceEncryptionType,
  DeviceFamily
} from './deviceconfig';

// Version
export const __version__: string;

// Deprecated classes mapping
export const deprecated_smart_devices: {
  // Future compatibility exports
};

export const deprecated_classes: {
  SmartDeviceException: typeof KasaException;
  UnsupportedDeviceException: typeof UnsupportedDeviceError;
  AuthenticationException: typeof AuthenticationError;
  TimeoutException: typeof TimeoutError;
  ConnectionType: typeof DeviceConnectionParameters;
  EncryptType: typeof DeviceEncryptionType;
  DeviceFamilyType: typeof DeviceFamily;
};