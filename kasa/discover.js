/**
 * Discover TPLink Smart Home devices.
 *
 * The main entry point for this library is Discover.discover(),
 * which returns a dictionary of the found devices. The key is the IP address
 * of the device and the value contains ready-to-use, Device-derived
 * device object.
 *
 * discoverSingle() can be used to initialize a single device given its
 * IP address. If the DeviceConfig of the device is already known,
 * you can initialize the corresponding device class directly without discovery.
 *
 * The protocol uses UDP broadcast datagrams on port 9999 and 20002 for discovery.
 * Legacy devices support discovery on port 9999 and newer devices on 20002.
 *
 * Newer devices that respond on port 20002 will most likely require TP-Link cloud
 * credentials to be passed if queries or updates are to be performed on the returned
 * devices.
 *
 * Discovery returns a dict of {ip: discovered devices}:
 *
 * @example
 * import { Discover, Credentials } from 'node-kasa';
 * 
 * const foundDevices = await Discover.discover();
 * console.log(Object.values(foundDevices).map(dev => dev.model));
 * // ['KP303', 'HS110', 'L530E', 'KL430', 'HS220', 'H200']
 * 
 * // You can pass username and password for devices requiring authentication
 * const devices = await Discover.discover({
 *   username: "user@example.com",
 *   password: "great_password"
 * });
 * console.log(Object.keys(devices).length);
 * // 6
 * 
 * // You can also pass a Credentials object
 * const creds = new Credentials("user@example.com", "great_password");
 * const devices2 = await Discover.discover({ credentials: creds });
 * console.log(Object.keys(devices2).length);
 * // 6
 * 
 * // Discovery can also be targeted to a specific broadcast address instead of
 * // the default 255.255.255.255:
 * const foundDevices2 = await Discover.discover({ target: "127.0.0.255", credentials: creds });
 * console.log(Object.keys(foundDevices2).length);
 * // 6
 */

import dgram from 'dgram';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';

import { Credentials } from './credentials.js';
import { DeviceConfig } from './deviceconfig.js';
import { KasaException, TimeoutError, UnsupportedDeviceError } from './exceptions.js';

const lookup = promisify(dns.lookup);

/**
 * Try to connect attempt.
 */
export class ConnectAttempt {
  constructor(protocol, transport, device, https) {
    this.protocol = protocol;
    this.transport = transport;
    this.device = device;
    this.https = https;
  }
}

/**
 * Discovery result metadata.
 */
export class DiscoveredMeta {
  constructor(ip, port) {
    this.ip = ip;
    this.port = port;
  }
}

/**
 * Raw discovery result.
 */
export class DiscoveredRaw {
  constructor(meta, discoveryResponse) {
    this.meta = meta;
    this.discoveryResponse = discoveryResponse;
  }
}

const DECRYPTED_REDACTORS = {
  connect_ssid: (x) => x ? '#MASKED_SSID#' : '',
  device_id: (x) => 'REDACTED_' + x.slice(9),
  owner: (x) => 'REDACTED_' + x.slice(9)
};

// const NEW_DISCOVERY_REDACTORS = {
//   device_id: (x) => 'REDACTED_' + x.slice(9),
//   device_name: (x) => x ? '#MASKED_NAME#' : '',
//   owner: (x) => 'REDACTED_' + x.slice(9),
//   mac: (x) => maskMac(x),
//   master_device_id: (x) => 'REDACTED_' + x.slice(9),
//   group_id: (x) => 'REDACTED_' + x.slice(9),
//   group_name: () => 'I01BU0tFRF9TU0lEIw==',
//   encrypt_info: (x) => ({ ...x, key: '', data: '' }),
//   ip: (x) => x, // don't redact but keep listed here for dump_devinfo
//   decrypted_data: (x) => redactData(x, DECRYPTED_REDACTORS)
// };

/**
 * Mask MAC address for privacy.
 * @param {string} mac - MAC address
 * @returns {string} Masked MAC address
 */
function maskMac(mac) {
  if (!mac || mac.length < 6) return mac;
  return mac.slice(0, 8) + '**:**:**';
}

/**
 * Redact sensitive data from object.
 * @param {Object} data - Data to redact
 * @param {Object} redactors - Redactor functions
 * @returns {Object} Redacted data
 */
