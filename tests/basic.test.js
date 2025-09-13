/**
 * Basic tests for node-kasa library
 */

import { describe, test, expect } from '@jest/globals';

describe('Module Imports', () => {
  test('should import main module', async () => {
    const kasa = await import('../kasa/index.js');
    expect(kasa).toBeDefined();
    expect(kasa.Discover).toBeDefined();
    expect(kasa.Device).toBeDefined();
    expect(kasa.Credentials).toBeDefined();
  });

  test('should import exceptions', async () => {
    const { KasaException, TimeoutError, DeviceError, AuthenticationError } = await import('../kasa/exceptions.js');
    expect(KasaException).toBeDefined();
    expect(TimeoutError).toBeDefined();
    expect(DeviceError).toBeDefined();
    expect(AuthenticationError).toBeDefined();
  });

  test('should import device types', async () => {
    const { DeviceType } = await import('../kasa/deviceType.js');
    expect(DeviceType).toBeDefined();
    expect(DeviceType.Plug).toBe('plug');
    expect(DeviceType.Bulb).toBe('bulb');
    expect(DeviceType.fromValue('plug')).toBe('plug');
  });

  test('should import credentials', async () => {
    const { Credentials } = await import('../kasa/credentials.js');
    const creds = new Credentials('user', 'pass');
    expect(creds.username).toBe('user');
    expect(creds.password).toBe('pass');
  });

  test('should import device config', async () => {
    const { DeviceConfig, DeviceFamily, DeviceEncryptionType } = await import('../kasa/deviceconfig.js');
    expect(DeviceConfig).toBeDefined();
    expect(DeviceFamily.IotSmartPlugSwitch).toBe('IOT.SMARTPLUGSWITCH');
    expect(DeviceEncryptionType.Xor).toBe('XOR');
  });
});

describe('IoT Devices', () => {
  test('should import iot module', async () => {
    const iot = await import('../kasa/iot/index.js');
    expect(iot.IotDevice).toBeDefined();
    expect(iot.IotPlug).toBeDefined();
    expect(iot.IotBulb).toBeDefined();
    expect(iot.IotStrip).toBeDefined();
    expect(iot.IotDimmer).toBeDefined();
    expect(iot.IotLightStrip).toBeDefined();
  });

  test('should create iot plug instance', async () => {
    const { IotPlug } = await import('../kasa/iot/iotplug.js');
    const plug = new IotPlug('192.168.1.100');
    expect(plug.host).toBe('192.168.1.100');
    expect(plug.isOn).toBe(null); // Not updated yet
  });

  test('should create iot bulb instance', async () => {
    const { IotBulb } = await import('../kasa/iot/iotbulb.js');
    const bulb = new IotBulb('192.168.1.101');
    expect(bulb.host).toBe('192.168.1.101');
    expect(bulb.brightness).toBe(null); // Not updated yet
  });
});

describe('Smart Devices', () => {
  test('should import smart module', async () => {
    const smart = await import('../kasa/smart/index.js');
    expect(smart.SmartDevice).toBeDefined();
  });

  test('should create smart device instance', async () => {
    const { SmartDevice } = await import('../kasa/smart/smartdevice.js');
    const device = new SmartDevice('192.168.1.102');
    expect(device.host).toBe('192.168.1.102');
  });
});

describe('Interfaces', () => {
  test('should import light interface', async () => {
    const { Light, HSV, ColorTempRange, LightState } = await import('../kasa/interfaces/light.js');
    expect(Light).toBeDefined();
    expect(HSV).toBeDefined();
    expect(ColorTempRange).toBeDefined();
    expect(LightState).toBeDefined();
  });

  test('should create HSV color', async () => {
    const { HSV } = await import('../kasa/interfaces/light.js');
    const color = new HSV(120, 100, 50);
    expect(color.hue).toBe(120);
    expect(color.saturation).toBe(100);
    expect(color.value).toBe(50);
  });

  test('should import energy interface', async () => {
    const { Energy } = await import('../kasa/interfaces/energy.js');
    expect(Energy).toBeDefined();
  });
});

describe('Protocols', () => {
  test('should import protocols', async () => {
    const protocols = await import('../kasa/protocols/index.js');
    expect(protocols.BaseProtocol).toBeDefined();
    expect(protocols.IotProtocol).toBeDefined();
    expect(protocols.SmartProtocol).toBeDefined();
    expect(protocols.SmartCamProtocol).toBeDefined();
  });
});

describe('Transports', () => {
  test('should import transports', async () => {
    const transports = await import('../kasa/transports/index.js');
    expect(transports.BaseTransport).toBeDefined();
    expect(transports.XorTransport).toBeDefined();
    expect(transports.AesTransport).toBeDefined();
    expect(transports.KlapTransport).toBeDefined();
  });
});