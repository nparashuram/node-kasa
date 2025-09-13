# node-kasa

Node.js API for TP-Link Kasa and Tapo devices

This is a JavaScript/Node.js port of the popular [python-kasa](https://github.com/python-kasa/python-kasa) library, maintaining 1:1 API compatibility.

## Features

- Support for TP-Link Kasa and Tapo devices
- Device discovery on local network
- Control smart plugs, bulbs, light strips, switches, and more
- Energy monitoring for supported devices
- Async/await support throughout
- Same API as python-kasa for easy migration

## Installation

```bash
npm install node-kasa
```

## Quick Start

```javascript
import { Discover } from 'node-kasa';

// Discover devices on your network
const devices = await Discover.discover();
console.log(`Found ${Object.keys(devices).length} devices`);

// Connect to a specific device
const device = await Discover.discoverSingle('192.168.1.100');
await device.update();

console.log(`Device: ${device.alias}`);
console.log(`Model: ${device.model}`);
console.log(`Is On: ${device.isOn}`);

// Turn device on/off
await device.turnOn();
await device.turnOff();
```

## Device Types

### Smart Plugs
```javascript
import { iot } from 'node-kasa';

const plug = new iot.IotPlug('192.168.1.100');
await plug.update();

await plug.turnOn();
await plug.turnOff();
console.log(plug.isOn);
```

### Smart Bulbs
```javascript
import { iot } from 'node-kasa';

const bulb = new iot.IotBulb('192.168.1.101');
await bulb.update();

// Control brightness (0-100)
await bulb.setBrightness(50);

// Control color (if supported)
await bulb.setHsv(120, 100, 100); // Green

// Control color temperature (if supported)
await bulb.setColorTemp(3000);
```

## Authentication

For newer devices that require authentication:

```javascript
import { Discover, Credentials } from 'node-kasa';

const credentials = new Credentials('username@example.com', 'password');
const devices = await Discover.discover({ credentials });
```

## API Documentation

This library maintains the same API as python-kasa:

- `Device` - Base device class
- `Discover` - Device discovery utilities
- `iot.*` - IoT device classes (legacy protocol)
- `smart.*` - Smart device classes (newer protocol)
- `Credentials` - Authentication credentials

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## License

GPL-3.0-or-later

## Contributing

This project maintains API compatibility with python-kasa. Please ensure any changes preserve the same method signatures and behavior.