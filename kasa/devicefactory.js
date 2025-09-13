/**
 * Device creation via DeviceConfig.
 */

// import { Device } from './device.js'; // Unused import
import { DeviceType } from './deviceType.js';
import { DeviceConfig, DeviceEncryptionType, DeviceFamily, DeviceConnectionParameters } from './deviceconfig.js';
import { KasaException, UnsupportedDeviceError } from './exceptions.js';

// IoT device classes - import when available
let IotBulb, IotDevice, IotDimmer, IotLightStrip, IotPlug, IotStrip, IotWallSwitch;
let IotProtocol, XorTransport;
try {
  const iotModule = await import('./iot/index.js');
  ({ IotBulb, IotDevice, IotDimmer, IotLightStrip, IotPlug, IotStrip, IotWallSwitch } = iotModule);

  const protocolsModule = await import('./protocols/index.js');
  ({ IotProtocol } = protocolsModule);

  const transportsModule = await import('./transports/index.js');
  ({ XorTransport } = transportsModule);

} catch (error) {
  // IoT device classes not available - ensure we don't have undefined references
  IotProtocol = null;
  XorTransport = null;
}

// Smart device classes - import when available  
let SmartDevice, SmartCamDevice, SmartProtocol, SmartCamProtocol;
try {
  const smartModule = await import('./smart/index.js');
  ({ SmartDevice } = smartModule);
  
  const smartCamModule = await import('./smartcam/index.js');
  ({ SmartCamDevice } = smartCamModule);
  
  const protocolsModule = await import('./protocols/index.js');
  ({ SmartProtocol, SmartCamProtocol } = protocolsModule);
} catch (error) {
  // Smart device classes not available - continuing without them
}

// Transport classes - import when available
let AesTransport, KlapTransport, KlapTransportV2;
let LinkieTransportV2, SslTransport, SslAesTransport;
try {
  const transportsModule = await import('./transports/index.js');
  ({ 
    AesTransport, KlapTransport, KlapTransportV2,
    LinkieTransportV2, SslTransport, SslAesTransport 
  } = transportsModule);
} catch (error) {
  // Transport classes not available - continuing without them
}

// Simple performance logging function
const perfLog = (success, operation) => {
};

const GET_SYSINFO_QUERY = {
  'system': { 'get_sysinfo': {} }
};

/**
 * Connect to a single device by the given hostname or device configuration.
 *
 * This method avoids the UDP based discovery process and
 * will connect directly to the device.
 *
 * It is generally preferred to avoid discoverSingle() and
 * use this function instead as it should perform better when
 * the WiFi network is congested or the device is not responding
 * to discovery requests.
 *
 * Do not use this function directly, use SmartDevice.connect()
 *
 * @param {Object} options - Connection options
 * @param {string|null} [options.host] - Hostname of device to query
 * @param {DeviceConfig} [options.config] - Connection parameters to ensure the correct protocol and connection options are used
 * @returns {Promise<Device>} Object for querying/controlling found device
 */
export async function connect({ host = null, config = null } = {}) {
  if ((host && config) || (!host && !config)) {
    throw new KasaException('One of host or config must be provided and not both');
  }

  if (host) {
    // Try systematic protocol detection like python-kasa
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

/**
 * Connect with efficient two-phase discovery like python-kasa.
 * Phase 1: Quick discovery to identify device type and protocol
 * Phase 2: Connect using the identified optimal protocol
 * @param {string} host - Host to connect to
 * @returns {Promise<Device>} Connected device
 * @private
 */
async function _connectWithAutoDetection(host) {
  // Phase 1: Try smart discovery first (most modern devices)
  let discoveryInfo = null;
  let optimalProtocol = null;

  try {
    discoveryInfo = await _performSmartDiscovery(host);
    if (discoveryInfo) {
      optimalProtocol = _getOptimalProtocolFromDiscovery(discoveryInfo, host);
    }
  } catch (error) {
  }

  // Phase 2: Connect using optimal protocol if discovered, otherwise fallback to brute force
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
        const device = await _connect(config, protocol);
        return device;
      } catch (error) {
        await protocol.close();
      }
    }
  }

  // Fallback: Brute force like before, but with optimized order
  return await _connectWithBruteForce(host);
}