function redactData(data, redactors) {
  if (!data || typeof data !== 'object') return data;
  
  const result = Array.isArray(data) ? [] : {};
  
  for (const [key, value] of Object.entries(data)) {
    if (redactors[key]) {
      result[key] = redactors[key](value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactData(value, redactors);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Simple XOR encryption/decryption.
 */
class XorEncryption {
  static INITIALIZATION_VECTOR = 171;

  static* _xorPayload(unencrypted) {
    let key = XorEncryption.INITIALIZATION_VECTOR;
    for (const unencryptedByte of unencrypted) {
      key = key ^ unencryptedByte;
      yield key;
    }
  }

  static encrypt(request) {
    const plainBytes = Buffer.from(request, 'utf8');
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(plainBytes.length, 0);
        
    const encryptedBytes = Buffer.from(Array.from(XorEncryption._xorPayload(plainBytes)));
        
    return Buffer.concat([lengthBuffer, encryptedBytes]);
  }

  static* _xorEncryptedPayload(ciphertext) {
    let key = XorEncryption.INITIALIZATION_VECTOR;
    for (const cipherByte of ciphertext) {
      const plainByte = key ^ cipherByte;
      key = cipherByte;
      yield plainByte;
    }
  }

  static decrypt(ciphertext) {
    const decryptedBytes = Buffer.from(Array.from(XorEncryption._xorEncryptedPayload(ciphertext)));
    return decryptedBytes.toString('utf8');
  }
}

/**
 * AES key pair for discovery encryption.
 */
class KeyPair {
  constructor(privateKey, publicKey) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  static createKeyPair(keySize = 2048) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return new KeyPair(privateKey, publicKey);
  }

  getPublicPem() {
    return this.publicKey;
  }

  decryptDiscoveryKey(encryptedKey) {
    const decrypted = crypto.privateDecrypt({
      key: this.privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, encryptedKey);
    
    return decrypted;
  }
}

/**
 * AES discovery query generator.
 */
class _AesDiscoveryQuery {
  static keypair = null;

  static generateQuery() {
    if (!this.keypair) {
      this.keypair = KeyPair.createKeyPair(2048);
    }

    const secret = crypto.randomBytes(4);
    const keyPayload = {
      params: {
        rsa_key: this.keypair.getPublicPem()
      }
    };

    const keyPayloadBytes = Buffer.from(JSON.stringify(keyPayload), 'utf8');
    
    // https://labs.withsecure.com/advisories/tp-link-ac1750-pwn2own-2019
    const version = 2; // version of tdp
    const msgType = 0;
    const opCode = 1; // probe
    const msgSize = keyPayloadBytes.length;
    const flags = 17;
    const paddingByte = 0; // blank byte
    const deviceSerial = secret.readUInt32BE(0);
    const initialCrc = 0x5A6B7C8D;

    const header = Buffer.alloc(16);
    let offset = 0;
    
    header.writeUInt8(version, offset++);
    header.writeUInt8(msgType, offset++);
    header.writeUInt16BE(opCode, offset); offset += 2;
    header.writeUInt16BE(msgSize, offset); offset += 2;
    header.writeUInt8(flags, offset++);
    header.writeUInt8(paddingByte, offset++);
    header.writeUInt32BE(deviceSerial, offset); offset += 4;
    header.writeUInt32BE(initialCrc, offset);

    const query = Buffer.concat([header, keyPayloadBytes]);
    
    // Calculate CRC32 and replace initial CRC
    const crc = crc32(query);
    query.writeUInt32BE(crc >>> 0, 12); // Use >>> 0 to convert to unsigned
    
    return query;
  }
}

/**
 * Simple CRC32 implementation.
 * @param {Buffer} buffer - Buffer to calculate CRC for
 * @returns {number} CRC32 value
 */
function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  const table = [];
  
  // Generate table if not exists
  if (table.length === 0) {
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
  }
  
  for (let i = 0; i < buffer.length; i++) {
    crc = table[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Implementation of the discovery protocol handler.
 */
class _DiscoverProtocol extends EventEmitter {
  static DISCOVERY_START_TIMEOUT = 1000; // 1 second

  constructor(options = {}) {
    super();
    
    const {
      onDiscovered = null,
      onDiscoveredRaw = null,
      target = '255.255.255.255',
      discoveryPackets = 3,
      discoveryTimeout = 5000,
      interface: iface = null,
      onUnsupported = null,
      port = null,
      credentials = null,
      timeout = null
    } = options;

    this.socket = null;
    this.discoveryPackets = discoveryPackets;
    this.interface = iface;
    this.onDiscovered = onDiscovered;
    this.port = port;
    this.discoveryPort = port || Discover.DISCOVERY_PORT;
    this.target = target;
    this.target1 = [target, this.discoveryPort];
    this.target2 = [target, Discover.DISCOVERY_PORT_2];
    this.discoveredDevices = {};
    this.unsupportedDeviceExceptions = {};
    this.invalidDeviceExceptions = {};
    this.onUnsupported = onUnsupported;
    this.onDiscoveredRaw = onDiscoveredRaw;
    this.credentials = credentials;
    this.timeout = timeout;
    this.discoveryTimeout = discoveryTimeout;
    this.seenHosts = new Set();
    this.discoverTask = null;
    this.callbackTasks = [];
    this.targetDiscovered = false;
  }

  async waitForDiscoveryToComplete() {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TimeoutError('Discovery timeout'));
      }, this.discoveryTimeout);

      this.once('complete', () => {
        clearTimeout(timeoutId);
        this.close();
        resolve();
      });

      this.once('error', (error) => {
        clearTimeout(timeoutId);
        this.close();
        reject(error);
      });

      this.start();
    });
  }

  start() {
    this.socket = dgram.createSocket('udp4');

    this.socket.on('error', (err) => {
      this.emit('error', err);
    });

    this.socket.on('message', (data, rinfo) => {
      this.datagramReceived(data, rinfo).catch(() => {
        // Silently handle errors
      });
    });

    this.socket.on('listening', () => {
      try {
        this.socket.setBroadcast(true);

        try {
          this.socket.setReuseAddress(true);
        } catch (ex) {
          // Windows/WSL doesn't support SO_REUSEADDR
        }

        // Use setImmediate to ensure socket is fully ready
        setImmediate(() => {
          this.doDiscover().catch(err => {
            this.emit('error', err);
          });
        });
      } catch (err) {
        this.emit('error', err);
      }
    });

    try {
      this.socket.bind(0); // Bind to random port
    } catch (err) {
      this.emit('error', err);
    }
  }

  async doDiscover() {
    if (!this.socket) {
      throw new Error('Socket not initialized');
    }

    const discoveryQueryJson = JSON.stringify(Discover.DISCOVERY_QUERY);
    const encryptedReq = XorEncryption.encrypt(discoveryQueryJson);
    const sleepBetweenPackets = Math.max(100, this.discoveryTimeout / this.discoveryPackets);
    const aesDiscoveryQuery = _AesDiscoveryQuery.generateQuery();


    for (let i = 0; i < this.discoveryPackets; i++) {
      // For discoverSingle, stop if we already have a successful device
      if (this.target !== '255.255.255.255' && this.target in this.discoveredDevices) {
        break; // Stop sending for discoverSingle
      }

      try {
        // Send to port 9999 (IoT devices) - without length header
        if (this.socket && !this.socket.destroyed) {
          this.socket.send(encryptedReq.slice(4), this.target1[1], this.target1[0], (err) => {
          });

          // Send to port 20002 (Smart devices) - with full payload
          this.socket.send(aesDiscoveryQuery, this.target2[1], this.target2[0], (err) => {
          });
        } else {
          break;
        }
      } catch (err) {
        this.emit('error', err);
        return;
      }

      if (i < this.discoveryPackets - 1) {
        await new Promise(resolve => setTimeout(resolve, sleepBetweenPackets));
      }
    }


    // Wait for remaining time then complete
    setTimeout(() => {
      this.emit('complete');
    }, this.discoveryTimeout);
  }

  async datagramReceived(data, rinfo) {
    const { address: ip, port } = rinfo;
    
    // Prevent multiple entries due to multiple broadcasts
    if (this.seenHosts.has(ip)) {
      return;
    }
    this.seenHosts.add(ip);

    let device = null;

    const config = new DeviceConfig({ host: ip, portOverride: this.port });
    if (this.credentials) {
      config.credentials = this.credentials;
    }
    if (this.timeout) {
      config.timeout = this.timeout;
    }

    let info = null;
    try {
      let deviceFunc;

      // Try to parse as IOT device first (more common)
      try {
        info = Discover._getDiscoveryJsonLegacy(data, ip);
        deviceFunc = Discover._getDeviceInstanceLegacy;
      } catch (iotError) {
        // If IOT parsing fails, try SMART device parsing
        try {
          info = Discover._getDiscoveryJson(data, ip);
          deviceFunc = Discover._getDeviceInstance;
        } catch (smartError) {
          return;
        }
      }

      if (this.onDiscoveredRaw) {
        this.onDiscoveredRaw(new DiscoveredRaw(
          new DiscoveredMeta(ip, port),
          info
        ));
      }

      device = await deviceFunc(info, config);
    } catch (error) {
      if (error instanceof UnsupportedDeviceError) {
        this.unsupportedDeviceExceptions[ip] = error;
        if (this.onUnsupported) {
          this.onUnsupported(error);
        }
        this._handleDiscoveredEvent();
        return;
      } else if (error.name === 'AuthenticationError') {
        // Create a minimal device object for discovery reporting
        const minimalDevice = {
          host: ip,
          alias: 'Unknown (requires auth)',
          model: 'Unknown (requires auth)',
          deviceType: 'Unknown (requires auth)',
          isOn: false,
          requiresAuth: true,
          config: config
        };
        this.discoveredDevices[ip] = minimalDevice;
        this._handleDiscoveredEvent();
        return;
      } else if (error.message && error.message.includes('timeout')) {
        // For timeout errors, create a basic device with discovery info if available
        let alias = 'Unknown (connection timeout)';
        let model = 'Unknown';
        let deviceType = 'unknown';

        if (info) {
          if (info.device_model) {
            model = info.device_model;
          }
          if (info.device_type) {
            deviceType = info.device_type.toLowerCase().replace('smart.', '');
          }
          // Try to decode base64 nickname for SMART devices
          if (info.nickname) {
            try {
              alias = Buffer.from(info.nickname, 'base64').toString('utf8');
            } catch (e) {
              alias = info.nickname;
            }
          }
        }

        const timeoutDevice = {
          host: ip,
          alias: alias,
          model: model,
          deviceType: deviceType,
          isOn: false,
          connectionTimeout: true,
          config: config
        };
        this.discoveredDevices[ip] = timeoutDevice;
        this._handleDiscoveredEvent();
        return;
      } else if (error instanceof KasaException) {
        this.invalidDeviceExceptions[ip] = error;
        this._handleDiscoveredEvent();
        return;
      }

      throw error;
    }

    this.discoveredDevices[ip] = device;

    if (this.onDiscovered) {
      this.onDiscovered(device);
    }

    this._handleDiscoveredEvent();
  }

  _handleDiscoveredEvent() {
    if (this.seenHosts.has(this.target)) {
      this.targetDiscovered = true;
      this.emit('complete');
    }
  }

  close() {
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.close();
      } catch (err) {
      } finally {
        this.socket = null;
      }
    }
  }
}

