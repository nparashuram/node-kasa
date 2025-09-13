/**
 * Credentials class for username / passwords.
 */
export declare class Credentials {
  /** Username (email address) of the cloud account */
  username: string;
  /** Password of the cloud account */
  password: string;

  constructor(username?: string, password?: string);
}

/**
 * Return decoded default credentials.
 */
export declare function getDefaultCredentials(tuple: [string, string]): Credentials;

export declare const DEFAULT_CREDENTIALS: {
  KASA: [string, string];
  KASACAMERA: [string, string];
  TAPO: [string, string];
  TAPOCAMERA: [string, string];
};