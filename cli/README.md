# Kasa CLI

Command-line interface for controlling TP-Link Kasa and Tapo smart devices using Node.js.

## Installation

Install the node-kasa package globally to use the CLI:

```bash
npm install -g node-kasa
```

Or use it locally in your project:

```bash
npm install node-kasa
npx kasa --help
```

## Usage

### Basic Commands

```bash
# Show help
kasa --help

# Show version
kasa --version

# Discover devices on the network
kasa discover

# Get device information
kasa info --host 192.168.1.100

# Turn device on
kasa on --host 192.168.1.100

# Turn device off
kasa off --host 192.168.1.100

# Reboot device
kasa reboot --host 192.168.1.100

# Send raw command (JSON format)
kasa raw '{"system":{"get_sysinfo":{}}}' --host 192.168.1.100
```

### Global Options

- `--host <host>`: Device hostname or IP address
- `--port <port>`: Device port (optional)
- `--verbose`: Enable verbose output
- `--debug`: Enable debug output
- `--json`: Output in JSON format
- `--timeout <seconds>`: Connection timeout (default: 5)
- `--discovery-timeout <seconds>`: Discovery timeout (default: 3)

### Environment Variables

You can also set options using environment variables:

- `KASA_HOST`: Default host
- `KASA_PORT`: Default port
- `KASA_VERBOSE`: Enable verbose output (set to any value)
- `KASA_DEBUG`: Enable debug output (set to any value)
- `KASA_JSON`: Enable JSON output (set to any value)
- `KASA_TIMEOUT`: Connection timeout
- `KASA_DISCOVERY_TIMEOUT`: Discovery timeout

### Examples

```bash
# Set default host via environment variable
export KASA_HOST=192.168.1.100
kasa info

# Enable JSON output
kasa info --host 192.168.1.100 --json

# Enable debug mode
kasa on --host 192.168.1.100 --debug

# Send a custom command
kasa raw '{"cnCloud":{"get_info":{}}}' --host 192.168.1.100
```

## Device Discovery

The discovery command will scan the network for Kasa devices using UDP broadcast packets on ports 9999 (legacy IoT devices) and 20002 (newer Smart devices).

If no devices are found, you can still connect to devices directly using the `--host` option.

## Comparison with Python-kasa CLI

This CLI aims to provide similar functionality to the original python-kasa CLI:

- ✅ Device connection and control
- ✅ Information retrieval
- ✅ Raw command support
- ✅ JSON output format
- ✅ Device discovery
- ✅ Environment variable support
- ✅ Multiple device types support (via raw commands)

## Supported Device Types

The CLI works with all TP-Link Kasa and Tapo devices supported by the node-kasa library:

- Smart Plugs
- Smart Bulbs  
- Smart Switches
- Smart Cameras
- And more...

## Troubleshooting

### Device Not Found

If you get connection errors:

1. Ensure the device is on the same network
2. Check the IP address is correct
3. Try increasing the timeout: `--timeout 10`
4. Enable debug output: `--debug`

### Authentication Issues

Some newer devices may require credentials. This will be supported in future versions.

## Contributing

The CLI is part of the node-kasa project. Contributions are welcome!

See the main project README for development setup and contribution guidelines.