/**
 * Encryption scheme for discovery result.
 */
export class EncryptionScheme {
  constructor(data) {
    this.isSupportHttps = data.is_support_https || false;
    this.encryptType = data.encrypt_type || null;
    this.httpPort = data.http_port || null;
    this.lv = data.lv || null;
  }
}

/**
 * Encryption info for discovery result.
 */
export class EncryptionInfo {
  constructor(data) {
    this.symSchm = data.sym_schm;
    this.key = data.key;
    this.data = data.data;
  }
}

/**
 * Discovery result model.
 */
export class DiscoveryResult {
  constructor(data) {
    this.deviceType = data.device_type;
    this.deviceModel = data.device_model;
    this.deviceId = data.device_id;
    this.ip = data.ip;
    this.mac = data.mac;
    this.mgtEncryptSchm = data.mgt_encrypt_schm ? new EncryptionScheme(data.mgt_encrypt_schm) : null;
    this.deviceName = data.device_name || null;
    this.encryptInfo = data.encrypt_info ? new EncryptionInfo(data.encrypt_info) : null;
    this.encryptType = data.encrypt_type || null;
    this.decryptedData = data.decrypted_data || null;
    this.isResetWifi = data.isResetWiFi || null;
    this.firmwareVersion = data.firmware_version || null;
    this.hardwareVersion = data.hardware_version || null;
    this.hwVer = data.hw_ver || null;
    this.owner = data.owner || null;
    this.isSupportIotCloud = data.is_support_iot_cloud || null;
    this.obdSrc = data.obd_src || null;
    this.factoryDefault = data.factory_default || null;
  }

