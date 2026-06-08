/**
 * SMART modules index.
 */

import { SmartModule } from '../smartmodule.js';
import { Energy } from './energy.js';
import { Cloud } from './cloud.js';
import { Time } from './time.js';
import { Brightness } from './brightness.js';
import { Color } from './color.js';
import { ColorTemperature } from './colortemperature.js';
import { Light } from './light.js';
import { DeviceModule } from './devicemodule.js';
import { Firmware } from './firmware.js';
import { ChildDevice } from './childdevice.js';

// Register modules
SmartModule.registerModule(Energy);
SmartModule.registerModule(Cloud);
SmartModule.registerModule(Time);
SmartModule.registerModule(Brightness);
SmartModule.registerModule(Color);
SmartModule.registerModule(ColorTemperature);
SmartModule.registerModule(Light);
SmartModule.registerModule(DeviceModule);
SmartModule.registerModule(Firmware);
SmartModule.registerModule(ChildDevice);

export {
  Energy,
  Cloud,
  Time,
  Brightness,
  Color,
  ColorTemperature,
  Light,
  DeviceModule,
  Firmware,
  ChildDevice
};
