import { Credentials } from './credentials';

export enum DeviceFamily {
  IotSmartPlugSwitch = 'IotSmartPlugSwitch',
  SmartTapoPlug = 'SmartTapoPlug',
  SmartTapoBulb = 'SmartTapoBulb',
  SmartIpCamera = 'SmartIpCamera'
}

export enum DeviceEncryptionType {
  Xor = 'Xor',
  Klap = 'Klap'
}

export class DeviceConnectionParameters {
  constructor(deviceFamily: DeviceFamily, encryptionType: DeviceEncryptionType);
}

export interface DeviceConfigOptions {
  host: string;
  portOverride?: number;
  credentials?: Credentials;
  timeout?: number;
}

export class DeviceConfig {
  host: string;
  credentials?: Credentials;
  timeout?: number;
  connectionType?: DeviceConnectionParameters;

  constructor(options: DeviceConfigOptions);
}