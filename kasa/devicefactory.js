/**
 * Device creation via DeviceConfig.
 */

import { DeviceType } from './deviceType.js';
import { DeviceConfig, DeviceEncryptionType, DeviceFamily, DeviceConnectionParameters } from './deviceconfig.js';
import { KasaException, UnsupportedDeviceError } from './exceptions.js';

// IoT device classes
import { IotBulb, IotDevice, IotDimmer, IotLightStrip, IotPlug, IotStrip, IotWallSwitch } from './iot/index.js';
import { IotProtocol } from './protocols/iotprotocol.js';
import { XorTransport } from './transports/xortransport.js';

// Smart device classes
import { SmartDevice } from './smart/index.js';
import { SmartCamDevice } from './smartcam/index.js';
import { SmartProtocol } from './protocols/smartprotocol.js';
import { SmartCamProtocol } from './protocols/smartcamprotocol.js';

// Transport classes
import {
  AesTransport, KlapTransport, KlapTransportV2,
  LinkieTransportV2, SslTransport, SslAesTransport
} from './transports/index.js';

const GET_SYSINFO_QUERY = {
  'system': { 'get_sysinfo': {} }
};

/**
 * Connect to a single device by the given hostname or device configuration.
 */
export async function connect({ host = null, config = null } = {}) {
  if ((host && config) || (!host && !config)) {
    throw new KasaException('One of host or config must be provided and not both');
  }

  if (host) {
    return await _connectWithAutoDetection(host);
  }

  const protocol = getProtocol({ config });
  if (!protocol) {
    throw new UnsupportedDeviceError(
      `Unsupported device for ${config.host}: ${config.connectionType.deviceFamily}`,
      { host: config.host }
    );
  }

  try {
    return await _connect(config, protocol);
  } catch (error) {
    await protocol.close();
    throw error;
  }
}

async function _connectWithAutoDetection(host) {
  let discoveryInfo = null;
  let optimalProtocol = null;

  try {
    discoveryInfo = await _performSmartDiscovery(host);
    if (discoveryInfo) {
      optimalProtocol = _getOptimalProtocolFromDiscovery(discoveryInfo, host);
    }
  } catch (error) {
  }

  if (optimalProtocol) {
    const config = new DeviceConfig({
      host,
      timeout: 5000,
      connectionType: DeviceConnectionParameters.fromValues(
        optimalProtocol.deviceFamily,
        optimalProtocol.encryptionType,
        {
          https: optimalProtocol.https || false,
          httpPort: optimalProtocol.httpPort || null
        }
      )
    });

    const protocol = getProtocol({ config });
    if (protocol) {
      try {
        return await _connect(config, protocol);
      } catch (error) {
        await protocol.close();
      }
    }
  }

  return await _connectWithBruteForce(host);
}

