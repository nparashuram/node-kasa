/**
 * Node.js interface for TP-Link's smart home devices.
 *
 * All common, shared functionalities are available through `Device` class:
 *
 * import { Discover } from 'node-kasa';
 * 
 * const device = await Discover.discoverSingle("192.168.1.1");
 * console.log(device.model);
 *
 * For device type specific actions `modules` and `features` should be used instead.
 *
 * Module-specific errors are raised as `KasaException` and are expected
 * to be handled by the user of the library.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { Credentials } from './credentials.js';
import { Device } from './device.js';
import { DeviceType } from './deviceType.js';
import {
  DeviceConfig,
  DeviceConnectionParameters,
  DeviceEncryptionType,
  DeviceFamily
} from './deviceconfig.js';
import { Discover } from './discover.js';
import { EmeterStatus } from './emeterstatus.js';
import {
  AuthenticationError,
  DeviceError,
  KasaException,
  TimeoutError,
  UnsupportedDeviceError
} from './exceptions.js';
import { Feature } from './feature.js';
import { Module } from './module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
export const __version__ = packageJson.version;

export {
  Discover,
  DeviceType,
  Feature,
  EmeterStatus,
  Device,
  Module,
  KasaException,
  AuthenticationError,
  DeviceError,
  UnsupportedDeviceError,
  TimeoutError,
  Credentials,
  DeviceConfig,
  DeviceConnectionParameters,
  DeviceEncryptionType,
  DeviceFamily
};

// Import submodules for compatibility (when implemented)
// import * as iot from './iot/index.js';
// export { iot };

// Deprecated names mapping (for backwards compatibility)
export const deprecated_smart_devices = {
  // SmartDevice: iot.IotDevice,
  // SmartPlug: iot.IotPlug,
  // SmartBulb: iot.IotBulb,
  // SmartLightStrip: iot.IotLightStrip,
  // SmartStrip: iot.IotStrip,
  // SmartDimmer: iot.IotDimmer
};

export const deprecated_classes = {
  SmartDeviceException: KasaException,
  UnsupportedDeviceException: UnsupportedDeviceError,
  AuthenticationException: AuthenticationError,
  TimeoutException: TimeoutError,
  ConnectionType: DeviceConnectionParameters,
  EncryptType: DeviceEncryptionType,
  DeviceFamilyType: DeviceFamily
};