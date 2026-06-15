/**
 * Implementation of matter module.
 */

import { Feature } from '../../feature.js';
import { SmartCamModule } from '../smartcammodule.js';

/**
 * Implementation of matter module.
 */
export class Matter extends SmartCamModule {
  static NAME = 'Matter';
  static QUERY_GETTER_NAME = 'getMatterSetupInfo';
  static QUERY_MODULE_NAME = 'matter';
  static REQUIRED_COMPONENT = 'matter';

  /**
   * Initialize features after the initial update.
   * @protected
   */
  _initializeFeatures() {
    this._addFeature(
      new Feature({
        device: this._device,
        id: 'matter_setup_code',
        name: 'Matter setup code',
        container: this,
        attributeGetter: () => this.info.setup_code,
        type: Feature.Type.Sensor,
        category: Feature.Category.Debug,
      })
    );
    this._addFeature(
      new Feature({
        device: this._device,
        id: 'matter_setup_payload',
        name: 'Matter setup payload',
        container: this,
        attributeGetter: () => this.info.setup_payload,
        type: Feature.Type.Sensor,
        category: Feature.Category.Debug,
      })
    );
  }

  /**
   * Matter setup info.
   * @returns {Object} Setup info
   */
  get info() {
    return this.data;
  }
}

SmartCamModule.registerModule(Matter);