  static fromDict(data) {
    return new DiscoveryResult(data);
  }

  toDict() {
    return {
      device_type: this.deviceType,
      device_model: this.deviceModel,
      device_id: this.deviceId,
      ip: this.ip,
      mac: this.mac,
      mgt_encrypt_schm: this.mgtEncryptSchm,
      device_name: this.deviceName,
      encrypt_info: this.encryptInfo,
      encrypt_type: this.encryptType,
      decrypted_data: this.decryptedData,
      isResetWiFi: this.isResetWifi,
      firmware_version: this.firmwareVersion,
      hardware_version: this.hardwareVersion,
      hw_ver: this.hwVer,
      owner: this.owner,
      is_support_iot_cloud: this.isSupportIotCloud,
      obd_src: this.obdSrc,
      factory_default: this.factoryDefault
    };
  }
}

/**
 * Class for discovering devices.
 */
export class Discover {
  static DISCOVERY_PORT = 9999;
  static DISCOVERY_QUERY = {
    system: { get_sysinfo: {} }
  };
  static DISCOVERY_PORT_2 = 20002;
  static DISCOVERY_QUERY_2 = Buffer.from('020000010000000000000000463cb5d3', 'hex');

  static _redactData = true;

  /**
   * Discover supported devices.
   *
   * Sends discovery message to 255.255.255.255:9999 and
   * 255.255.255.255:20002 in order to detect available supported devices in the local network,
   * and waits for given timeout for answers from devices.
   * If you have multiple interfaces, you can use target parameter to specify the network for discovery.
   *
   * @param {Object} options - Discovery options
   * @param {string} [options.target="255.255.255.255"] - The target address where to send the broadcast discovery queries
   * @param {Function} [options.onDiscovered] - Callback to execute on discovery  
   * @param {Function} [options.onDiscoveredRaw] - Optional callback once discovered json is loaded
   * @param {number} [options.discoveryTimeout=5000] - Milliseconds to wait for responses
   * @param {number} [options.discoveryPackets=3] - Number of discovery packets to broadcast
   * @param {string} [options.interface] - Bind to specific interface
   * @param {Function} [options.onUnsupported] - Optional callback when unsupported devices are discovered
   * @param {Credentials} [options.credentials] - Credentials for devices that require authentication
   * @param {string} [options.username] - Username for devices that require authentication  
   * @param {string} [options.password] - Password for devices that require authentication
   * @param {number} [options.port] - Override the discovery port for devices listening on 9999
   * @param {number} [options.timeout] - Query timeout in milliseconds for devices returned by discovery
   * @returns {Promise<Object>} Dictionary with discovered devices
   */
  static async discover(options = {}) {
    const {
      target = '255.255.255.255',
      onDiscovered = null,
      onDiscoveredRaw = null,
      discoveryTimeout = 5000,
      discoveryPackets = 3,
      interface: iface = null,
      onUnsupported = null,
      credentials = null,
      username = null,
      password = null,
      port = null,
      timeout = null
    } = options;

    let creds = credentials;
    if (!creds && username && password) {
      creds = new Credentials(username, password);
    }

    const protocol = new _DiscoverProtocol({
      target,
      onDiscovered,
      discoveryPackets,
      interface: iface,
      onUnsupported,
      onDiscoveredRaw,
      credentials: creds,
      timeout,
      discoveryTimeout,
      port
    });

    try {
      await protocol.waitForDiscoveryToComplete();
    } catch (error) {
      // If it's just a timeout, that's normal - we still return discovered devices
      if (error.name !== 'TimeoutError') {
        // Close any open device protocols for other errors
        for (const device of Object.values(protocol.discoveredDevices)) {
          if (device.protocol && device.protocol.close) {
            await device.protocol.close();
          }
        }
        throw error;
      }
      // For timeout errors, continue to return devices
    } finally {
      protocol.close();
    }

    return protocol.discoveredDevices;
  }

