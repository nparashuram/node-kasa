/**
 * Parity tests to ensure modules exist and have basic expected interfaces.
 */

import { describe, test, expect } from '@jest/globals';
import * as iotModules from '../kasa/iot/modules/index.js';
import * as smartModules from '../kasa/smart/modules/index.js';
import * as smartCamModules from '../kasa/smartcam/modules/index.js';

describe('IoT Module Parity', () => {
  const expectedModules = [
    'Emeter', 'RuleModule', 'Schedule', 'Antitheft', 'Countdown',
    'Time', 'Led', 'Cloud', 'Usage', 'Motion', 'AmbientLight',
    'Light', 'LightPreset', 'LightEffect', 'Dimmer'
  ];

  test.each(expectedModules)('%s module should be exported', (moduleName) => {
    expect(iotModules[moduleName]).toBeDefined();
  });
});

describe('Smart Module Parity', () => {
  const expectedModules = [
    'DeviceModule', 'Cloud', 'Time', 'Firmware', 'Light', 'Energy',
    'Brightness', 'Color', 'ColorTemperature', 'AutoOff', 'BatterySensor',
    'ContactSensor', 'HumiditySensor', 'TemperatureSensor', 'WaterleakSensor',
    'TemperatureControl', 'ChildLock', 'ChildProtection', 'PowerProtection',
    'TriggerLogs', 'Alarm', 'Fan', 'Thermostat', 'LightStripEffect',
    'FrostProtection', 'OverheatProtection', 'LightTransition',
    'Clean', 'Speaker', 'Consumables', 'Dustbin', 'Mop', 'CleanRecords'
  ];

  test.each(expectedModules)('%s module should be exported', (moduleName) => {
    expect(smartModules[moduleName]).toBeDefined();
  });
});

describe('SmartCam Module Parity', () => {
  const expectedModules = [
    'Camera', 'LensMask', 'ChildDevice', 'DeviceModule', 'MotionDetection', 'PersonDetection',
    'DetectionModule', 'PetDetection', 'BabyCryDetection', 'BarkDetection', 'MeowDetection',
    'GlassDetection', 'VehicleDetection', 'TamperDetection', 'LineCrossingDetection',
    'PanTilt', 'Battery', 'Led'
  ];

  test.each(expectedModules)('%s module should be exported', (moduleName) => {
    expect(smartCamModules[moduleName]).toBeDefined();
  });
});
