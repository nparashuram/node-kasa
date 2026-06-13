
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { transports } from '../kasa/transports/index.js';
const { SslTransport, SslAesTransport, LinkieTransportV2 } = transports;

describe('Transports Parity', () => {
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      host: '192.168.1.100',
      connectionType: { httpPort: null, https: true },
      credentials: { username: 'user', password: 'pass' }
    };
  });

  test('SslTransport initialization', () => {
    const transport = new SslTransport({ config: mockConfig });
    expect(transport).toBeDefined();
    expect(transport.defaultPort).toBe(4433);
  });

  test('SslAesTransport initialization', () => {
    const transport = new SslAesTransport({ config: mockConfig });
    expect(transport).toBeDefined();
    expect(transport.defaultPort).toBe(443);
  });

  test('LinkieTransportV2 initialization', () => {
    const transport = new LinkieTransportV2({ config: mockConfig });
    expect(transport).toBeDefined();
    expect(transport.defaultPort).toBe(10443);
  });
});
