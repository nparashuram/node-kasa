/**
 * Configuration for connecting directly to a device without discovery.
 *
 * If you are connecting to a newer KASA or TAPO device you can get the device
 * via discovery or connect directly with DeviceConfig.
 *
 * Discovery returns a list of discovered devices:
 *
 * import { Discover, Device } from 'node-kasa';
 * const device = await Discover.discoverSingle(
 *     "127.0.0.3",
 *     { username: "user@example.com", password: "great_password" }
 * );
 * console.log(device.alias);  // Alias is null because update() has not been called
 * // null
 *
 * const configDict = device.config.toDict();
 * // DeviceConfig.toDict() can be used to store for later
 * console.log(configDict);
 * // {'host': '127.0.0.3', 'timeout': 5, 'credentials': {'username': 'user@example.com',
 * // 'password': 'great_password'}, 'connectionType': {'deviceFamily': 'SMART.TAPOBULB', 
 * // 'encryptionType': 'KLAP', 'loginVersion': 2, 'https': false, 'httpPort': 80}}
 *
 * const laterDevice = await Device.connect({config: Device.Config.fromDict(configDict)});
 * console.log(laterDevice.alias);  // Alias is available as connect() calls update()
 * // Living Room Bulb
 */

import { Credentials } from './credentials.js';
import { KasaException } from './exceptions.js';

/**
 * Class to represent a public/private key pair.
 */
export class KeyPairDict {
  constructor(privateKey = '', publicKey = '') {
    this.private = privateKey;
    this.public = publicKey;
  }
}

/**
 * Encrypt type enum.
 */
export class DeviceEncryptionType {
  static Klap = 'KLAP';
  static Aes = 'AES';
  static Xor = 'XOR';
}

/**
 * Device family enum.
 */
export class DeviceFamily {
  static IotSmartPlugSwitch = 'IOT.SMARTPLUGSWITCH';
  static IotSmartBulb = 'IOT.SMARTBULB';
  static IotIpCamera = 'IOT.IPCAMERA';
  static SmartKasaPlug = 'SMART.KASAPLUG';
  static SmartKasaSwitch = 'SMART.KASASWITCH';
  static SmartTapoPlug = 'SMART.TAPOPLUG';
  static SmartTapoBulb = 'SMART.TAPOBULB';
  static SmartTapoSwitch = 'SMART.TAPOSWITCH';
  static SmartTapoHub = 'SMART.TAPOHUB';
  static SmartKasaHub = 'SMART.KASAHUB';
  static SmartIpCamera = 'SMART.IPCAMERA';
  static SmartTapoRobovac = 'SMART.TAPOROBOVAC';
  static SmartTapoChime = 'SMART.TAPOCHIME';
  static SmartTapoDoorbell = 'SMART.TAPODOORBELL';
}

/**
 * Class to hold the parameters determining connection type.
 */
export class DeviceConnectionParameters {
  constructor(deviceFamily, encryptionType, loginVersion = null, https = false, httpPort = null) {
    this.deviceFamily = deviceFamily;
    this.encryptionType = encryptionType;
    this.loginVersion = loginVersion;
    this.https = https;
    this.httpPort = httpPort;
  }

  /**
   * Return connection parameters from string values.
   * @param {string} deviceFamily
   * @param {string} encryptionType
   * @param {Object} options
   * @param {number|null} options.loginVersion
   * @param {boolean|null} options.https
   * @param {number|null} options.httpPort
   * @returns {DeviceConnectionParameters}
   */
  static fromValues(deviceFamily, encryptionType, { loginVersion = null, https = null, httpPort = null } = {}) {
    try {
      if (https === null) {
        https = false;
      }
      
      // Validate enum values
      const validDeviceFamilies = Object.values(DeviceFamily);
      const validEncryptionTypes = Object.values(DeviceEncryptionType);
      
      if (!validDeviceFamilies.includes(deviceFamily)) {
        throw new Error(`Invalid device family: ${deviceFamily}`);
      }
      
      if (!validEncryptionTypes.includes(encryptionType)) {
        throw new Error(`Invalid encryption type: ${encryptionType}`);
      }
      
      return new DeviceConnectionParameters(
        deviceFamily,
        encryptionType,
        loginVersion,
        https,
        httpPort
      );
    } catch (ex) {
      throw new KasaException(
        `Invalid connection parameters for ${deviceFamily}.${encryptionType}.${loginVersion}`,
        { cause: ex }
      );
    }
  }

