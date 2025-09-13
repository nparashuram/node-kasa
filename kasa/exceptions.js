/**
 * node-kasa exceptions.
 */

/**
 * Base exception for library errors.
 */
export class KasaException extends Error {
  constructor(message) {
    super(message);
    this.name = 'KasaException';
  }
}

/**
 * Timeout exception for device errors.
 */
export class TimeoutError extends KasaException {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Connection exception for device errors.
 */
export class _ConnectionError extends KasaException {
  constructor(message) {
    super(message);
    this.name = '_ConnectionError';
  }
}

// Export without underscore for compatibility
export const ConnectionError = _ConnectionError;

/**
 * Exception for trying to connect to unsupported devices.
 */
export class UnsupportedDeviceError extends KasaException {
  constructor(message, options = {}) {
    super(message);
    this.name = 'UnsupportedDeviceError';
    this.discoveryResult = options.discoveryResult;
    this.host = options.host;
  }
}

/**
 * Base exception for device errors.
 */
export class DeviceError extends KasaException {
  constructor(message, options = {}) {
    super(message);
    this.name = 'DeviceError';
    this.errorCode = options.errorCode || null;
  }

  toString() {
    const errCode = this.errorCode ? ` (error_code=${this.errorCode.name})` : '';
    return super.toString() + errCode;
  }
}

/**
 * Base exception for device authentication errors.
 */
export class AuthenticationError extends DeviceError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'AuthenticationError';
  }
}

/**
 * Retryable exception for device errors.
 */
export class _RetryableError extends DeviceError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = '_RetryableError';
  }
}

// Export without underscore for compatibility
export const RetryableError = _RetryableError;

/**
 * Enum for SMART Error Codes.
 */
export class SmartErrorCode {
  static SUCCESS = 0;

  // Transport Errors
  static SESSION_TIMEOUT_ERROR = 9999;
  static MULTI_REQUEST_FAILED_ERROR = 1200;
  static HTTP_TRANSPORT_FAILED_ERROR = 1112;
  static LOGIN_FAILED_ERROR = 1111;
  static HAND_SHAKE_FAILED_ERROR = 1100;
  static TRANSPORT_UNKNOWN_CREDENTIALS_ERROR = 1003;
  static TRANSPORT_NOT_AVAILABLE_ERROR = 1002;
  static CMD_COMMAND_CANCEL_ERROR = 1001;
  static NULL_TRANSPORT_ERROR = 1000;

  // Common Method Errors
  static COMMON_FAILED_ERROR = -1;
  static UNSPECIFIC_ERROR = -1001;
  static UNKNOWN_METHOD_ERROR = -1002;
  static JSON_DECODE_FAIL_ERROR = -1003;
  static JSON_ENCODE_FAIL_ERROR = -1004;
  static AES_DECODE_FAIL_ERROR = -1005;
  static REQUEST_LEN_ERROR_ERROR = -1006;
  static CLOUD_FAILED_ERROR = -1007;
  static PARAMS_ERROR = -1008;
  static INVALID_PUBLIC_KEY_ERROR = -1010;
  static SESSION_PARAM_ERROR = -1101;

  // Method Specific Errors
  static QUICK_SETUP_ERROR = -1201;
  static DEVICE_ERROR = -1301;
  static DEVICE_NEXT_EVENT_ERROR = -1302;
  static FIRMWARE_ERROR = -1401;
  static FIRMWARE_VER_ERROR_ERROR = -1402;
  static LOGIN_ERROR = -1501;
  static TIME_ERROR = -1601;
  static TIME_SYS_ERROR = -1602;
  static TIME_SAVE_ERROR = -1603;
  static WIRELESS_ERROR = -1701;
  static WIRELESS_UNSUPPORTED_ERROR = -1702;
  static SCHEDULE_ERROR = -1801;
  static SCHEDULE_FULL_ERROR = -1802;
  static SCHEDULE_CONFLICT_ERROR = -1803;
  static SCHEDULE_SAVE_ERROR = -1804;
  static SCHEDULE_INDEX_ERROR = -1805;
  static COUNTDOWN_ERROR = -1901;
  static COUNTDOWN_CONFLICT_ERROR = -1902;
  static COUNTDOWN_SAVE_ERROR = -1903;
  static ANTITHEFT_ERROR = -2001;
  static ANTITHEFT_CONFLICT_ERROR = -2002;
  static ANTITHEFT_SAVE_ERROR = -2003;
  static ACCOUNT_ERROR = -2101;
  static STAT_ERROR = -2201;
  static STAT_SAVE_ERROR = -2202;
  static DST_ERROR = -2301;
  static DST_SAVE_ERROR = -2302;

