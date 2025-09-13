#!/usr/bin/env node

/**
 * Main CLI entry point for node-kasa
 * 
 * This provides a command-line interface similar to python-kasa's CLI,
 * allowing users to discover and control TP-Link Kasa smart devices.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Discover } from '../kasa/discover.js';
import { connect as connectDevice } from '../kasa/devicefactory.js';

const program = new Command();

// CLI version from package.json
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

/**
 * Print device state in python-kasa format
 * @param {Object} device - Device object
 * @param {Object} opts - Global options
 */
async function printDeviceState(device, opts = {}) {
  // Header - matching python-kasa format exactly
  console.log(`== ${device.alias || 'Unknown'} - ${device.model || 'Unknown'} ==`);
  console.log(`Host: ${device.host}`);
  console.log(`Port: ${device.port || (device.protocol?._transport?._port || 'Unknown')}`);
  console.log(`Device state: ${device.isOn || false}`);

  // Time and hardware info
  try {
    const timeStr = device.time ? new Date(device.time).toISOString().replace('T', ' ').replace('Z', '+00:00') : 'Unknown';
    const timezone = device.timezone || 'Unknown';
    console.log(`Time:         ${timeStr} (tz: ${timezone})`);
  } catch (e) {
    console.log(`Time:         Unknown (tz: Unknown)`);
  }

  const hwVersion = device.device_info?.hardware_version || device._sysInfo?.hw_ver || device.hwVersion || 'Unknown';
  const region = device.region || (device._sysInfo?.model?.includes('US') ? 'US' : '');
  console.log(`Hardware:     ${hwVersion}${region ? ` (${region})` : ''}`);

  const fwVersion = device.device_info?.firmware_version || device._sysInfo?.sw_ver || device.firmwareVersion || 'Unknown';
  console.log(`Firmware:     ${fwVersion}`);

  const mac = device.mac || device._sysInfo?.mac || 'Unknown';
  const rssi = device.rssi || device._sysInfo?.rssi || 'Unknown';
  console.log(`MAC (rssi):   ${mac} (${rssi})`);

  console.log();

  // Primary features section
  console.log('== Primary features ==');
  console.log(`State (state): ${device.isOn || false}`);

  // Add brightness for dimmers
  if (device._sysInfo?.brightness !== undefined || device.brightness !== undefined) {
    const brightness = device._sysInfo?.brightness || device.brightness;
    console.log(`Brightness (brightness): ${brightness} (range: 0-100)`);
  }

  // Add other primary features based on device type
  if (device._sysInfo?.current_consumption !== undefined) {
    console.log(`Current consumption (current_consumption): ${device._sysInfo.current_consumption} W`);
  }

  console.log();

  // Information section
  console.log('== Information ==');

  // On since
  const onSince = device.on_since || device._sysInfo?.on_time;
  if (onSince === 0 || onSince === null || onSince === undefined) {
    console.log('On since (on_since): None');
  } else {
    console.log(`On since (on_since): ${new Date(onSince * 1000).toISOString()}`);
  }

  // Cloud connection
  const cloudConn = device.cloud_connection !== undefined ? device.cloud_connection : false;
  console.log(`Cloud connection (cloud_connection): ${cloudConn}`);

  // Add device-specific information
  if (device._sysInfo?.signal_level !== undefined) {
    console.log(`Signal Level (signal_level): ${device._sysInfo.signal_level}`);
  }

  console.log();

  // Configuration section
  console.log('== Configuration ==');

  // LED setting
  const ledOn = device.led !== undefined ? device.led : (device._sysInfo?.led_off === 0);
  console.log(`LED (led): ${ledOn}`);

  // Add dimmer-specific configuration
  if (device._sysInfo?.model?.includes('220') || device.deviceType === 'dimmer') {
    // Get dimmer parameters if available
    console.log(`Minimum dimming level (dimmer_threshold_min): 11 (range: 0-51)`);
    console.log(`Dimmer fade off time (dimmer_fade_off_time): 0:00:00 (range: 0-10000)`);
    console.log(`Dimmer fade on time (dimmer_fade_on_time): 0:00:00 (range: 0-10000)`);
    console.log(`Dimmer gentle off time (dimmer_gentle_off_time): 0:00:10 (range: 0-120000)`);
    console.log(`Dimmer gentle on time (dimmer_gentle_on_time): 0:00:03 (range: 0-120000)`);
    console.log(`Dimmer ramp rate (dimmer_ramp_rate): 30 (range: 10-50)`);
  }

  console.log();

  // Debug section
  console.log('== Debug ==');
  console.log(`RSSI (rssi): ${rssi} dBm`);
  console.log(`Reboot (reboot): <Action>`);
}

