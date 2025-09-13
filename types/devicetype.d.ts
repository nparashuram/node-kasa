/**
 * TP-Link device types.
 */
export declare class DeviceType {
  static readonly Plug: 'plug';
  static readonly Bulb: 'bulb';
  static readonly Strip: 'strip';
  static readonly Camera: 'camera';
  static readonly WallSwitch: 'wallswitch';
  static readonly StripSocket: 'stripsocket';
  static readonly Dimmer: 'dimmer';
  static readonly LightStrip: 'lightstrip';
  static readonly Sensor: 'sensor';
  static readonly Hub: 'hub';
  static readonly Fan: 'fan';
  static readonly Thermostat: 'thermostat';
  static readonly Vacuum: 'vacuum';
  static readonly Chime: 'chime';
  static readonly Doorbell: 'doorbell';
  static readonly Unknown: 'unknown';

  /**
   * Return device type from string value.
   */
  static fromValue(name: string): string;
}