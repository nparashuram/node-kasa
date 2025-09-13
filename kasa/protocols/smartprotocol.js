/**
 * Implementation of the TP-Link AES Protocol.
 *
 * Based on the work of https://github.com/petretiandrea/plugp100
 * under compatible GNU GPL3 license.
 */

import { randomBytes } from 'crypto';
import { BaseProtocol, maskMac, md5, redactData } from './protocol.js';
import {
  AuthenticationError,
  DeviceError,
  KasaException,
  SmartErrorCode,
  TimeoutError,
  ConnectionError,
  RetryableError,
} from '../exceptions.js';

// Smart error code sets (would be imported from exceptions.js)
const SMART_RETRYABLE_ERRORS = new Set([
  SmartErrorCode.SESSION_EXPIRED,
  SmartErrorCode.DEVICE_BUSY,
  SmartErrorCode.TRANSPORT_UNKNOWN_CREDENTIALS_ERROR,
]);

const SMART_AUTHENTICATION_ERRORS = new Set([
  SmartErrorCode.LOGIN_ERROR,
  SmartErrorCode.TRANSPORT_UNKNOWN_CREDENTIALS_ERROR,
]);

const LOGGER = console; // Using console as logger for now

/**
 * Mask area list for privacy
 * @param {Array} areaList - Array of areas
 * @returns {Array} Masked area list
 */
function maskAreaList(areaList) {
  const maskArea = (area) => {
    const result = { ...area };
    // Will leave empty names as blank
    if (area.name) {
      result.name = 'I01BU0tFRF9OQU1FIw=='; // #MASKED_NAME#
    }
    return result;
  };

  return areaList.map(maskArea);
}

/**
 * Data redactors for sensitive information
 */
const REDACTORS = {
  latitude: () => 0,
  longitude: () => 0,
  la: () => 0,  // lat on ks240
  lo: () => 0,  // lon on ks240
  device_id: (x) => 'REDACTED_' + x.slice(9),
  parent_device_id: (x) => 'REDACTED_' + x.slice(9),  // Hub attached children
  original_device_id: (x) => 'REDACTED_' + x.slice(9),  // Strip children
  nickname: (x) => x ? 'I01BU0tFRF9OQU1FIw==' : '',
  mac: maskMac,
  ssid: (x) => x ? 'I01BU0tFRF9TU0lEIw==' : '',
  bssid: () => '000000000000',
  channel: () => 0,
  oem_id: (x) => 'REDACTED_' + x.slice(9),
  hw_id: (x) => 'REDACTED_' + x.slice(9),
  fw_id: (x) => 'REDACTED_' + x.slice(9),
  setup_code: (x) => x.replace(/\w/g, '0'),  // matter
  setup_payload: (x) => x.replace(/\w/g, '0'),  // matter
  mfi_setup_code: (x) => x.replace(/\w/g, '0'),  // mfi_ for homekit
  mfi_setup_id: (x) => x.replace(/\w/g, '0'),
  mfi_token_token: (x) => x.replace(/\w/g, '0'),
  mfi_token_uuid: (x) => x.replace(/\w/g, '0'),
  ip: (x) => x,  // don't redact but keep listed here for dump_devinfo
  // smartcam
  dev_id: (x) => 'REDACTED_' + x.slice(9),
  ext_addr: (x) => 'REDACTED_' + x.slice(9),
  device_name: (x) => x ? '#MASKED_NAME#' : '',
  device_alias: (x) => x ? '#MASKED_NAME#' : '',
  alias: (x) => x ? '#MASKED_NAME#' : '',  // child info on parent uses alias
  local_ip: (x) => x,  // don't redact but keep listed here for dump_devinfo
  // robovac
  board_sn: () => '000000000000',
  custom_sn: () => '000000000000',
  location: (x) => x ? '#MASKED_NAME#' : '',
  map_data: (x) => x ? '#SCRUBBED_MAPDATA#' : '',
  map_name: () => 'I01BU0tFRF9OQU1FIw==',  // #MASKED_NAME#
  area_list: maskAreaList,
  // unknown robovac binary blob in get_device_info
  cd: () => 'I01BU0tFRF9CSU5BUlkj',  // #MASKED_BINARY#
};

// Queries that are known not to work properly when sent as a
// multiRequest. They will not return the `method` key.
const FORCE_SINGLE_REQUEST = new Set([
  'getConnectStatus',
  'scanApList',
]);

/**
 * Class for the new TPLink SMART protocol
 */
export class SmartProtocol extends BaseProtocol {
  static BACKOFF_SECONDS_AFTER_TIMEOUT = 1;
  static DEFAULT_MULTI_REQUEST_BATCH_SIZE = 5;

