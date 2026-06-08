/**
 * Base implementation for all rule-based modules.
 */

import { IotModule, merge } from '../iotmodule.js';

/**
 * Action to perform.
 */
export const Action = {
  Disabled: -1,
  TurnOff: 0,
  TurnOn: 1,
  Unknown: 2
};

/**
 * Time when the action is executed.
 */
export const TimeOption = {
  Disabled: -1,
  Enabled: 0,
  AtSunrise: 1,
  AtSunset: 2
};

/**
 * Base class for rule-based modules, such as countdown and antitheft.
 */
export class RuleModule extends IotModule {
  /**
     * Prepare the query for rules.
     * @returns {Object} Query object
     */
  query() {
    const q = this.queryForCommand('get_rules');
    return merge(q, this.queryForCommand('get_next_action'));
  }

  /**
     * Return the list of rules for the service.
     * @returns {Array<Object>} List of rules
     */
  get rules() {
    try {
      return this.data.get_rules.rule_list || [];
    } catch (ex) {
      console.error('Unable to read rule list:', ex, this.data);
      return [];
    }
  }

  /**
     * Enable or disable the service.
     * @param {boolean} state - True to enable, false to disable
     * @returns {Promise<Object>} Command result
     */
  async setEnabled(state) {
    return await this.call('set_overall_enable', { 'enable': state ? 1 : 0 });
  }

  /**
     * Delete the given rule.
     * @param {Object} rule - Rule object with id
     * @returns {Promise<Object>} Command result
     */
  async deleteRule(rule) {
    return await this.call('delete_rule', { 'id': rule.id });
  }

  /**
     * Delete all rules.
     * @returns {Promise<Object>} Command result
     */
  async deleteAllRules() {
    return await this.call('delete_all_rules');
  }
}
