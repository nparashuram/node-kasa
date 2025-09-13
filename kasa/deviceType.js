/**
 * TP-Link device types.
 */

/**
 * Device type enum.
 */
export class DeviceType {
  // The values match what the cli has historically used
  static Plug = 'plug';
  static Bulb = 'bulb';
  static Strip = 'strip';
  static Camera = 'camera';
  static WallSwitch = 'wallswitch';
  static StripSocket = 'stripsocket';
  static Dimmer = 'dimmer';
  static LightStrip = 'lightstrip';
  static Sensor = 'sensor';
  static Hub = 'hub';
  static Fan = 'fan';
  static Thermostat = 'thermostat';
  static Vacuum = 'vacuum';
  static Chime = 'chime';
  static Doorbell = 'doorbell';
  static Unknown = 'unknown';

  /**
   * Return device type from string value.
   * @param {string} name - String value to match
   * @returns {string}
   */
  static fromValue(name) {
    const values = [
      DeviceType.Plug,
      DeviceType.Bulb,
      DeviceType.Strip,
      DeviceType.Camera,
      DeviceType.WallSwitch,
      DeviceType.StripSocket,
      DeviceType.Dimmer,
      DeviceType.LightStrip,
      DeviceType.Sensor,
      DeviceType.Hub,
      DeviceType.Fan,
      DeviceType.Thermostat,
      DeviceType.Vacuum,
      DeviceType.Chime,
      DeviceType.Doorbell,
      DeviceType.Unknown
    ];

    return values.find(type => type === name) || DeviceType.Unknown;
  }
}