  /**
     * Create a protocol object
     * @param {Object} options - Protocol options
     * @param {BaseTransport} options.transport - Transport instance
     */
  constructor({ transport }) {
    super({ transport });
    this._terminalUuid = Buffer.from(md5(randomBytes(16))).toString('base64');
    this._queryLock = false; // Simple lock mechanism for JavaScript
    this._multiRequestBatchSize = 
            this._transport._config.batchSize || SmartProtocol.DEFAULT_MULTI_REQUEST_BATCH_SIZE;
    this._redactData = true;
    this._methodMissingLogged = false;
  }

  /**
     * Get a request message as a string
     * @param {string} method - Method name
     * @param {Object|null} [params] - Request parameters
     * @returns {string} Request JSON string
     */
  getSmartRequest(method, params = null) {
    const request = {
      method: method,
      request_time_milis: Math.round(Date.now()),
      terminal_uuid: this._terminalUuid,
    };
    if (params) {
      request.params = params;
    }
    return JSON.stringify(request);
  }

  /**
     * Query the device retrying for retryCount on failure
     * @param {string|Object} request - Request to send
     * @param {number} [retryCount=3] - Number of retries
     * @returns {Promise<Object>} Response from device
     */
  async query(request, retryCount = 3) {
    // Simple lock mechanism
    while (this._queryLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this._queryLock = true;

    try {
      return await this._query(request, retryCount);
    } finally {
      this._queryLock = false;
    }
  }

  /**
     * Internal query method with retry logic
     * @private
     * @param {string|Object} request - Request to send
     * @param {number} retryCount - Number of retries
     * @returns {Promise<Object>} Response from device
     */
  async _query(request, retryCount = 3) {
    for (let retry = 0; retry <= retryCount; retry++) {
      try {
        return await this._executeQuery(
          request, { retryCount: retry, iterateListPages: true }
        );
      } catch (error) {
        if (error instanceof ConnectionError) {
          if (retry >= retryCount) {
            throw error;
          }
          continue;
        } else if (error instanceof AuthenticationError) {
          await this._transport.reset();
          throw error;
        } else if (error instanceof RetryableError) {
          await this._transport.reset();
          if (retry >= retryCount) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, SmartProtocol.BACKOFF_SECONDS_AFTER_TIMEOUT * 1000));
          continue;
        } else if (error instanceof TimeoutError) {
          await this._transport.reset();
          if (retry >= retryCount) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, SmartProtocol.BACKOFF_SECONDS_AFTER_TIMEOUT * 1000));
          continue;
        } else if (error instanceof KasaException) {
          await this._transport.reset();
          throw error;
        } else {
          // Catch any unhandled error types
          await this._transport.reset();
          throw error;
        }
      }
    }

    // make this should never be reached
    throw new KasaException('Query reached somehow to unreachable');
  }

  /**
     * Execute multiple queries as batch
     * @private
     * @param {Object} requests - Map of method names to parameters
     * @param {number} retryCount - Current retry count
     * @param {boolean} iterateListPages - Whether to iterate list pages
     * @returns {Promise<Object>} Response from device
     */
  async _executeMultipleQuery(requests, retryCount, iterateListPages) {
    const multiResult = {};
    const smartMethod = 'multipleRequest';

    const requestCount = Object.keys(requests).length;
    // The SmartCamProtocol sends requests with a length 1 as a
    // multipleRequest. The SmartProtocol doesn't so will never
    // raise_on_error
    const raiseOnError = requestCount === 1;

    const multiRequests = Object.entries(requests)
      .filter(([method]) => !FORCE_SINGLE_REQUEST.has(method))
      .map(([method, params]) => 
        params ? { method, params } : { method }
      );

    // Break the requests down as there can be a size limit
    const step = this._multiRequestBatchSize;
    if (step === 1) {
      // If step is 1 do not send request batches
      for (const request of multiRequests) {
        const method = request.method;
        const req = this.getSmartRequest(method, request.params);
        const resp = await this._transport.send(req);
        this._handleResponseErrorCode(
          resp, method, { raiseOnError }
        );
        multiResult[method] = resp.result;
      }
      return multiResult;
    }

    const batches = [];
    for (let i = 0; i < requestCount; i += step) {
      batches.push(multiRequests.slice(i, i + step));
    }

    for (const [batchNum, requestsStep] of batches.entries()) {
      const smartParams = { requests: requestsStep };
      const smartRequest = this.getSmartRequest(smartMethod, smartParams);
      const batchName = `multi-request-batch-${batchNum + 1}-of-${batches.length}`;

      const responseStep = await this._transport.send(smartRequest);

      try {
        this._handleResponseErrorCode(responseStep, batchName);
      } catch (error) {
        // P100 sometimes raises JSON_DECODE_FAIL_ERROR or INTERNAL_UNKNOWN_ERROR
        // on batched request so disable batching
        if (error instanceof DeviceError && 
                    [SmartErrorCode.JSON_DECODE_FAIL_ERROR, SmartErrorCode.INTERNAL_UNKNOWN_ERROR]
                      .includes(error.errorCode) &&
                    this._multiRequestBatchSize !== 1) {
          this._multiRequestBatchSize = 1;
          throw new RetryableError(
            'JSON Decode failure, multi requests disabled', { cause: error }
          );
        }
        throw error;
      }

      const responses = responseStep.result.responses;
      for (const response of responses) {
        // some smartcam devices calls do not populate the method key
        // these should be defined in FORCE_SINGLE_REQUEST.
        const method = response.method;
        if (!method) {
          if (!this._methodMissingLogged) {
            // Avoid spamming the logs
            this._methodMissingLogged = true;
          }
          // These will end up being queried individually
          continue;
        }

        this._handleResponseErrorCode(response, method, { raiseOnError });
        const result = response.result || null;
        const requestParams = requests[method] || null;
        if (iterateListPages && result) {
          await this._handleResponseLists(
            result, method, requestParams, { retryCount }
          );
        }
        multiResult[method] = result;
      }
    }

    // Multi requests don't continue after errors so requery any missing.
    // Will also query individually any FORCE_SINGLE_REQUEST.
    for (const [method, params] of Object.entries(requests)) {
      if (!(method in multiResult)) {
        const resp = await this._transport.send(
          this.getSmartRequest(method, params)
        );
        this._handleResponseErrorCode(resp, method, { raiseOnError });
        multiResult[method] = resp.result;
      }
    }
    return multiResult;
  }

  /**
     * Execute a single query
     * @private
     * @param {string|Object} request - Request to send
     * @param {Object} options - Execution options
     * @param {number} options.retryCount - Current retry count
     * @param {boolean} [options.iterateListPages=true] - Whether to iterate list pages
     * @returns {Promise<Object>} Response from device
     */
  async _executeQuery(request, { retryCount, iterateListPages = true } = {}) {
    let smartMethod, smartParams;

    if (typeof request === 'object') {
      if (Object.keys(request).length === 1) {
        smartMethod = Object.keys(request)[0];
        smartParams = request[smartMethod];
      } else {
        return await this._executeMultipleQuery(
          request, retryCount, iterateListPages
        );
      }
    } else {
      smartMethod = request;
      smartParams = null;
    }

    const smartRequest = this.getSmartRequest(smartMethod, smartParams);
    const responseData = await this._transport.send(smartRequest);

    this._handleResponseErrorCode(responseData, smartMethod);

    // Single set_ requests do not return a result
    const result = responseData.result;
    if (iterateListPages && result) {
      await this._handleResponseLists(
        result, smartMethod, smartParams, { retryCount }
      );
    }
    return { [smartMethod]: result };
  }

  /**
     * Get a list request for pagination
     * @private
     * @param {string} method - Method name
     * @param {Object|null} params - Parameters
     * @param {number} startIndex - Starting index
     * @returns {Object} List request object
     */
  _getListRequest(method, params, startIndex) {
    return { [method]: { start_index: startIndex } };
  }

  /**
     * Handle paginated response lists
     * @private
     * @param {Object} responseResult - Response result object
     * @param {string} method - Method name
     * @param {Object|null} params - Parameters
     * @param {Object} options - Options
     * @param {number} options.retryCount - Retry count
     * @returns {Promise<void>}
     */
  async _handleResponseLists(responseResult, method, params, { retryCount }) {
    if (!responseResult || 
            responseResult instanceof SmartErrorCode ||
            !('start_index' in responseResult) ||
            !responseResult.sum) {
      return;
    }

    const responseListName = Object.keys(responseResult)
      .find(key => Array.isArray(responseResult[key]));

    if (!responseListName) return;

    while (responseResult[responseListName].length < responseResult.sum) {
      const listLength = responseResult[responseListName].length;
      const request = this._getListRequest(method, params, listLength);
      const response = await this._executeQuery(
        request, { retryCount, iterateListPages: false }
      );
      const nextBatch = response[method];
      // In case the device returns empty lists avoid infinite looping
      if (!nextBatch[responseListName] || nextBatch[responseListName].length === 0) {
        break;
      }
      responseResult[responseListName].push(...nextBatch[responseListName]);
    }
  }

  /**
     * Handle response error codes
     * @private
     * @param {Object} respDict - Response dictionary
     * @param {string} method - Method name
     * @param {Object} [options] - Options
     * @param {boolean} [options.raiseOnError=true] - Whether to raise on error
     */
  _handleResponseErrorCode(respDict, method, { raiseOnError = true } = {}) {
    const errorCodeRaw = respDict.error_code;
    let errorCode;
    try {
      errorCode = SmartErrorCode.fromInt(errorCodeRaw);
    } catch (error) {
      errorCode = SmartErrorCode.INTERNAL_UNKNOWN_ERROR;
    }

    if (errorCode.value === SmartErrorCode.SUCCESS) {
      return;
    }

    if (!raiseOnError) {
      respDict.result = errorCode;
      return;
    }

    const msg = `Error querying device: ${this._host}: ${errorCode.name}(${errorCode.value}) for method: ${method}`;
        
    if (SMART_RETRYABLE_ERRORS.has(errorCode.value)) {
      throw new RetryableError(msg, { errorCode });
    }
    if (SMART_AUTHENTICATION_ERRORS.has(errorCode.value)) {
      throw new AuthenticationError(msg, { errorCode });
    }
    throw new DeviceError(msg, { errorCode });
  }

  /**
     * Close the underlying transport
     * @returns {Promise<void>}
     */
  async close() {
    await this._transport.close();
  }
}