  toDict() {
    return {
      deviceFamily: this.deviceFamily,
      encryptionType: this.encryptionType,
      loginVersion: this.loginVersion,
      https: this.https,
      httpPort: this.httpPort
    };
  }
}

/**
 * Class to represent parameters that determine how to connect to devices.
 */
export class DeviceConfig {
  static DEFAULT_TIMEOUT = 5;
  
  constructor({
    host,
    timeout = DeviceConfig.DEFAULT_TIMEOUT,
    portOverride = null,
    credentials = null,
    credentialsHash = null,
    batchSize = null,
    connectionType = new DeviceConnectionParameters(
      DeviceFamily.IotSmartPlugSwitch,
      DeviceEncryptionType.Xor
    ),
    httpClient = null,
    aesKeys = null
  }) {
    /** IP address or hostname */
    this.host = host;
    /** Timeout for querying the device */
    this.timeout = timeout;
    /** Override the default 9999 port to support port forwarding */
    this.portOverride = portOverride;
    /** Credentials for devices requiring authentication */
    this.credentials = credentials;
    /** Credentials hash for devices requiring authentication */
    this.credentialsHash = credentialsHash;
    /** The batch size for protocols supporting multiple request batches */
    this.batchSize = batchSize;
    /** The protocol specific type of connection */
    this.connectionType = connectionType || new DeviceConnectionParameters(
      DeviceFamily.IotSmartPlugSwitch,
      DeviceEncryptionType.Xor
    );
    /** Set a custom http_client for the device to use */
    this.httpClient = httpClient;
    /** AES keys */
    this.aesKeys = aesKeys;
  }

  /**
   * True if the device uses http.
   * @returns {boolean}
   */
  get usesHttp() {
    const ctype = this.connectionType;
    return ctype.encryptionType !== DeviceEncryptionType.Xor || ctype.https;
  }

  /**
   * Convert deviceconfig to dict controlling how to serialize credentials.
   * @param {Object} options
   * @param {string|null} options.credentialsHash
   * @param {boolean} options.excludeCredentials
   * @returns {Object}
   */
  toDictControlCredentials({ credentialsHash = null, excludeCredentials = false } = {}) {
    if (credentialsHash === null) {
      if (!excludeCredentials) {
        return this.toDict();
      } else {
        const copy = { ...this };
        copy.credentials = null;
        return copy.toDict();
      }
    }

    const copy = { ...this };
    copy.credentials = credentialsHash === '' ? null : copy.credentials;
    copy.credentialsHash = credentialsHash === '' ? null : credentialsHash;
    return copy.toDict();
  }

  /**
   * Convert to dictionary representation.
   * @returns {Object}
   */
  toDict() {
    const result = {
      host: this.host,
      timeout: this.timeout
    };

    if (this.portOverride !== null) {
      result.portOverride = this.portOverride;
    }
    if (this.credentials !== null) {
      result.credentials = {
        username: this.credentials.username,
        password: this.credentials.password
      };
    }
    if (this.credentialsHash !== null) {
      result.credentialsHash = this.credentialsHash;
    }
    if (this.batchSize !== null) {
      result.batchSize = this.batchSize;
    }
    if (this.connectionType !== null) {
      result.connectionType = this.connectionType.toDict();
    }
    if (this.aesKeys !== null) {
      result.aesKeys = this.aesKeys;
    }

    return result;
  }

  /**
   * Create DeviceConfig from dictionary.
   * @param {Object} data - Dictionary representation
   * @returns {DeviceConfig}
   */
  static fromDict(data) {
    const credentials = data.credentials
      ? new Credentials(data.credentials.username, data.credentials.password)
      : null;
    
    const connectionType = data.connectionType
      ? new DeviceConnectionParameters(
        data.connectionType.deviceFamily,
        data.connectionType.encryptionType,
        data.connectionType.loginVersion,
        data.connectionType.https,
        data.connectionType.httpPort
      )
      : null;

    return new DeviceConfig({
      host: data.host,
      timeout: data.timeout,
      portOverride: data.portOverride,
      credentials,
      credentialsHash: data.credentialsHash,
      batchSize: data.batchSize,
      connectionType,
      httpClient: null, // Not serializable
      aesKeys: data.aesKeys
    });
  }
}