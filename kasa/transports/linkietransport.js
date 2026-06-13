/**
 * Implementation of the linkie kasa camera transport.
 */

import { URL } from 'url';
import { BaseTransport } from './basetransport.js';
import { DEFAULT_CREDENTIALS, getDefaultCredentials } from '../credentials.js';
import { KasaException, RetryableError } from '../exceptions.js';
import { HttpClient } from '../httpclient.js';
import { XorEncryption } from './xortransport.js';

/**
 * Implementation of the Linkie encryption protocol.
 *
 * Linkie is used as the endpoint for TP-Link's camera encryption
 * protocol, used by newer firmware versions.
 */
export class LinkieTransportV2 extends BaseTransport {
  static DEFAULT_PORT = 10443;

  /**
     * Create a LinkieTransportV2 instance
     */
  constructor({ config }) {
    super({ config });
    this._httpClient = new HttpClient(config);
    this._appUrl = new URL(`https://${this._host}:${this._port}/data/LINKIE2.json`);

    this._headers = {
      'Authorization': `Basic ${this.credentialsHash}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  /**
     * Default port for the transport
     */
  get defaultPort() {
    if (this._config.connectionType.httpPort) {
      return this._config.connectionType.httpPort;
    }
    return LinkieTransportV2.DEFAULT_PORT;
  }

  /**
     * The hashed credentials used by the transport
     */
  get credentialsHash() {
    const creds = getDefaultCredentials(DEFAULT_CREDENTIALS.KASACAMERA);
    const credsCombined = `${creds.username}:${creds.password}`;
    return Buffer.from(credsCombined, 'utf8').toString('base64');
  }

  /**
     * Execute a query on the device and wait for the response
     * @private
     */
  async _executeSend(request) {
    // Port XOR encryption logic (omit length header)
    const encryptedCmd = XorEncryption.encrypt(request).slice(4);
    const b64Cmd = encryptedCmd.toString('base64');
    const urlSafeCmd = encodeURIComponent(b64Cmd);

    const [statusCode, response] = await this._httpClient.post(
      this._appUrl,
      {
        headers: this._headers,
        data: `content=${urlSafeCmd}`,
        ssl: true
      }
    );

    if (statusCode !== 200) {
      throw new KasaException(
        `${this._host} responded with an unexpected status code ${statusCode} to passthrough`
      );
    }

    try {
      const decryptedResponse = XorEncryption.decrypt(Buffer.from(response.toString('utf8'), 'base64'));
      return JSON.parse(decryptedResponse);
    } catch (ex) {
      // Handle error payload
      try {
        const errorPayload = JSON.parse(response.toString('utf8'));
        throw new KasaException(`Device ${this._host} send error: ${JSON.stringify(errorPayload)}`);
      } catch (e) {
        throw new KasaException(`Unable to read response: ${ex.message}`);
      }
    }
  }

  async send(request) {
    try {
      return await this._executeSend(request);
    } catch (ex) {
      await this.reset();
      throw new RetryableError(
        `Unable to query the device ${this._host}:${this._port}: ${ex.message}`
      );
    }
  }

  async close() {
    await this._httpClient.close();
  }

  async reset() {
    // NOOP for this transport
  }
}