async function _performSmartDiscovery(host) {
  try {
    const { XorEncryption } = await import('./transports/xortransport.js');
    const { _AesDiscoveryQuery } = await import('./discover.js');
    const dgram = await import('dgram');

    return await new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      const timeout = setTimeout(() => {
        socket.close();
        resolve(null);
      }, 3000);

      socket.on('message', (data, rinfo) => {
        try {
          clearTimeout(timeout);
          socket.close();

          if (rinfo.port === 9999) {
            try {
              const decrypted = XorEncryption.decrypt(data);
              const info = JSON.parse(decrypted);
              resolve(info.system?.get_sysinfo || info);
            } catch (e) {
              resolve(null);
            }
          } else if (rinfo.port === 20002) {
            try {
              const info = JSON.parse(data.slice(16).toString('utf8'));
              resolve(info.result || info);
            } catch (e) {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        socket.close();
        resolve(null);
      });

      socket.bind(() => {
        try {
          const query = JSON.stringify({ system: { get_sysinfo: {} } });
          const encrypted = XorEncryption.encrypt(query);
          socket.send(encrypted.slice(4), 9999, host);

          const aesQuery = _AesDiscoveryQuery.generateQuery();
          socket.send(aesQuery, 20002, host);
        } catch (sendError) {
          clearTimeout(timeout);
          socket.close();
          resolve(null);
        }
      });
    });
  } catch (error) {
    return null;
  }
}

function _getOptimalProtocolFromDiscovery(info, host) {
  if (!info) return null;

  if (info.device_type) {
    const deviceType = info.device_type;
    let deviceFamily;
    let encryptionType = DeviceEncryptionType.Klap;
    let httpPort = null;
    let https = false;

    if (deviceType.includes('KASASWITCH')) {
      deviceFamily = DeviceFamily.SmartKasaSwitch;
    } else if (deviceType.includes('TAPOSWITCH')) {
      deviceFamily = DeviceFamily.SmartTapoSwitch;
    } else if (deviceType.includes('KASAPLUG')) {
      deviceFamily = DeviceFamily.SmartKasaPlug;
    } else if (deviceType.includes('TAPOPLUG')) {
      deviceFamily = DeviceFamily.SmartTapoPlug;
    } else if (deviceType.includes('BULB')) {
      deviceFamily = DeviceFamily.SmartTapoBulb;
    } else if (deviceType.startsWith('SMART.')) {
      deviceFamily = DeviceFamily.SmartKasaSwitch;
    } else {
      return null;
    }

    if (info.mgt_encrypt_schm?.encrypt_type) {
      const encryptTypeStr = info.mgt_encrypt_schm.encrypt_type.toLowerCase();
      if (encryptTypeStr === 'klap') {
        encryptionType = DeviceEncryptionType.Klap;
      } else if (encryptTypeStr === 'aes') {
        encryptionType = DeviceEncryptionType.Aes;
      }
    }

    if (info.mgt_encrypt_schm?.http_port) {
      httpPort = info.mgt_encrypt_schm.http_port;
    }

    return { deviceFamily, encryptionType, https, httpPort };
  }

  if (info.mic_type === 'IOT.SMARTPLUGSWITCH' || info.feature || info.model) {
    return {
      deviceFamily: DeviceFamily.IotSmartPlugSwitch,
      encryptionType: DeviceEncryptionType.Xor,
      https: false,
      httpPort: null
    };
  }

  return null;
}

async function _connectWithBruteForce(host) {
  const protocolAttempts = [
    // Smart devices on port 80 (standard for newer firmware)
    { deviceFamily: DeviceFamily.SmartKasaSwitch, encryptionType: DeviceEncryptionType.Klap, https: false, httpPort: 80 },

    // IoT devices with newer firmware often switch to KLAP on port 80
    { deviceFamily: DeviceFamily.IotSmartPlugSwitch, encryptionType: DeviceEncryptionType.Klap, https: false, httpPort: 80 },

    // Standard Smart devices
    { deviceFamily: DeviceFamily.SmartKasaSwitch, encryptionType: DeviceEncryptionType.Klap, https: false },
    { deviceFamily: DeviceFamily.SmartTapoSwitch, encryptionType: DeviceEncryptionType.Klap, https: false },

    // Legacy IoT devices
    { deviceFamily: DeviceFamily.IotSmartPlugSwitch, encryptionType: DeviceEncryptionType.Xor, https: false },
    { deviceFamily: DeviceFamily.IotSmartBulb, encryptionType: DeviceEncryptionType.Xor, https: false },
  ];

  const errors = [];
  for (const attempt of protocolAttempts) {
    const config = new DeviceConfig({
      host,
      timeout: 5000,
      connectionType: DeviceConnectionParameters.fromValues(
        attempt.deviceFamily,
        attempt.encryptionType,
        {
          https: attempt.https || false,
          httpPort: attempt.httpPort || null
        }
      )
    });

    const protocol = getProtocol({ config });
    if (!protocol) continue;

    try {
      return await _connect(config, protocol);
    } catch (error) {
      await protocol.close();
      errors.push({ attempt, error: error.message });
    }
  }

  throw new UnsupportedDeviceError(
    `Unable to connect to device at ${host}. Tried ${protocolAttempts.length} protocol combinations.`,
    { host, attempts: errors }
  );
}

async function _connect(config, protocol) {
  let deviceClass = null;

  if (protocol instanceof IotProtocol && protocol._transport instanceof XorTransport) {
    const info = await protocol.query(GET_SYSINFO_QUERY);
    deviceClass = getDeviceClassFromSysInfo(info);
    const device = new deviceClass(config.host, { protocol });
    device.updateFromDiscoverInfo(info);
    await device.update();
    return device;
  } else {
    deviceClass = getDeviceClassFromFamily(
      config.connectionType.deviceFamily, 
      { https: config.connectionType.https }
    );
    if (deviceClass) {
      const device = new deviceClass(config.host, { protocol });
      await device.update();
      return device;
    } else {
      throw new UnsupportedDeviceError(
        `Unsupported device family for ${config.host}: ${config.connectionType.deviceFamily}`,
        { host: config.host }
      );
    }
  }
}

export function getDeviceClassFromSysInfo(sysinfo) {
  const TYPE_TO_CLASS = {
    [DeviceType.Bulb]: IotBulb,
    [DeviceType.Plug]: IotPlug,
    [DeviceType.Dimmer]: IotDimmer,
    [DeviceType.Strip]: IotStrip,
    [DeviceType.WallSwitch]: IotWallSwitch,
    [DeviceType.LightStrip]: IotLightStrip,
  };
  
  const deviceType = IotDevice._getDeviceTypeFromSysInfo({ system: { get_sysinfo: sysinfo } });
  const deviceClass = TYPE_TO_CLASS[deviceType];
  if (!deviceClass) {
    throw new UnsupportedDeviceError(`No device class for type: ${deviceType}`);
  }
  return deviceClass;
}

export function getDeviceClassFromFamily(deviceType, { https = false, requireExact = false } = {}) {
  const supportedDeviceTypes = {
    'SMART.TAPOPLUG': SmartDevice,
    'SMART.TAPOBULB': SmartDevice,
    'SMART.TAPOSWITCH': SmartDevice,
    'SMART.KASAPLUG': SmartDevice,
    'SMART.TAPOHUB': SmartDevice,
    'SMART.TAPOHUB.HTTPS': SmartCamDevice,
    'SMART.KASAHUB': SmartDevice,
    'SMART.KASASWITCH': SmartDevice,
    'SMART.IPCAMERA.HTTPS': SmartCamDevice,
    'SMART.TAPODOORBELL.HTTPS': SmartCamDevice,
    'SMART.TAPOROBOVAC.HTTPS': SmartDevice,
    'IOT.SMARTPLUGSWITCH': IotPlug,
    'IOT.SMARTBULB': IotBulb,
  };

  const lookupKey = `${deviceType}${https ? '.HTTPS' : ''}`;
  let cls = supportedDeviceTypes[lookupKey];
  if (!cls && deviceType.startsWith('SMART.') && !requireExact) {
    cls = SmartDevice;
  }
  return cls || null;
}

export function getProtocol({ config, strict = false } = {}) {
  const ctype = config.connectionType;
  if (!ctype.deviceFamily) return null;
  
  const protocolName = ctype.deviceFamily.split('.')[0];

  if ([DeviceFamily.SmartIpCamera, DeviceFamily.SmartTapoDoorbell].includes(ctype.deviceFamily)) {
    if (strict && ctype.encryptionType !== DeviceEncryptionType.Aes) return null;
    return new SmartCamProtocol({ transport: new SslAesTransport({ config }) });
  }

  if (ctype.deviceFamily === DeviceFamily.IotIpCamera) {
    if (strict && ctype.encryptionType !== DeviceEncryptionType.Xor) return null;
    return new IotProtocol({ transport: new LinkieTransportV2({ config }) });
  }

  if (ctype.deviceFamily === DeviceFamily.SmartTapoRobovac && ctype.encryptionType === DeviceEncryptionType.Aes) {
    return new SmartProtocol({ transport: new SslTransport({ config }) });
  }

  const protocolTransportKey = protocolName + '.' + ctype.encryptionType + (ctype.https ? '.HTTPS' : '');
  const supportedDeviceProtocols = {
    'IOT.XOR': [IotProtocol, XorTransport],
    'IOT.KLAP': [IotProtocol, KlapTransport],
    'SMART.AES': [SmartProtocol, AesTransport],
    'SMART.KLAP': [SmartProtocol, KlapTransportV2],
    'SMART.KLAP.HTTPS': [SmartProtocol, KlapTransportV2],
    'SMART.AES.HTTPS': [SmartCamProtocol, SslAesTransport],
    'IOT.KLAP.HTTPS': [IotProtocol, KlapTransport],
    'SMART.SSL': [SmartProtocol, SslTransport],
  };

  const protTranCls = supportedDeviceProtocols[protocolTransportKey];
  if (!protTranCls) return null;
  
  const [protocolCls, transportCls] = protTranCls;
  return new protocolCls({ transport: new transportCls({ config }) });
}
