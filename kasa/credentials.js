/**
 * Credentials class for username / passwords.
 */

/**
 * Credentials for authentication.
 */
export class Credentials {
  constructor(username = '', password = '') {
    /** Username (email address) of the cloud account */
    this.username = username;
    /** Password of the cloud account */
    this.password = password;
  }

  /**
   * Compare credentials for equality.
   * @param {Credentials} other - Other credentials to compare
   * @returns {boolean} True if credentials are equal
   */
  equals(other) {
    return this.username === other.username && this.password === other.password;
  }
}

/**
 * Return decoded default credentials.
 * @param {Array<string>} tuple - Array containing base64 encoded username and password
 * @returns {Credentials}
 */
export function getDefaultCredentials(tuple) {
  const un = Buffer.from(tuple[0], 'base64').toString('utf8');
  const pw = Buffer.from(tuple[1], 'base64').toString('utf8');
  return new Credentials(un, pw);
}

export const DEFAULT_CREDENTIALS = {
  'KASA': ['a2FzYUB0cC1saW5rLm5ldA==', 'a2FzYVNldHVw'],
  'KASACAMERA': ['YWRtaW4=', 'MjEyMzJmMjk3YTU3YTVhNzQzODk0YTBlNGE4MDFmYzM='],
  'TAPO': ['dGVzdEB0cC1saW5rLm5ldA==', 'dGVzdA=='],
  'TAPOCAMERA': ['YWRtaW4=', 'YWRtaW4=']
};