/**
 * Perform smart discovery query to identify device type and optimal protocol.
 * @param {string} host - Host to query
 * @returns {Promise<Object|null>} Discovery info or null
 * @private
 */
async function _performSmartDiscovery(host) {
  // Try IoT discovery on port 9999 (legacy devices) - simpler approach
  try {
    const discoverModule = await import('./discover.js');
    const dgram = await import('dgram');

    return await new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const timeout = setTimeout(() => {
        socket.close();
        resolve(null);
      }, 3000);

      socket.on('message', (data, rinfo) => {
        try {
          clearTimeout(timeout);
          socket.close();

          // Check which port the response came from to determine parsing method
          if (rinfo.port === 9999) {
            // IoT device response (port 9999) - XOR encrypted
            try {
              const decrypted = discoverModule.XorEncryption.decrypt(data);
              const info = JSON.parse(decrypted);
              resolve(info.system?.get_sysinfo || info);
            } catch (e) {
              resolve(null);
            }
          } else if (rinfo.port === 20002) {
            // SMART device response (port 20002) - AES with header
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
          // Send IoT discovery to port 9999
          const query = JSON.stringify({ system: { get_sysinfo: {} } });
          const encrypted = discoverModule.XorEncryption.encrypt(query);
          socket.send(encrypted.slice(4), 9999, host, (err) => {
          });

          // Send SMART discovery to port 20002 using proper AES query
          const aesQuery = discoverModule._AesDiscoveryQuery.generateQuery();
          socket.send(aesQuery, 20002, host, (err) => {
          });
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

/**
 * Determine optimal protocol from discovery info.
 * @param {Object} info - Discovery info
 * @param {string} host - Host address
 * @returns {Object|null} Optimal protocol config
 * @private
 */
function _getOptimalProtocolFromDiscovery(info, host) {
  if (!info) return null;

  // Handle SMART device discovery response
  if (info.device_type) {
    const deviceType = info.device_type;
    let deviceFamily;
    let encryptionType = DeviceEncryptionType.Klap; // Default for Smart devices
    let httpPort = null;
    let https = false;


    // Map device type to family
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
      deviceFamily = DeviceFamily.SmartKasaSwitch; // Generic fallback
    } else {
      return null;
    }

    // Extract encryption type from discovery info
    if (info.mgt_encrypt_schm?.encrypt_type) {
      const encryptTypeStr = info.mgt_encrypt_schm.encrypt_type.toLowerCase();
      if (encryptTypeStr === 'klap') {
        encryptionType = DeviceEncryptionType.Klap;
      } else if (encryptTypeStr === 'aes') {
        encryptionType = DeviceEncryptionType.Aes;
      }
    }

    // Extract port info
    if (info.mgt_encrypt_schm?.http_port) {
      httpPort = info.mgt_encrypt_schm.http_port;
    }

    return { deviceFamily, encryptionType, https, httpPort };
  }

  // Handle IoT device discovery response (legacy)
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

/**
 * Brute force protocol detection (fallback method).
 * @param {string} host - Host to connect to
 * @returns {Promise<Device>} Connected device
 * @private
 */
async function _connectWithBruteForce(host) {
  // Protocol combinations to try, ordered by likelihood
  const protocolAttempts = [
    // Modern Smart devices on port 80 (like HS200 with newer firmware >= 5.x)
    { deviceFamily: DeviceFamily.SmartKasaSwitch, encryptionType: DeviceEncryptionType.Klap, https: false, httpPort: 80 },
    { deviceFamily: DeviceFamily.SmartKasaSwitch, encryptionType: DeviceEncryptionType.Aes, https: false, httpPort: 80 },

    // Modern Smart devices on standard ports (most common for new devices)
    { deviceFamily: DeviceFamily.SmartKasaSwitch, encryptionType: DeviceEncryptionType.Klap, https: false },
    { deviceFamily: DeviceFamily.SmartTapoSwitch, encryptionType: DeviceEncryptionType.Klap, https: false },
    { deviceFamily: DeviceFamily.SmartKasaPlug, encryptionType: DeviceEncryptionType.Klap, https: false },
    { deviceFamily: DeviceFamily.SmartTapoPlug, encryptionType: DeviceEncryptionType.Klap, https: false },

    // Smart devices with AES
    { deviceFamily: DeviceFamily.SmartKasaSwitch, encryptionType: DeviceEncryptionType.Aes, https: false },
    { deviceFamily: DeviceFamily.SmartTapoSwitch, encryptionType: DeviceEncryptionType.Aes, https: false },
    { deviceFamily: DeviceFamily.SmartKasaPlug, encryptionType: DeviceEncryptionType.Aes, https: false },
    { deviceFamily: DeviceFamily.SmartTapoPlug, encryptionType: DeviceEncryptionType.Aes, https: false },

    // Legacy IoT devices on standard ports (older firmware < 5.x)
    { deviceFamily: DeviceFamily.IotSmartPlugSwitch, encryptionType: DeviceEncryptionType.Xor, https: false },
    { deviceFamily: DeviceFamily.IotSmartBulb, encryptionType: DeviceEncryptionType.Xor, https: false },

    // HTTPS variants
    { deviceFamily: DeviceFamily.SmartKasaSwitch, encryptionType: DeviceEncryptionType.Klap, https: true },
    { deviceFamily: DeviceFamily.SmartTapoSwitch, encryptionType: DeviceEncryptionType.Klap, https: true },
  ];

  const errors = [];

  for (const attempt of protocolAttempts) {
    const config = new DeviceConfig({
      host,
      timeout: 5000, // Quick timeout for auto-detection
      connectionType: DeviceConnectionParameters.fromValues(
        attempt.deviceFamily,
        attempt.encryptionType,
        {
          loginVersion: attempt.loginVersion || null,
          https: attempt.https || false,
          httpPort: attempt.httpPort || null
        }
      )
    });

    const protocol = getProtocol({ config });
    if (!protocol) {
      continue; // Skip unsupported protocol combinations
    }

    try {
      const device = await _connect(config, protocol);
      return device;
    } catch (error) {
      await protocol.close();
      errors.push({
        attempt,
        error: error.message
      });

      // Continue trying other protocols
    }
  }

  // All protocols failed, throw comprehensive error
  throw new UnsupportedDeviceError(
    `Unable to connect to device at ${host}. Tried ${protocolAttempts.length} protocol combinations.`,
    { host, attempts: errors }
  );
}

/**
 * Internal connection logic.
 * @param {DeviceConfig} config - Device configuration
 * @param {Object} protocol - Protocol instance
 * @returns {Promise<Device>} Connected device
 * @private
 */
async function _connect(config, protocol) {

  let deviceClass = null;
  let device = null;

  if (IotProtocol && protocol instanceof IotProtocol && 
      XorTransport && protocol._transport instanceof XorTransport) {
    const info = await protocol.query(GET_SYSINFO_QUERY);
    perfLog(true, 'get_sysinfo');
    
    deviceClass = getDeviceClassFromSysInfo(info);
    device = new deviceClass(config.host, { protocol });
    device.updateFromDiscoverInfo(info);
    await device.update();
    perfLog(true, 'update');
    return device;
    
  } else {
    deviceClass = getDeviceClassFromFamily(
      config.connectionType.deviceFamily, 
      { https: config.connectionType.https }
    );
    if (deviceClass) {
      device = new deviceClass(config.host, { protocol });
      await device.update();
      perfLog(true, 'update');
      return device;
    } else {
      throw new UnsupportedDeviceError(
        `Unsupported device for ${config.host}: ${config.connectionType.deviceFamily.value}`,
        { host: config.host }
      );
    }
  }
}

/**
 * Find SmartDevice subclass for device described by passed data.
 * @param {Object} sysinfo - System info from device
 * @returns {Function} Device class constructor
 */
export function getDeviceClassFromSysInfo(sysinfo) {
  if (!IotDevice) {
    throw new UnsupportedDeviceError('IoT device classes not available');
  }

  const TYPE_TO_CLASS = {
    [DeviceType.Bulb]: IotBulb,
    [DeviceType.Plug]: IotPlug,
    [DeviceType.Dimmer]: IotDimmer,
    [DeviceType.Strip]: IotStrip,
    [DeviceType.WallSwitch]: IotWallSwitch,
    [DeviceType.LightStrip]: IotLightStrip,
    // Disabled until properly implemented
    // [DeviceType.Camera]: IotCamera,
  };
  
  const deviceType = IotDevice._getDeviceTypeFromSysInfo(sysinfo);
  const deviceClass = TYPE_TO_CLASS[deviceType];
  
  if (!deviceClass) {
    throw new UnsupportedDeviceError(`No device class for type: ${deviceType}`);
  }
  
  return deviceClass;
}

/**
 * Return the device class from the type name.
 * @param {string} deviceType - Device type string
 * @param {Object} options - Options
 * @param {boolean} [options.https=false] - Whether device uses HTTPS
 * @param {boolean} [options.requireExact=false] - Whether to require exact match
 * @returns {Function|null} Device class or null
 */
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
    // Disabled until properly implemented
    // "IOT.IPCAMERA": IotCamera,
  };

  const lookupKey = `${deviceType}${https ? '.HTTPS' : ''}`;
  let cls = supportedDeviceTypes[lookupKey];
  
  if (!cls && deviceType.startsWith('SMART.') && !requireExact && SmartDevice) {
    cls = SmartDevice;
  }

  // if (cls) {
  //   // Class found, return it below
  // }

  return cls || null;
}

/**
 * Return the protocol from the device config.
 *
 * For cameras and vacuums the device family is a simple mapping to
 * the protocol/transport. For other device types the transport varies
 * based on the discovery information.
 *
 * @param {Object} options - Options
 * @param {DeviceConfig} options.config - Device config to derive protocol  
 * @param {boolean} [options.strict=false] - Require exact match on encrypt type
 * @returns {Object|null} Protocol instance or null
 */
export function getProtocol({ config, strict = false } = {}) {
  const ctype = config.connectionType;
  
  if (!ctype.deviceFamily) {
    return null;
  }
  
  const protocolName = ctype.deviceFamily.split('.')[0];

  // Handle special camera cases
  if ([DeviceFamily.SmartIpCamera, DeviceFamily.SmartTapoDoorbell].includes(ctype.deviceFamily)) {
    if (strict && ctype.encryptionType !== DeviceEncryptionType.Aes) {
      return null;
    }
    if (!SmartCamProtocol || !SslAesTransport) {
      return null;
    }
    return new SmartCamProtocol({ transport: new SslAesTransport({ config }) });
  }

  if (ctype.deviceFamily === DeviceFamily.IotIpCamera) {
    if (strict && ctype.encryptionType !== DeviceEncryptionType.Xor) {
      return null;
    }
    if (!IotProtocol || !LinkieTransportV2) {
      return null;
    }
    return new IotProtocol({ transport: new LinkieTransportV2({ config }) });
  }

  // Older FW used a different transport
  if (ctype.deviceFamily === DeviceFamily.SmartTapoRobovac && 
      ctype.encryptionType === DeviceEncryptionType.Aes) {
    if (!SmartProtocol || !SslTransport) {
      return null;
    }
    return new SmartProtocol({ transport: new SslTransport({ config }) });
  }

  const protocolTransportKey = protocolName + '.' + ctype.encryptionType + (ctype.https ? '.HTTPS' : '');
  
  
  const supportedDeviceProtocols = {
    'IOT.XOR': [IotProtocol, XorTransport],
    'IOT.KLAP': [IotProtocol, KlapTransport],
    'SMART.AES': [SmartProtocol, AesTransport],
    'SMART.KLAP': [SmartProtocol, KlapTransportV2],
    'SMART.KLAP.HTTPS': [SmartProtocol, KlapTransportV2],
    // H200 is device family SMART.TAPOHUB and uses SmartCamProtocol so use
    // https to distinguish from SmartProtocol devices
    'SMART.AES.HTTPS': [SmartCamProtocol, SslAesTransport],
  };

  const protTranCls = supportedDeviceProtocols[protocolTransportKey];
  if (!protTranCls) {
    return null;
  }
  
  const [protocolCls, transportCls] = protTranCls;
  
  if (!protocolCls || !transportCls) {
    return null;
  }
  
  return new protocolCls({ transport: new transportCls({ config }) });
}