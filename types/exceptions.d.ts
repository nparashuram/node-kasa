export class KasaException extends Error {}
export class AuthenticationError extends KasaException {}
export class DeviceError extends KasaException {}
export class UnsupportedDeviceError extends KasaException {}
export class TimeoutError extends KasaException {}