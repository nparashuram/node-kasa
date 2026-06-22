/**
 * Central registry for light effects.
 */

export const EFFECT_NAMES = [
  'Aurora', 'Bubbling Cauldron', 'Candy Cane', 'Christmas', 'Flicker',
  'Hanukkah', 'Haunted Mansion', 'Icicle', 'Lightning', 'Ocean',
  'Rainbow', 'Raindrop', 'Spring', 'Valentines'
];

export const EFFECT_MAPPING = Object.fromEntries(
  EFFECT_NAMES.map(name => [name, { name, custom: 0, enable: 1 }])
);
