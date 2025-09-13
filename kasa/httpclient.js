/**
 * Module for HttpClient class.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { KasaException, TimeoutError, ConnectionError } from './exceptions.js';
import { loads as jsonLoads } from './json.js';

/**
 * HttpClient Class for device communication.
 */
export class HttpClient {
  // Some devices (only P100 so far) close the http connection after each request
  // If a Client OS error is received the http client will start ensuring that 
  // sequential requests have a wait delay.
  static WAIT_BETWEEN_REQUESTS_ON_OSERROR = 0.25;

  /**
   * Create an HttpClient.
   * @param {Object} config - Device configuration object
   */
  constructor(config) {
    this._config = config;
    this._lastUrl = new URL(`http://${this._config.host}/`);
    this._waitBetweenRequests = 0.0;
    this._lastRequestTime = 0.0;
    this._cookies = new Map();
  }

  /**
   * Send an http post request to the device.
   *
   * If the request is provided via the json parameter json will be returned.
   * @param {URL|string} url - URL to post to
   * @param {Object} options - Request options
   * @param {Object|null} [options.params] - URL parameters
   * @param {Buffer|string|null} [options.data] - Request body data
   * @param {Object|null} [options.json] - JSON data to send
   * @param {Object|null} [options.headers] - Request headers
   * @param {Object|null} [options.cookiesDict] - Cookies to send
   * @param {boolean} [options.ssl=false] - Whether to use SSL
   * @returns {Promise<[number, Object|Buffer|null]>} Status code and response data
   */
  async post(url, {
    params = null,
    data = null,
    json = null,
    headers = null,
    cookiesDict = null,
    ssl = false
  } = {}) {
    // Once we know a device needs a wait between sequential queries always wait
    // first rather than keep erroring then waiting.
    if (this._waitBetweenRequests) {
      const now = Date.now() / 1000;
      const gap = now - this._lastRequestTime;
      if (gap < this._waitBetweenRequests) {
        const sleep = this._waitBetweenRequests - gap;
        await new Promise(resolve => setTimeout(resolve, sleep * 1000));
      }
    }

    if (typeof url === 'string') {
      url = new URL(url);
    }

    let responseData = null;
    this._lastUrl = url;
    this._cookies.clear();
    const returnJson = Boolean(json);

    if (this._config.timeout === null) {
      // Request timeout is set to null - using default
    }

    const timeout = this._config.timeout || 30000; // 30 second default

    // If json is not an object send as data.
    // This allows the json parameter to be used to pass other
    // types of data and still have json returned.
    if (json && typeof json !== 'object') {
      data = json;
      json = null;
    }

    // Prepare request options
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': json ? 'application/json' : 'application/octet-stream',
        ...headers
      },
      timeout
    };

    // Add cookies if provided
    if (cookiesDict) {
      const cookieHeader = Object.entries(cookiesDict)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      requestOptions.headers['Cookie'] = cookieHeader;
    }

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const requestData = json ? JSON.stringify(json) : data;
    if (requestData) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(requestData);
    }

    try {
      const [statusCode, responseBody] = await this._makeRequest(url, requestOptions, requestData, ssl);
      
      if (statusCode === 200) {
        if (returnJson && responseBody) {
          responseData = jsonLoads(responseBody.toString());
        } else {
          responseData = responseBody;
        }
      } else {
        if (responseBody && returnJson) {
          try {
            responseData = jsonLoads(responseBody.toString());
          } catch (e) {
          }
        } else {
          responseData = responseBody;
        }
      }

      return [statusCode, responseData];
      
    } catch (error) {
      if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
        if (!this._waitBetweenRequests) {
          this._waitBetweenRequests = HttpClient.WAIT_BETWEEN_REQUESTS_ON_OSERROR;
        }
        this._lastRequestTime = Date.now() / 1000;
        throw new ConnectionError(
          `Device connection error: ${this._config.host}: ${error.message}`, error
        );
      } else if (error.code === 'ETIMEDOUT') {
        throw new TimeoutError(
          `Unable to query the device, timed out: ${this._config.host}: ${error.message}`,
          error
        );
      } else {
        throw new KasaException(
          `Unable to query the device: ${this._config.host}: ${error.message}`, error
        );
      }
    } finally {
      // For performance only request system time if waiting is enabled
      if (this._waitBetweenRequests) {
        this._lastRequestTime = Date.now() / 1000;
      }
    }
  }

  /**
   * Make the actual HTTP request.
   * @param {URL} url - URL to request
   * @param {Object} options - Request options
   * @param {string|Buffer} requestData - Request body
   * @param {boolean} ssl - Whether to use SSL
   * @returns {Promise<[number, Buffer]>} Status code and response body
   * @private
   */
  _makeRequest(url, options, requestData, ssl) {
    return new Promise((resolve, reject) => {
      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(url, options, (res) => {
        const chunks = [];
        
        // Handle cookies
        const setCookies = res.headers['set-cookie'];
        if (setCookies) {
          setCookies.forEach(cookie => {
            const [nameValue] = cookie.split(';');
            const [name, value] = nameValue.split('=');
            if (name && value) {
              this._cookies.set(name.trim(), value.trim());
            }
          });
        }

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const responseBody = Buffer.concat(chunks);
          resolve([res.statusCode, responseBody]);
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        const timeoutError = new Error('Request timeout');
        timeoutError.code = 'ETIMEDOUT';
        reject(timeoutError);
      });

      if (requestData) {
        req.write(requestData);
      }
      
      req.end();
    });
  }

  /**
   * Return the cookie with cookie_name.
   * @param {string} cookieName - Name of cookie to get
   * @returns {string|null} Cookie value or null if not found
   */
  getCookie(cookieName) {
    return this._cookies.get(cookieName) || null;
  }

  /**
   * Close the HTTP client (no-op in Node.js implementation).
   * @returns {Promise<void>}
   */
  async close() {
    // No persistent connection to close in this implementation
  }
}