  /**
   * Discover a single device by the given IP address.
   *
   * It is generally preferred to avoid discoverSingle() and
   * use Device.connect() instead as it should perform better when
   * the WiFi network is congested or the device is not responding
   * to discovery requests.
   *
   * @param {string} host - Hostname of device to query
   * @param {Object} options - Discovery options
   * @param {number} [options.discoveryTimeout=5000] - Timeout in milliseconds for discovery
   * @param {number} [options.port] - Optionally set a different port for legacy devices using port 9999
   * @param {number} [options.timeout] - Timeout in milliseconds for device queries
   * @param {Credentials} [options.credentials] - Credentials for devices that require authentication
   * @param {string} [options.username] - Username for devices that require authentication
   * @param {string} [options.password] - Password for devices that require authentication
   * @param {Function} [options.onDiscoveredRaw] - Optional callback once discovered json is loaded
   * @param {Function} [options.onUnsupported] - Optional callback when unsupported devices are discovered
   * @returns {Promise<Device|null>} Object for querying/controlling found device
   */
  static async discoverSingle(host, options = {}) {
    const {
      discoveryTimeout = 5000,
      port = null,
      timeout = null,
      credentials = null,
      username = null,
      password = null,
      onDiscoveredRaw = null,
      onUnsupported = null
    } = options;

    let creds = credentials;
    if (!creds && username && password) {
      creds = new Credentials(username, password);
    }

    let ip;
    try {
      // Try to parse as IP address first
      new URL(`http://${host}`); // Simple validation
      ip = host;
    } catch {
      try {
        // Resolve hostname
        const result = await lookup(host, { family: 4 });
        ip = result.address;
      } catch (error) {
        throw new KasaException(`Could not resolve hostname ${host}: ${error.message}`);
      }
    }

    const protocol = new _DiscoverProtocol({
      target: ip,
      port,
      credentials: creds,
      timeout,
      discoveryTimeout,
      onDiscoveredRaw
    });

    try {
      await protocol.waitForDiscoveryToComplete();
    } finally {
      protocol.close();
    }

    if (ip in protocol.discoveredDevices) {
      const dev = protocol.discoveredDevices[ip];
      dev.host = host;
      return dev;
    } else if (ip in protocol.unsupportedDeviceExceptions) {
      if (onUnsupported) {
        await onUnsupported(protocol.unsupportedDeviceExceptions[ip]);
        return null;
      } else {
        throw protocol.unsupportedDeviceExceptions[ip];
      }
    } else if (ip in protocol.invalidDeviceExceptions) {
      throw protocol.invalidDeviceExceptions[ip];
    } else {
      // UDP discovery failed, try direct connection like python-kasa recommends
      try {
        const { connect } = await import('./devicefactory.js');
        return await connect({ host });
      } catch (directError) {
        throw new TimeoutError(
          `Both UDP discovery and direct connection failed for ${host}. ` +
          `UDP: Timed out getting discovery response. ` +
          `Direct: ${directError.message}`
        );
      }
    }
  }

