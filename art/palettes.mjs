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
  lens: ramp('#5fa3b5', '#2f6f85', '#234f60', '#1a3a47'),
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
    glove: ramp('#4a4440', '#2f2a27', '#231d1a', '#231d1a'),
    sock: ramp('#fbf4e2', '#ece1c6', '#c9bd9f', '#a39878'),
    helmet: ramp('#ffffff', '#f3f2ee', '#cfcec8', '#a9a8a2'),
    vent: ramp('#d3d2cc', '#d3d2cc', '#bdbcb6', '#bdbcb6'),
    frame: ramp('#fbf8f0', '#e9e4d8', '#c4bfb2', '#a09b8f'),
    fork: ramp('#fbf8f0', '#e9e4d8', '#c4bfb2', '#a09b8f'),
  },
  // Czech colours: an original design of four horizontal bands, white on top,
  // then red, blue and light blue, dark blue shorts. No team or federation marks.
  national: {
    ...COMMON,
    bandA: ramp('#ffffff', '#f1f0eb', '#cbcac4', '#a4a39d'),
    bandB: ramp('#e4514a', '#cc332e', '#a32421', '#7c1b19'),
    bandC: ramp('#3566b8', '#1f4a97', '#173874', '#112a57'),
    bandD: ramp('#8cc6ea', '#62a9d6', '#4686b0', '#35678a'),
    shorts: ramp('#2c4a85', '#1d3566', '#16284e', '#101d3a'),
    glove: ramp('#ffffff', '#f1f0eb', '#cbcac4', '#a4a39d'),
    sock: ramp('#ffffff', '#f1f0eb', '#cbcac4', '#a4a39d'),
    helmet: ramp('#ffffff', '#f3f2ee', '#cfcec8', '#a9a8a2'),
    vent: ramp('#d3d2cc', '#d3d2cc', '#bdbcb6', '#bdbcb6'),
    // A deeper, wine red, so the frame does not match the jersey band.
    frame: ramp('#b5303b', '#981d2b', '#761622', '#58101a'),
    fork: ramp('#b5303b', '#981d2b', '#761622', '#58101a'),
  },
};

export function palette(kit, body) {
  return { ...KITS[kit], ...SKIN[body] };
}

/**
 * The autumn scenery palette (SPEC.md 4.1): warm daylight, pale sky, golden
 * foliage, green and ochre grass, earthy track. Ramps run light to dark.
 */
export const SCENERY = {
  sky: ['#bcdde8', '#c9e3e9', '#d6e9e6', '#e3eedf', '#eff0d6'],
  cloud: ['#fffdf6', '#f3f4ee', '#e1ebea', '#cfe0e4'],
  farHill: ['#c8d6c8', '#b9cabd', '#a9bdb1', '#9bb0a6'],
  nearHill: ['#b9c79f', '#a6b98d', '#93a97d', '#82976f'],
  wall: ['#f3eee2', '#d9d1c1'],
  roof: ['#c8664a', '#a9503a', '#86402f'],
  spire: ['#5d6b6b', '#45514f'],
  grass: ['#a7b552', '#8aa140', '#6c8734', '#53692a'],
  dryGrass: ['#c9b866', '#ad9c4e', '#8c7d3b', '#6a5e2c'],
  leaf: ['#f2c14e', '#e39a2d', '#cf6f25', '#b5512a'],
  track: ['#b28d61', '#957049', '#78573a', '#5d432d'],
  timber: ['#c49866', '#a37a4c', '#7f5c39', '#5c412a'],
  deck: ['#d9b47f', '#c19a64', '#9c7a4d', '#76593a'],
  post: ['#e9dcc4', '#6f5136', '#4e3925'],
  board: ['#fffdf6', '#ece6da', '#cfc6b6', '#8f877a'],
  tape: ['#d63b2e', '#f6f1e6'],
  gold: ['#f7d77a', '#e8b23f', '#c88827', '#94601d'],
  orange: ['#f2a65a', '#dd7a31', '#b25624', '#7d3a19'],
  rust: ['#d97a4a', '#b6532e', '#8a3a22', '#5e2818'],
  olive: ['#c7c26a', '#a3a346', '#7a7f32', '#565c25'],
  spruce: ['#6d8457', '#506944', '#3a5034', '#2a3a27'],
  trunk: ['#8a6a4f', '#6a4e38', '#4d3828', '#3a2a1e'],
  birch: ['#f4f0e6', '#d9d3c6', '#3a3431'],
  topsoil: ['#6b4a2e', '#5a3d26', '#4a3220', '#3a271a'],
  soil: ['#9a7350', '#80603f', '#6c4f33', '#57402a'],
  root: '#b8946a',
  fade: ['#a88563', '#c4aa88', '#ddcfb8'],
  stone: ['#bdb4a6', '#9b9184', '#7a7166', '#5b544c'],
  lever: ['#f2c94c', '#2f5d8a'],
  paper: ['#f7f3ea', '#c9c0ae'],
  ink: '#2a2520',
  cap: '#2a2520',
  bottle: ['#f4f0e6', '#c9c0ae'],
};