/**
 * Protocol wrapper for controlling child devices.
 *
 * This is an internal class used to communicate with child devices,
 * and should not be used directly.
 *
 * This class overrides query() method of the protocol to modify all
 * outgoing queries to use `control_child` command, and unwraps the
 * device responses before returning to the caller.
 */
export class _ChildProtocolWrapper extends SmartProtocol {
  /**
     * Create a child protocol wrapper
     * @param {string} deviceId - Child device ID
     * @param {SmartProtocol} baseProtocol - Base protocol instance
     */
  constructor(deviceId, baseProtocol) {
    // Call super() with the transport from base protocol
    super({ transport: baseProtocol._transport });
    this._deviceId = deviceId;
    this._protocol = baseProtocol;
    // this._transport is already set by super()
  }

  /**
     * Get method and params for request
     * @private
     * @param {Object|string} request - Request object or string
     * @returns {Array} [method, params] tuple
     */
  _getMethodAndParamsForRequest(request) {
    let smartMethod, smartParams;

    if (typeof request === 'object') {
      if (Object.keys(request).length === 1) {
        smartMethod = Object.keys(request)[0];
        smartParams = request[smartMethod];
      } else {
        smartMethod = 'multipleRequest';
        const requests = Object.entries(request).map(([method, params]) =>
          params ? { method, params } : { method }
        );
        smartParams = { requests };
      }
    } else {
      smartMethod = request;
      smartParams = null;
    }

    return [smartMethod, smartParams];
  }

