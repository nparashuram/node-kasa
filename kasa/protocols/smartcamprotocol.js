/**
 * Module for SmartCamProtocol.
 */

import { SmartProtocol } from './smartprotocol.js';
import {
  SmartErrorCode,
  AuthenticationError,
  DeviceError,
  KasaException,
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

// List of getMethodNames that should be sent as {"method":"do"}
// https://md.depau.eu/s/r1Ys_oWoP#Modules
const GET_METHODS_AS_DO = new Set([
  'getSdCardFormatStatus',
  'getConnectionType',
  'getUserID',
  'getP2PSharePassword',
  'getAESEncryptKey',
  'getFirmwareAFResult',
  'getWhitelampStatus',
]);

/**
 * Class for returning single request details from helper functions
 */
class SingleRequest {
  /**
     * Create a single request object
     * @param {string} methodType - Method type (get, set, do, multi)
     * @param {string} methodName - Method name
     * @param {string} paramName - Parameter name
     * @param {Object} request - Request object
     */
  constructor(methodType, methodName, paramName, request) {
    this.methodType = methodType;
    this.methodName = methodName;
    this.paramName = paramName;
    this.request = request;
  }
}

/**
 * Class for SmartCam Protocol
 */
export class SmartCamProtocol extends SmartProtocol {
  /**
     * Get a list request for pagination (SmartCam specific)
     * @private
     * @param {string} method - Method name
     * @param {Object|null} params - Parameters
     * @param {number} startIndex - Starting index
     * @returns {Object} List request object
     */
  _getListRequest(method, params, startIndex) {
    // All smartcam requests have params
    const moduleName = Object.keys(params)[0];
    return { [method]: { [moduleName]: { start_index: startIndex } } };
  }

  /**
     * Handle response error codes (SmartCam specific)
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

    if (errorCode === SmartErrorCode.SUCCESS) {
      return;
    }

    if (!raiseOnError) {
      respDict.result = errorCode;
      return;
    }

    const msg = `Error querying device: ${this._host}: ${errorCode.name}(${errorCode.value}) for method: ${method}`;
        
    if (SMART_RETRYABLE_ERRORS.has(errorCode)) {
      throw new RetryableError(msg, { errorCode });
    }
    if (SMART_AUTHENTICATION_ERRORS.has(errorCode)) {
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

  /**
     * Get a smart camera single request from request object
     * @static
     * @private
     * @param {Object} request - Request object with method and params
     * @returns {SingleRequest} Single request object
     */
  static _getSmartCameraSingleRequest(request) {
    const method = Object.keys(request)[0];
    if (method === 'multipleRequest') {
      const params = request.multipleRequest;
      const req = { method: 'multipleRequest', params };
      return new SingleRequest('multi', 'multipleRequest', '', req);
    }

    const param = Object.keys(request[method])[0];
    const req = {
      method: method,
      [param]: request[method][param],
    };
    return new SingleRequest(method, method, param, req);
  }

  /**
     * Convert camel or pascal case to snake case
     * @static
     * @private
     * @param {string} name - Name to convert
     * @returns {string} Snake case name
     */
  static _makeSnakeName(name) {
    return name.replace(/[A-Z]/g, (match, index) => 
      index === 0 ? match.toLowerCase() : '_' + match.toLowerCase()
    );
  }

  /**
     * Make a single request given a method name and no params
     * @static
     * @private
     * @param {string} request - Method name
     * @returns {SingleRequest} Single request object
     */
  static _makeSmartCameraSingleRequest(request) {
    const method = request;
    let methodType = request.slice(0, 3);
    const snakeName = SmartCamProtocol._makeSnakeName(request);
    let param = snakeName.slice(4);

    const shortMethod = method.slice(0, 3);
    if (['get', 'set'].includes(shortMethod) && !GET_METHODS_AS_DO.has(method)) {
      methodType = shortMethod;
      param = snakeName.slice(4);
    } else {
      methodType = 'do';
      param = snakeName;
    }

    const req = { method: methodType, [param]: {} };
    return new SingleRequest(methodType, method, param, req);
  }

  /**
     * Execute a single query (SmartCam specific)
     * @private
     * @param {string|Object} request - Request to send
     * @param {Object} options - Execution options
     * @param {number} options.retryCount - Current retry count
     * @param {boolean} [options.iterateListPages=true] - Whether to iterate list pages
     * @returns {Promise<Object>} Response from device
     */
  async _executeQuery(request, { retryCount, iterateListPages = true } = {}) {
    let singleRequest;

    if (typeof request === 'object') {
      const method = Object.keys(request)[0];
      if (Object.keys(request).length === 1 && 
                ['get', 'set', 'do', 'multipleRequest'].includes(method)) {
        singleRequest = SmartCamProtocol._getSmartCameraSingleRequest(request);
      } else {
        return await this._executeMultipleQuery(
          request, retryCount, iterateListPages
        );
      }
    } else {
      singleRequest = SmartCamProtocol._makeSmartCameraSingleRequest(request);
    }

    const smartRequest = JSON.stringify(singleRequest.request);
    const responseData = await this._transport.send(smartRequest);

    if ('error_code' in responseData) {
      // H200 does not return an error code
      this._handleResponseErrorCode(responseData, singleRequest.methodName);
    }

    // Requests that are invalid and raise PROTOCOL_FORMAT_ERROR when sent
    // as a multipleRequest will return {} when sent as a single request.
    if (singleRequest.methodType === 'get') {
      const section = Object.keys(responseData)[0];
      if (!section || responseData[section] === null || 
                (typeof responseData[section] === 'object' && 
                 Object.keys(responseData[section]).length === 0)) {
        throw new DeviceError(
          `No results for get request ${singleRequest.methodName}`
        );
      }
    }
    if (singleRequest.methodType === 'do') {
      return { [singleRequest.methodName]: responseData };
    }
    if (singleRequest.methodType === 'set') {
      return {};
    }
    if (singleRequest.methodType === 'multi') {
      return { [singleRequest.methodName]: responseData.result };
    }
    return {
      [singleRequest.methodName]: {
        [singleRequest.paramName]: responseData[singleRequest.paramName]
      }
    };
  }
}

/**
 * Protocol wrapper for controlling child camera devices.
 *
 * This is an internal class used to communicate with child devices,
 * and should not be used directly.
 *
 * This class overrides query() method of the protocol to modify all
 * outgoing queries to use `controlChild` command, and unwraps the
 * device responses before returning to the caller.
 */
export class _ChildCameraProtocolWrapper extends SmartProtocol {
  /**
     * Create a child camera protocol wrapper
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
     * Wrap request inside controlChild envelope
     * @param {string|Object} request - Request to send
     * @param {number} [retryCount=3] - Number of retries
     * @returns {Promise<Object>} Response from device
     */
  async query(request, retryCount = 3) {
    return await this._query(request, retryCount);
  }

  /**
     * Internal query method that wraps request inside controlChild envelope
     * @private
     * @param {string|Object} request - Request to send
     * @param {number} retryCount - Number of retries
     * @returns {Promise<Object>} Response from device
     */
  async _query(request, retryCount = 3) {
    if (typeof request !== 'object') {
      throw new KasaException('Child requests must be dictionaries.');
    }

    const requests = [];
    const methods = [];

    for (const [key, val] of Object.entries(request)) {
      const childRequest = {
        method: 'controlChild',
        params: {
          childControl: {
            device_id: this._deviceId,
            request_data: { method: key, params: val },
          }
        },
      };
      methods.push(key);
      requests.push(childRequest);
    }

    const multipleRequest = { multipleRequest: { requests } };
    const response = await this._protocol.query(multipleRequest, retryCount);

    const responses = response.multipleRequest.responses;
    const responseDict = {};

    // Raise errors for single calls
    const raiseOnError = requests.length === 1;

    for (const [indexId, responseItem] of responses.entries()) {
      const responseData = responseItem.result.response_data;
      const method = methods[indexId];
      this._handleResponseErrorCode(
        responseData, method, { raiseOnError }
      );
      responseDict[method] = responseData.result;
    }

    return responseDict;
  }

  /**
     * Do nothing as the parent owns the protocol
     * @returns {Promise<void>}
     */
  async close() {
    // Do nothing as the parent owns the protocol
  }
}