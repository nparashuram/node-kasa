import { Device } from './device';
import { Credentials } from './credentials';

export interface DiscoveryOptions {
  target?: string;
  onDiscovered?: (device: Device) => void;
  onDiscoveredRaw?: (raw: any) => void;
  discoveryTimeout?: number;
  discoveryPackets?: number;
  interface?: string;
  onUnsupported?: (error: Error) => void;
  credentials?: Credentials;
  username?: string;
  password?: string;
  port?: number;
  timeout?: number;
}

export interface DiscoverSingleOptions {
  discoveryTimeout?: number;
  port?: number;
  timeout?: number;
  credentials?: Credentials;
  username?: string;
  password?: string;
  onDiscoveredRaw?: (raw: any) => void;
  onUnsupported?: (error: Error) => void;
}

export class Discover {
  static discover(options?: DiscoveryOptions): Promise<Record<string, Device | any>>;
  static discoverSingle(host: string, options?: DiscoverSingleOptions): Promise<Device | null>;
}