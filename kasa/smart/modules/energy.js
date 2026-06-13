/**
 * Implementation of energy monitoring module for SMART devices.
 */

import { SmartModule } from '../smartmodule.js';
import { Energy as EnergyInterface } from '../../interfaces/energy.js';
import { EmeterStatus } from '../../emeterstatus.js';
import { DeviceError, KasaException } from '../../exceptions.js';

/**
 * Implementation of energy monitoring module.
 */
export class Energy extends SmartModule {
  static NAME = 'Energy';
  static REQUIRED_COMPONENT = 'energy_monitoring';

  constructor(device, module) {
    super(device, module);
    this._energy = {};
    this._currentConsumption = null;
    this._supported = 0;
  }

  /**
   * Return True if module supports the feature.
   * @param {number} moduleFeature - Feature to check from Energy.ModuleFeature
   * @returns {boolean} True if feature is supported
   */
  supports(moduleFeature) {
    return (moduleFeature & this._supported) !== 0;
  }

  /**
   * Perform actions after a device update.
   */
  async _postUpdateHook() {
    let data;
    try {
      data = this.data;
    } catch (err) {
      if (err instanceof DeviceError) {
        this._energy = {};
        this._currentConsumption = null;
        throw err;
      }
      throw err;
    }

    // If version is 1 then data is get_energy_usage
    this._energy = data.get_energy_usage || data;

    if (data.get_emeter_data && data.get_emeter_data.voltage_mv !== undefined) {
      this._supported |= EnergyInterface.ModuleFeature.VOLTAGE_CURRENT;
    }

    let power = this._energy.current_power;
    if (power === undefined && data.get_emeter_data) {
      power = data.get_emeter_data.power_mw;
      if (power !== undefined) {
        this._currentConsumption = power / 1000;
      } else {
        this._currentConsumption = null;
      }
    } else if (power !== undefined) {
      this._currentConsumption = power / 1000;
    } else {
      // Fallback if get_energy_usage does not provide current_power
      const currentPowerData = data.get_current_power;
      if (currentPowerData && currentPowerData.current_power !== undefined) {
        this._currentConsumption = currentPowerData.current_power;
      } else {
        this._currentConsumption = null;
      }
    }
  }

  /**
   * Query to execute during the update cycle.
   */
  query() {
    const req = {
      'get_energy_usage': null,
    };
    if (this.supportedVersion > 1) {
      req['get_current_power'] = null;
      req['get_emeter_data'] = null;
      req['get_emeter_vgain_igain'] = null;
    }
    return req;
  }

  /**
   * Return optional response keys for the module.
   */
  get optionalResponseKeys() {
    if (this.supportedVersion > 1) {
      return ['get_energy_usage'];
    }
    return [];
  }

  /**
   * Current power in watts.
   */
  get currentConsumption() {
    return this._currentConsumption;
  }

  /**
   * Return get_energy_usage results.
   */
  get energy() {
    return this._energy;
  }

  /**
   * Create EmeterStatus from energy data.
   * @private
   */
  _getStatusFromEnergy(energy) {
    return new EmeterStatus({
      'power_mw': energy.current_power || 0,
      'total': (energy.today_energy || 0) / 1000,
    });
  }

  /**
   * Get the emeter status.
   */
  get status() {
    if (this._lastUpdateError) {
      throw this._lastUpdateError;
    }
    if (this.data.get_emeter_data) {
      return new EmeterStatus(this.data.get_emeter_data);
    } else {
      return this._getStatusFromEnergy(this.energy);
    }
  }

  /**
   * Return real-time statistics.
   */
  async getStatus() {
    if (this.data.get_emeter_data) {
      const res = await this.call('get_emeter_data');
      return new EmeterStatus(res);
    } else {
      const res = await this.call('get_energy_usage');
      return this._getStatusFromEnergy(res);
    }
  }

  /**
   * Get the emeter value for this month in kWh.
   */
  get consumptionThisMonth() {
    if (this._energy.month_energy !== undefined) {
      return this._energy.month_energy / 1000;
    }
    return null;
  }

  /**
   * Get the emeter value for today in kWh.
   */
  get consumptionToday() {
    if (this._energy.today_energy !== undefined) {
      return this._energy.today_energy / 1000;
    }
    return null;
  }

  /**
   * Return total consumption since last reboot in kWh.
   */
  get consumptionTotal() {
    if (this._lastUpdateError) {
      throw this._lastUpdateError;
    }
    return null;
  }

  /**
   * Return the current in A.
   */
  get current() {
    if (this._lastUpdateError) {
      throw this._lastUpdateError;
    }
    const emeterData = this.data.get_emeter_data;
    if (emeterData && emeterData.current_ma !== undefined) {
      return emeterData.current_ma / 1000;
    }
    return null;
  }

  /**
   * Get the current voltage in V.
   */
  get voltage() {
    if (this._lastUpdateError) {
      throw this._lastUpdateError;
    }
    const emeterData = this.data.get_emeter_data;
    if (emeterData && emeterData.voltage_mv !== undefined) {
      return emeterData.voltage_mv / 1000;
    }
    return null;
  }

  /**
   * Erase all stats.
   */
  async eraseStats() {
    throw new KasaException('Device does not support periodic statistics');
  }

  /**
   * Return daily stats.
   */
  async getDailyStats({ year = null, month = null, kwh = true } = {}) {
    throw new KasaException('Device does not support periodic statistics');
  }

  /**
   * Return monthly stats.
   */
  async getMonthlyStats({ year = null, kwh = true } = {}) {
    throw new KasaException('Device does not support periodic statistics');
  }

  /**
   * Additional check to see if the module is supported by the device.
   */
  async _checkSupported() {
    // Energy module is not supported on P304M parent device
    return this._device.sysInfo.device_on !== undefined;
  }
}
