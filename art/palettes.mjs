/**
 * Colours. Every material is a ramp [light, base, dark, darker]. A kit only
 * replaces the jersey, helmet and bicycle ramps, so both riders wear both kits.
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
  // Original club kit: burnt orange and deep teal, taken from the site palette.
  club: {
    ...COMMON,
    jersey: ramp('#e0703a', '#c4521f', '#9c3d14', '#77300f'),
    jerseyBand: ramp('#fbf4e2', '#ece1c6', '#c9bd9f', '#a39878'),
    jerseyTrim: ramp('#2f7f7b', '#1f6562', '#174d4b', '#113a39'),
    jerseyTop: ramp('#2f7f7b', '#1f6562', '#174d4b', '#113a39'),
    shorts: ramp('#3b4046', '#2b2f34', '#202327', '#18191c'),
    sock: ramp('#fbf4e2', '#ece1c6', '#c9bd9f', '#a39878'),
    helmet: ramp('#fbf4e2', '#ece1c6', '#c2b697', '#9a8f73'),
    helmetMark: ramp('#e0703a', '#c4521f', '#9c3d14', '#77300f'),
    frame: ramp('#2f7f7b', '#1f6562', '#174d4b', '#113a39'),
    frameMark: ramp('#fbf4e2', '#ece1c6', '#c9bd9f', '#a39878'),
    fork: ramp('#3a3431', '#2b2623', '#231d1a', '#231d1a'),
  },
  // Czech colours: an original white, red and blue design, no team marks.
  national: {
    ...COMMON,
    jersey: ramp('#ffffff', '#efeee9', '#c9c8c2', '#a2a19b'),
    jerseyBand: ramp('#e24a44', '#c9302c', '#a02320', '#7a1a18'),
    jerseyTrim: ramp('#ffffff', '#efeee9', '#c9c8c2', '#a2a19b'),
    jerseyTop: ramp('#3d6fc0', '#24509d', '#1a3c79', '#132c5a'),
    shorts: ramp('#2c4a85', '#1d3566', '#16284e', '#101d3a'),
    sock: ramp('#ffffff', '#efeee9', '#c9c8c2', '#a2a19b'),
    helmet: ramp('#ffffff', '#efeee9', '#c4c3bd', '#9d9c96'),
    helmetMark: ramp('#e24a44', '#c9302c', '#a02320', '#7a1a18'),
    frame: ramp('#e24a44', '#c9302c', '#a02320', '#7a1a18'),
    frameMark: ramp('#ffffff', '#efeee9', '#c9c8c2', '#a2a19b'),
    fork: ramp('#ffffff', '#efeee9', '#c9c8c2', '#a2a19b'),
  },
};

export function palette(kit, body) {
  return { ...KITS[kit], ...SKIN[body] };
}