  static VACUUM_BATTERY_LOW = -3001;

  static SYSTEM_ERROR = -40101;
  static INVALID_ARGUMENTS = -40209;

  // Camera error codes
  static SESSION_EXPIRED = -40401;
  static BAD_USERNAME = -40411;
  static HOMEKIT_LOGIN_FAIL = -40412;
  static DEVICE_BLOCKED = -40404;
  static DEVICE_FACTORY = -40405;
  static OUT_OF_LIMIT = -40406;
  static OTHER_ERROR = -40407;
  static SYSTEM_BLOCKED = -40408;
  static NONCE_EXPIRED = -40409;
  static FFS_NONE_PWD = -90000;
  static TIMEOUT_ERROR = 40108;
  static UNSUPPORTED_METHOD = -40106;
  static ONE_SECOND_REPEAT_REQUEST = -40109;
  static INVALID_NONCE = -40413;
  static PROTOCOL_FORMAT_ERROR = -40210;
  static IP_CONFLICT = -40321;
  static DIAGNOSE_TYPE_NOT_SUPPORT = -69051;
  static DIAGNOSE_TASK_FULL = -69052;
  static DIAGNOSE_TASK_BUSY = -69053;
  static DIAGNOSE_INTERNAL_ERROR = -69055;
  static DIAGNOSE_ID_NOT_FOUND = -69056;
  static DIAGNOSE_TASK_NULL = -69057;
  static CLOUD_LINK_DOWN = -69060;
  static ONVIF_SET_WRONG_TIME = -69061;
  static CLOUD_NTP_NO_RESPONSE = -69062;
  static CLOUD_GET_WRONG_TIME = -69063;
  static SNTP_SRV_NO_RESPONSE = -69064;
  static SNTP_GET_WRONG_TIME = -69065;
  static LINK_UNCONNECTED = -69076;
  static WIFI_SIGNAL_WEAK = -69077;
  static LOCAL_NETWORK_POOR = -69078;
  static CLOUD_NETWORK_POOR = -69079;
  static INTER_NETWORK_POOR = -69080;
  static DNS_TIMEOUT = -69081;
  static DNS_ERROR = -69082;
  static PING_NO_RESPONSE = -69083;
  static DHCP_MULTI_SERVER = -69084;
  static DHCP_ERROR = -69085;
  static STREAM_SESSION_CLOSE = -69094;
  static STREAM_BITRATE_EXCEPTION = -69095;
  static STREAM_FULL = -69096;
  static STREAM_NO_INTERNET = -69097;
  static HARDWIRED_NOT_FOUND = -72101;

  // Library internal for unknown error codes
  static INTERNAL_UNKNOWN_ERROR = -100000;
  static INTERNAL_QUERY_ERROR = -100001;

  static fromInt(value) {
    // Find the error code by value
    for (const [key, errorValue] of Object.entries(SmartErrorCode)) {
      if (typeof errorValue === 'number' && errorValue === value) {
        return { name: key, value: errorValue };
      }
    }
    return { name: 'UNKNOWN', value };
  }

  toString() {
    return `${this.name}(${this.value})`;
  }
}

export const SMART_RETRYABLE_ERRORS = [
  SmartErrorCode.TRANSPORT_NOT_AVAILABLE_ERROR,
  SmartErrorCode.HTTP_TRANSPORT_FAILED_ERROR,
  SmartErrorCode.UNSPECIFIC_ERROR,
  SmartErrorCode.SESSION_TIMEOUT_ERROR,
  SmartErrorCode.SESSION_EXPIRED,
  SmartErrorCode.INVALID_NONCE,
];

export const SMART_AUTHENTICATION_ERRORS = [
  SmartErrorCode.LOGIN_ERROR,
  SmartErrorCode.LOGIN_FAILED_ERROR,
  SmartErrorCode.AES_DECODE_FAIL_ERROR,
  SmartErrorCode.HAND_SHAKE_FAILED_ERROR,
  SmartErrorCode.TRANSPORT_UNKNOWN_CREDENTIALS_ERROR,
  SmartErrorCode.HOMEKIT_LOGIN_FAIL,
];