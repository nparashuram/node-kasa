/**
 * Implementation of lens mask privacy module.
 */

import { SmartCamModule } from '../smartcammodule.js';

/**
 * Implementation of lens mask module.
 */
export class LensMask extends SmartCamModule {
  static REQUIRED_COMPONENT = 'lensMask';
  static NAME = 'lensmask';
  static QUERY_GETTER_NAME = 'getLensMaskConfig';

  /**
     * Return the lens mask state.
     * @returns {boolean} Enabled
     */
  get enabled() {
    return this.data.lens_mask_info.enabled === 'on';
  }

  /**
     * Set the lens mask state.
     * @param {boolean} enable - True to enable privacy mask
     * @returns {Promise<Object>} Result
     */
  async setEnabled(enable) {
    const params = { 'enabled': enable ? 'on' : 'off' };
    return await this._device._querySetterHelper(
      'setLensMaskConfig', 'lens_mask', 'lens_mask_info', params
    );
  }
}

SmartCamModule.registerModule(LensMask);