  /**
   * Get discovery json from legacy 9999 response.
   * @param {Buffer} data - Response data
   * @param {string} ip - IP address
   * @returns {Object} Discovery info
   */
  static _getDiscoveryJsonLegacy(data, ip) {
    try {
      const decryptedString = XorEncryption.decrypt(data);
      const info = JSON.parse(decryptedString);
      return info;
    } catch (error) {
      throw new KasaException(
        `Unable to read response from device: ${ip}: ${error.message}`
      );
    }
  }

  /**
   * Get discovery json from the new 20002 response.
   * @param {Buffer} data - Response data  
   * @param {string} ip - IP address
   * @returns {Object} Discovery info
   */
  static _getDiscoveryJson(data, ip) {
    try {
      const info = JSON.parse(data.slice(16).toString('utf8'));
      // For SMART devices, the actual discovery info might be in the 'result' field
      if (info.result) {
        return info.result;
      }
      return info;
    } catch (error) {
      throw new KasaException(
        `Unable to read response from device: ${ip}: ${error.message}`
      );
    }
  }

  /**
   * Get Device from legacy 9999 response.
   * @param {Object} info - Discovery info
   * @param {DeviceConfig} config - Device config
   * @returns {Device} Device instance
   */
  static async _getDeviceInstanceLegacy(info, config) {
    // For legacy devices (port 9999), update config with IoT connection type
    const { DeviceConnectionParameters, DeviceFamily, DeviceEncryptionType } = await import('./deviceconfig.js');
    
    config.connectionType = new DeviceConnectionParameters(
      DeviceFamily.IotSmartPlugSwitch,
      DeviceEncryptionType.Xor
    );
    
    // Use device factory to create device instance
    const { connect } = await import('./devicefactory.js');
    return await connect({ config });
  }

