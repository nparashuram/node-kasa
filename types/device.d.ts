import { Module } from './module';
import { Feature } from './feature';

export class Device {
  alias: string;
  mac: string;
  model: string;
  host: string;
  isOn: boolean;
  isDimmable?: boolean;
  isColor?: boolean;
  requiresAuth?: boolean;
  modules: Record<string, Module>;
  features: Record<string, Feature>;

  update(): Promise<void>;
  turnOn(): Promise<void>;
  turnOff(): Promise<void>;
  setAlias(alias: string): Promise<void>;
}