/**
 * Implementation of the usage interface.
 */

import { IotModule, merge } from '../iotmodule.js';

/**
 * Baseclass for emeter/usage interfaces.
 */
export class Usage extends IotModule {
  /**
     * Return the base query.
     * @returns {Object} Query object
     */
  query() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    let req = this.queryForCommand('get_realtime');
    req = merge(
      req, this.queryForCommand('get_daystat', { 'year': year, 'month': month })
    );
    req = merge(req, this.queryForCommand('get_monthstat', { 'year': year }));

    return req;
  }

  /**
     * Estimated maximum query response size.
     * @returns {number} Estimated size
     */
  get estimatedQueryResponseSize() {
    return 2048;
  }

  /**
     * Return statistics on daily basis.
     * @returns {Array<Object>} Daily stats
     */
  get dailyData() {
    return this.data.get_daystat.day_list || [];
  }

  /**
     * Return statistics on monthly basis.
     * @returns {Array<Object>} Monthly stats
     */
  get monthlyData() {
    return this.data.get_monthstat.month_list || [];
  }

  /**
     * Return today's usage in minutes.
     * @returns {number|null} Usage today
     */
  get usageToday() {
    const today = new Date().getDate();
    // Traverse the list in reverse order to find the latest entry.
    const dailyData = this.dailyData;
    for (let i = dailyData.length - 1; i >= 0; i--) {
      if (dailyData[i].day === today) {
        return dailyData[i].time;
      }
    }
    return null;
  }

  /**
     * Return usage in this month in minutes.
     * @returns {number|null} Usage this month
     */
  get usageThisMonth() {
    const thisMonth = new Date().getMonth() + 1;
    // Traverse the list in reverse order to find the latest entry.
    const monthlyData = this.monthlyData;
    for (let i = monthlyData.length - 1; i >= 0; i--) {
      if (monthlyData[i].month === thisMonth) {
        return monthlyData[i].time;
      }
    }
    return null;
  }

  /**
     * Return raw daily stats for the given year & month.
     * @param {Object} options - Options
     * @param {number} [options.year] - Year
     * @param {number} [options.month] - Month
     * @returns {Promise<Object>} Raw stats
     */
  async getRawDaystat({ year = null, month = null } = {}) {
    if (year === null) year = new Date().getFullYear();
    if (month === null) month = new Date().getMonth() + 1;

    return await this.call('get_daystat', { 'year': year, 'month': month });
  }

  /**
     * Return raw monthly stats for the given year.
     * @param {Object} options - Options
     * @param {number} [options.year] - Year
     * @returns {Promise<Object>} Raw stats
     */
  async getRawMonthstat({ year = null } = {}) {
    if (year === null) year = new Date().getFullYear();

    return await this.call('get_monthstat', { 'year': year });
  }

  /**
     * Return daily stats for the given year & month.
     * @param {Object} options - Options
     * @param {number} [options.year] - Year
     * @param {number} [options.month] - Month
     * @returns {Promise<Object>} Stats keyed by day
     */
  async getDaystat({ year = null, month = null } = {}) {
    const data = await this.getRawDaystat({ year, month });
    return this._convertStatData(data.day_list, 'day');
  }

  /**
     * Return monthly stats for the given year.
     * @param {Object} options - Options
     * @param {number} [options.year] - Year
     * @returns {Promise<Object>} Stats keyed by month
     */
  async getMonthstat({ year = null } = {}) {
    const data = await this.getRawMonthstat({ year });
    return this._convertStatData(data.month_list, 'month');
  }

  /**
     * Erase all stats.
     * @returns {Promise<Object>} Command result
     */
  async eraseStats() {
    return await this.call('erase_runtime_stat');
  }

  /**
     * Return usage information keyed with the day/month.
     * @param {Array<Object>} data - Raw stats data
     * @param {string} entryKey - Key for indexing (day or month)
     * @returns {Object} Keyed stats
     * @private
     */
  _convertStatData(data, entryKey) {
    if (!data) return {};

    const res = {};
    for (const entry of data) {
      res[entry[entryKey]] = entry.time;
    }
    return res;
  }
}