  /**
     * Wrap request inside control_child envelope
     * @param {string|Object} request - Request to send
     * @param {number} [retryCount=3] - Number of retries
     * @returns {Promise<Object>} Response from device
     */
  async query(request, retryCount = 3) {
    return await this._query(request, retryCount);
  }

  /**
     * Internal query method that wraps request inside control_child envelope
     * @private
     * @param {string|Object} request - Request to send
     * @param {number} retryCount - Number of retries
     * @returns {Promise<Object>} Response from device
     */
  async _query(request, retryCount = 3) {
    const [method, params] = this._getMethodAndParamsForRequest(request);
    const requestData = {
      method: method,
      params: params,
    };
    const wrappedPayload = {
      control_child: {
        device_id: this._deviceId,
        requestData: requestData,
      }
    };

    const response = await this._protocol.query(wrappedPayload, retryCount);
    const result = response.control_child;
        
    // Unwrap responseData for control_child
    if (result && result.responseData) {
      const unwrappedResult = result.responseData.result;
      if (unwrappedResult && unwrappedResult.responses) {
        const retVal = {};
        for (const multiResponse of unwrappedResult.responses) {
          const responseMethod = multiResponse.method;
          this._handleResponseErrorCode(
            multiResponse, responseMethod, { raiseOnError: false }
          );
          retVal[responseMethod] = multiResponse.result;
        }
        return retVal;
      }

      this._handleResponseErrorCode(result.responseData, 'control_child');
    }

    return { [method]: result };
  }

  /**
     * Do nothing as the parent owns the protocol
     * @returns {Promise<void>}
     */
  async close() {
    // Do nothing as the parent owns the protocol
  }
}