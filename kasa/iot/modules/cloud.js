/**
 * Cloud module implementation.
 */

import { IotModule } from '../iotmodule.js';

/**
 * Module implementing support for cloud services.
 */
export class Cloud extends IotModule {
  /**
     * Return true if device is connected to the cloud.
     * @returns {boolean} Is connected
     */
  get isConnected() {
    return Boolean(this.info.cloud_connected);
  }

  /**
     * Request cloud connectivity info.
     * @returns {Object} Query object
     */
  query() {
    return this.queryForCommand('get_info');
  }

  /**
     * Return information about the cloud connectivity.
     * @returns {Object} Cloud info
     */
  get info() {
    const data = this.data.get_info;
    return {
      provisioned: data.binded,
      cloud_connected: data.cld_connection,
      firmware_download_page: data.fwDlPage,
      firmware_notify_type: data.fwNotifyType,
      illegal_type: data.illegalType,
      server: data.server,
      stop_connect: data.stopConnect,
      tcsp_info: data.tcspInfo,
      tcsp_status: data.tcspStatus,
      username: data.username
    };
  }

  /**
     * Return list of available firmwares.
     * @returns {Object} Request object
     */
  getAvailableFirmwares() {
    return this.queryForCommand('get_intl_fw_list');
  }

  /**
     * Set the update server URL.
     * @param {string} url - Update server URL
     * @returns {Object} Request object
     */
  setServer(url) {
    return this.queryForCommand('set_server_url', { 'server': url });
  }

  /**
     * Login to the cloud using given information.
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Object} Request object
     */
  connect(username, password) {
    return this.queryForCommand(
      'bind', { 'username': username, 'password': password }
    );
  }

  /**
     * Disconnect from the cloud.
     * @returns {Object} Request object
     */
  disconnect() {
    return this.queryForCommand('unbind');
  }
}
