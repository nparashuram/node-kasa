import { describe, test, expect, jest } from '@jest/globals';
import { Led } from '../kasa/smart/modules/led.js';
import { MotionSensor } from '../kasa/smart/modules/motionsensor.js';
import { ReportMode } from '../kasa/smart/modules/reportmode.js';
import { ChildSetup } from '../kasa/smart/modules/childsetup.js';
import { LightEffect } from '../kasa/smart/modules/lighteffect.js';
import { LightPreset } from '../kasa/smart/modules/lightpreset.js';

describe('Smart Modules Unit Tests', () => {
  const mockDevice = {
    protocol: {
      query: jest.fn()
    },
    sysInfo: {},
    _info: {},
    _children: new Map(),
    modules: {},
    internalState: {},
    _tryGetResponse: (states, key) => states[key]
  };

  test('Led module basic functionality', async () => {
    const led = new Led(mockDevice, 'led');
    mockDevice.internalState = { get_led_info: { led_rule: 'always' } };

    expect(led.led).toBe(true);
    expect(led.mode).toBe('always');

    mockDevice.protocol.query.mockResolvedValue({ set_led_info: { result: 0 } });
    await led.setLed(false);
    expect(mockDevice.protocol.query).toHaveBeenCalledWith({
      set_led_info: expect.objectContaining({ led_rule: 'never' })
    });
  });

  test('MotionSensor module basic functionality', () => {
    const motion = new MotionSensor(mockDevice, 'sensitivity');
    mockDevice.sysInfo.detected = true;
    expect(motion.motionDetected).toBe(true);
  });

  test('ReportMode module basic functionality', () => {
    const report = new ReportMode(mockDevice, 'report_mode');
    mockDevice.sysInfo.report_interval = 60;
    expect(report.reportInterval).toBe(60);
  });

  test('ChildSetup module basic functionality', async () => {
    const childSetup = new ChildSetup(mockDevice, 'child_quick_setup');
    mockDevice.internalState = {
      get_support_child_device_category: {
        device_category_list: [{ category: 'camera' }]
      }
    };
    await childSetup._postUpdateHook();
    expect(childSetup.supportedCategories).toContain('camera');

    // Test unpair and verify it calls the right method and returns correctly
    mockDevice.protocol.query.mockResolvedValue({ remove_child_device_list: { result: 0 } });
    mockDevice.update = jest.fn().mockResolvedValue({});
    await childSetup.unpair('123');
    expect(mockDevice.protocol.query).toHaveBeenCalledWith({
      remove_child_device_list: { child_device_list: [{ device_id: '123' }] }
    });
  });

  test('LightEffect module basic functionality', async () => {
    const lightEffect = new LightEffect(mockDevice, 'light_effect');
    mockDevice.internalState = {
      get_dynamic_light_effect_rules: {
        rule_list: [{ id: 'L1', scene_name: '' }]
      }
    };
    mockDevice._info.dynamic_light_effect_enable = true;
    mockDevice._info.dynamic_light_effect_id = 'L1';

    await lightEffect._postUpdateHook();
    expect(lightEffect.effect).toBe('Party');
    expect(lightEffect.effectList).toContain('Party');
    expect(lightEffect.isActive).toBe(true);
  });

  test('LightPreset module basic functionality', async () => {
    const lightPreset = new LightPreset(mockDevice, 'preset');
    mockDevice.internalState = {
      get_preset_rules: {
        states: [{ brightness: 50, color_temp: 2700 }]
      }
    };
    await lightPreset._postUpdateHook();
    expect(lightPreset.presetList).toContain('Light preset 1');
    expect(lightPreset.presetStatesList[0].brightness).toBe(50);
  });
});