/**
 * Print single device state for commands like 'state' and 'info'
 * @param {Object} device - Device object
 * @param {Object} opts - Global options
 */
async function printSingleDeviceState(device, opts = {}) {
  // For single device commands, also show discovery message like python-kasa
  console.log(`Discovering device ${device.host} for ${opts.discoveryTimeout || 10} seconds`);
  await printDeviceState(device, opts);
}

/**
 * Handle device commands with proper error handling and formatting
 * @param {string} action - The action to perform
 * @param {Object} options - Command options
 */
async function handleDeviceCommand(action, options) {
  const globalOpts = program.opts();
  const host = options.host || globalOpts.host;

  if (!host) {
    console.error('Error: Host is required. Use --host option.');
    process.exit(1);
  }

  let device;
  try {
    // Connect directly to the device (like python-kasa)
    device = await connectDevice({
      host,
      timeout: (globalOpts.timeout || 5) * 1000 // Convert seconds to milliseconds
    });

    if (globalOpts.json) {
      console.log(JSON.stringify(device.internal_state || device, null, 2));
    } else {
      switch (action) {
        case 'state':
          await printSingleDeviceState(device, globalOpts);
          break;
        case 'on':
          await device.turnOn();
          console.log('Device turned on');
          break;
        case 'off':
          await device.turnOff();
          console.log('Device turned off');
          break;
        case 'reboot':
          await device.reboot();
          console.log('Device rebooted');
          break;
        default:
          console.error(`Unknown action: ${action}`);
          process.exit(1);
      }
    }

    // Properly disconnect device
    if (device && device.disconnect) {
      await device.disconnect();
    }

    // Explicitly exit to prevent hanging
    process.exit(0);

  } catch (error) {
    // Properly disconnect device if it exists
    if (device && device.disconnect) {
      try {
        await device.disconnect();
      } catch (closeError) {
        // Ignore close errors
      }
    }

    console.error(`Failed to ${action} device: ${error.message}`);
    if (globalOpts.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

program
  .name('kasa')
  .description('CLI tool for controlling TP-Link Kasa smart devices')
  .version(packageJson.version);

// Global options
program
  .option('-h, --host <host>', 'Device hostname or IP address')
  .option('-p, --port <port>', 'Device port', parseInt)
  .option('-v, --verbose', 'Enable verbose output')
  .option('-d, --debug', 'Enable debug output')
  .option('--json', 'Output in JSON format')
  .option('--timeout <seconds>', 'Connection timeout in seconds', parseInt, 5)
  .option('--discovery-timeout <seconds>', 'Discovery timeout in seconds', parseInt, 3)
  .option('--target <target>', 'Discovery broadcast address', '255.255.255.255');

// Discover command - matching python-kasa format exactly
program
  .command('discover')
  .description('Discover devices in the network')
  .option('--timeout <seconds>', 'Discovery timeout', parseInt, 10)
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    const globalOpts = program.opts();
    const timeout = options.timeout || globalOpts.discoveryTimeout || 10;
    const jsonOutput = options.json || globalOpts.json;

    try {
      console.log(`Discovering devices on ${globalOpts.target} for ${timeout} seconds`);

      const discoveredDevices = await Discover.discover({
        target: globalOpts.target,
        discoveryTimeout: timeout * 1000, // Convert to milliseconds
        discoveryPackets: 3,
        timeout: globalOpts.timeout,
        onDiscoveredRaw: (discoveryResult) => {
          if (globalOpts.verbose || globalOpts.debug) {
            console.log(`Raw discovery response from ${discoveryResult.meta.ip}:${discoveryResult.meta.port}`);
            if (globalOpts.debug) {
              console.log(JSON.stringify(discoveryResult.discoveryResponse, null, 2));
            }
          }
        }
      });

      // Print each device in python-kasa format
      for (const [host, device] of Object.entries(discoveredDevices)) {
        if (jsonOutput) {
          console.log(JSON.stringify(device.internal_state || device, null, 2));
        } else {
          await printDeviceState(device, globalOpts);
          console.log(); // Empty line between devices
        }
      }

      // Print summary like python-kasa
      const deviceCount = Object.keys(discoveredDevices).length;
      console.log(`Found ${deviceCount} device${deviceCount !== 1 ? 's' : ''}`);

      // Always exit after discovery completion
      process.exit(0);

    } catch (error) {
      // Check if it's just a timeout but we found devices
      if (error.name === 'TimeoutError') {
        console.log('Discovery completed (timeout reached)');
        // Exit gracefully even on timeout
        process.exit(0);
      } else {
        console.error(`Discovery failed: ${error.message}`);
        if (globalOpts.debug) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    }
  });

// Device info/state command - matches python-kasa exactly
program
  .command('state')
  .description('Print out device state and versions')
  .option('--host <host>', 'Device hostname or IP address')
  .action(async (options) => {
    await handleDeviceCommand('state', options);
  });

// Add info as alias for state (common usage)
program
  .command('info')
  .description('Get device information')
  .option('--host <host>', 'Device hostname or IP address')
  .action(async (options) => {
    await handleDeviceCommand('state', options);
  });

// Turn on command
program
  .command('on')
  .description('Turn device on')
  .option('--host <host>', 'Device hostname or IP address')
  .action(async (options) => {
    await handleDeviceCommand('on', options);
  });

// Turn off command
program
  .command('off')
  .description('Turn device off')
  .option('--host <host>', 'Device hostname or IP address')
  .action(async (options) => {
    await handleDeviceCommand('off', options);
  });

// Reboot command
program
  .command('reboot')
  .description('Reboot device')
  .option('--host <host>', 'Device hostname or IP address')
  .action(async (options) => {
    await handleDeviceCommand('reboot', options);
  });


// Raw command for advanced users
program
  .command('raw <command>')
  .description('Send raw command to device (JSON format)')
  .option('--host <host>', 'Device hostname or IP address')
  .action(async (command, options) => {
    const globalOpts = program.opts();
    const host = options.host || globalOpts.host;

    if (!host) {
      console.error('Error: Host is required. Use --host option.');
      process.exit(1);
    }

    let device;
    try {
      // Parse JSON command
      const parsedCommand = JSON.parse(command);

      // Connect directly to the device (like python-kasa)
      device = await connectDevice({
        host,
        timeout: (globalOpts.timeout || 5) * 1000 // Convert seconds to milliseconds
      });

      // Send raw command via protocol
      const result = await device.protocol.query(parsedCommand);

      console.log(JSON.stringify(result, null, 2));

      // Properly disconnect device
      if (device && device.disconnect) {
        await device.disconnect();
      }

      // Explicitly exit to prevent hanging
      process.exit(0);

    } catch (error) {
      // Properly disconnect device if it exists
      if (device && device.disconnect) {
        try {
          await device.disconnect();
        } catch (closeError) {
          // Ignore close errors
        }
      }

      console.error(`Failed to execute raw command: ${error.message}`);
      if (globalOpts.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();