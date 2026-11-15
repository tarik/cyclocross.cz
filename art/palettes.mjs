/**
 * Colours. Every material is a ramp [light, base, dark, darker]. A kit is a
 * set of ramps plus the jersey design of the same name in `rider.mjs`, so
 * both riders wear both kits.
 */
const ramp = (light, base, dark, darker) => [light, base, dark, darker];

export const SKIN = {
  male: { skin: ramp('#f2c69b', '#dba377', '#b57a55', '#8f5a3f'), hair: ramp('#6b4a2e', '#4d3421', '#372417', '#2a1b12') },
  female: { skin: ramp('#f6d2ae', '#e3b089', '#bd8562', '#96634a'), hair: ramp('#d9a24a', '#b97f2e', '#8f5f22', '#6b461a') },
};

const COMMON = {
  outline: ramp('#231d1a', '#231d1a', '#231d1a', '#231d1a'),
  black: ramp('#3a3431', '#2b2623', '#231d1a', '#231d1a'),
  tyre: ramp('#3b3532', '#3b3532', '#2b2623', '#2b2623'),
  rim: ramp('#b9b4a8', '#b9b4a8', '#8d887d', '#8d887d'),
  spoke: ramp('#a7a297', '#a7a297', '#8d887d', '#8d887d'),
  metal: ramp('#d6d2c6', '#aaa69b', '#7f7b72', '#5f5c55'),
  chain: ramp('#6f6b63', '#6f6b63', '#55514b', '#55514b'),
  shoe: ramp('#f4efe4', '#d9d2c2', '#aba392', '#8a8375'),
  glove: ramp('#4a4440', '#2f2a27', '#231d1a', '#231d1a'),
};

export const KITS = {
  // Original club kit: one burnt orange, long sleeves, a cream band on the
  // right arm. White bicycle. The orange comes from the site palette.
  club: {
    ...COMMON,
    jersey: ramp('#d9682f', '#b9501f', '#933c15', '#6f2d10'),
    armBand: ramp('#fbf4e2', '#ece1c6', '#c9bd9f', '#a39878'),
    cuff: ramp('#933c15', '#7a3111', '#5e260d', '#4a1e0a'),
    shorts: ramp('#3b4046', '#2b2f34', '#202327', '#18191c'),
    sock: ramp('#fbf4e2', '#ece1c6', '#c9bd9f', '#a39878'),
    helmet: ramp('#fbf4e2', '#ece1c6', '#c2b697', '#9a8f73'),
    vent: ramp('#4a4440', '#4a4440', '#4a4440', '#4a4440'),
    frame: ramp('#fbf8f0', '#e9e4d8', '#c4bfb2', '#a09b8f'),
    fork: ramp('#fbf8f0', '#e9e4d8', '#c4bfb2', '#a09b8f'),
  },
  // Czech colours: an original design of four vertical panels in white, red,
  // blue and light blue, dark blue shorts. No team or federation marks.
  national: {
    ...COMMON,
    panelA: ramp('#ffffff', '#f1f0eb', '#cbcac4', '#a4a39d'),
    panelB: ramp('#e4514a', '#cc332e', '#a32421', '#7c1b19'),
    panelC: ramp('#3566b8', '#1f4a97', '#173874', '#112a57'),
    panelD: ramp('#8cc6ea', '#62a9d6', '#4686b0', '#35678a'),
    shorts: ramp('#2c4a85', '#1d3566', '#16284e', '#101d3a'),
    sock: ramp('#ffffff', '#f1f0eb', '#cbcac4', '#a4a39d'),
    helmet: ramp('#ffffff', '#f1f0eb', '#c6c5bf', '#9f9e98'),
    vent: ramp('#4a4f55', '#4a4f55', '#4a4f55', '#4a4f55'),
    frame: ramp('#3566b8', '#1f4a97', '#173874', '#112a57'),
    fork: ramp('#3566b8', '#1f4a97', '#173874', '#112a57'),
  },
};

export function palette(kit, body) {
  return { ...KITS[kit], ...SKIN[body] };
}