  /**
   * Get Device from the new 20002 response.
   * @param {Object} info - Discovery info
   * @param {DeviceConfig} config - Device config
   * @returns {Device} Device instance
   */
  static async _getDeviceInstance(info, config) {
    // For new devices (port 20002), try to determine connection type from discovery info
    const { DeviceConnectionParameters, DeviceFamily, DeviceEncryptionType } = await import('./deviceconfig.js');

    // Try to determine device family from discovery info
    let deviceFamily = DeviceFamily.SmartTapoPlug; // Default for Smart devices
    let encryptionType = DeviceEncryptionType.Klap; // Default for Smart devices

    // Extract encryption type from discovery info
    if (info && info.mgt_encrypt_schm && info.mgt_encrypt_schm.encrypt_type) {
      const encryptTypeStr = info.mgt_encrypt_schm.encrypt_type.toLowerCase();
      if (encryptTypeStr === 'klap') {
        encryptionType = DeviceEncryptionType.Klap;
      } else if (encryptTypeStr === 'aes') {
        encryptionType = DeviceEncryptionType.Aes;
      }
    }

    // Simple heuristic based on device info
    if (info && info.device_type) {
      const deviceType = info.device_type.toLowerCase();
      if (deviceType.includes('plug')) {
        deviceFamily = DeviceFamily.SmartTapoPlug;
      } else if (deviceType.includes('bulb')) {
        deviceFamily = DeviceFamily.SmartTapoBulb;
      } else if (deviceType.includes('switch')) {
        // Handle both TAPOSWITCH and KASASWITCH
        if (deviceType.includes('kasa')) {
          deviceFamily = DeviceFamily.SmartKasaSwitch;
        } else {
          deviceFamily = DeviceFamily.SmartTapoSwitch;
        }
      } else if (deviceType.includes('cam')) {
        deviceFamily = DeviceFamily.SmartIpCamera;
      }
    }

    config.connectionType = new DeviceConnectionParameters(
      deviceFamily,
      encryptionType
    );

    // Set the correct port from discovery info if available
    if (info && info.mgt_encrypt_schm && info.mgt_encrypt_schm.http_port) {
      config.portOverride = info.mgt_encrypt_schm.http_port;
    }

    // Create device instance without connecting (like python-kasa)
    const { getDeviceClassFromFamily, getProtocol } = await import('./devicefactory.js');

    // Get the appropriate device class
    const DeviceClass = getDeviceClassFromFamily(info.device_type, { https: false });
    if (!DeviceClass) {
      throw new UnsupportedDeviceError(
        `Unsupported device type: ${info.device_type}`,
        { discoveryResult: info, host: config.host }
      );
    }

    // Create protocol without connecting
    const protocol = getProtocol({ config });
    if (!protocol) {
      throw new UnsupportedDeviceError(
        `Unsupported encryption scheme for ${config.host}`,
        { discoveryResult: info, host: config.host }
      );
    }

    // Create device instance
    const device = new DeviceClass(config.host, { config, protocol });

    // Update with discovery info instead of connecting immediately
    device.updateFromDiscoverInfo(info);

    return device;
  }
}

// Export XorEncryption and AES discovery for use in devicefactory.js
export { XorEncryption, _AesDiscoveryQuery };