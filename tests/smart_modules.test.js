
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { smart } from '../kasa/index.js';
const { SmartDevice } = smart;

describe('Smart Modules', () => {
  let mockProtocol;
  let device;

  beforeEach(() => {
    mockProtocol = {
      query: jest.fn(),
      close: jest.fn(),
      _transport: {
        _credentials: { username: 'user', password: 'pass' }
      },
      config: { host: '192.168.1.100' }
    };
    device = new SmartDevice('192.168.1.100', { protocol: mockProtocol });
  });

  test('Energy module initialization and properties', async () => {
    mockProtocol.query
      .mockResolvedValueOnce({ // _negotiate
        'get_device_info': { model: 'P110', fw_ver: '1.0.0', device_on: true },
        'component_nego': { component_list: [{ id: 'energy_monitoring', ver_code: 2 }] }
      })
      .mockResolvedValueOnce({ // _modularUpdate
        'get_device_info': { model: 'P110', fw_ver: '1.0.0', device_on: true },
        'get_energy_usage': { today_energy: 1500, month_energy: 45000, current_power: 10000 },
        'get_emeter_data': { voltage_mv: 230000, current_ma: 500, power_mw: 10000 }
      })
      .mockResolvedValueOnce({ // _updateChildrenInfo
        'get_child_device_list': { child_device_list: [] },
        'get_child_device_component_list': { child_component_list: [] }
      });

    await device.update();

    const energy = device.modules.Energy;
    expect(energy).toBeDefined();
    expect(energy.currentConsumption).toBe(10); // 10000mw / 1000
    expect(energy.consumptionToday).toBe(1.5); // 1500wh / 1000
    expect(energy.consumptionThisMonth).toBe(45); // 45000wh / 1000
    expect(energy.voltage).toBe(230); // 230000mv / 1000
    expect(energy.current).toBe(0.5); // 500ma / 1000
  });

  test('Cloud module initialization', async () => {
    mockProtocol.query
      .mockResolvedValueOnce({ // _negotiate
        'get_device_info': { model: 'P110', device_on: true },
        'component_nego': { component_list: [{ id: 'cloud_connect', ver_code: 1 }] }
      })
      .mockResolvedValueOnce({ // _modularUpdate
        'get_device_info': { model: 'P110', device_on: true },
        'get_connect_cloud_state': { status: 0 }
      })
      .mockResolvedValueOnce({ // _updateChildrenInfo
        'get_child_device_list': { child_device_list: [] },
        'get_child_device_component_list': { child_component_list: [] }
      });

    await device.update();

    const cloud = device.modules.Cloud;
    expect(cloud).toBeDefined();
    expect(cloud.isConnected).toBe(true);
  });

  test('Time module initialization', async () => {
    mockProtocol.query
      .mockResolvedValueOnce({ // _negotiate
        'get_device_info': { model: 'P110', device_on: true },
        'component_nego': { component_list: [{ id: 'time', ver_code: 1 }] }
      })
      .mockResolvedValueOnce({ // _modularUpdate
        'get_device_info': { model: 'P110', device_on: true },
        'get_device_time': { timestamp: 1600000000, time_diff: 60 }
      })
      .mockResolvedValueOnce({ // _updateChildrenInfo
        'get_child_device_list': { child_device_list: [] },
        'get_child_device_component_list': { child_component_list: [] }
      });

    await device.update();

    const time = device.modules.Time;
    expect(time).toBeDefined();
    expect(time.time).toBeInstanceOf(Date);
    expect(time.timezone).toBe('UTC+60');
  });
});
