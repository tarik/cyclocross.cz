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
  // Golden hour: blue-violet overhead, rose and peach lower down, pale gold at the horizon.
  sky: ['#6f86c0', '#8996c8', '#a7a4cf', '#c6abc6', '#e0b2b0', '#efbe9c', '#f6cf92', '#f9e1a8'],
  sun: ['#fffbe8', '#fff0bf', '#ffe29a', '#fbd085'],
  cloud: ['#ffe1a3', '#f7b98f', '#d99fae', '#a996c2'],
  farHill: ['#c9b3c4', '#b4a5c2', '#a098bb', '#8e8db2'],
  nearHill: ['#bfb48e', '#a6a27f', '#8f9173', '#7b8068'],
  wall: ['#f8ecd6', '#d8c4b0'],
  roof: ['#d06a46', '#a9503a', '#7f3c33'],
  spire: ['#6a6b78', '#4c4d5c'],
  grass: ['#d0c35c', '#a3ab45', '#7a8d3d', '#5b6d3a'],
  dryGrass: ['#e6c568', '#c9a24c', '#9d7d3d', '#715d36'],
  leaf: ['#ffd25e', '#f0a033', '#dd7027', '#bd4f2b'],
  track: ['#c79566', '#a0724a', '#7b573b', '#5a4031'],
  timber: ['#d9a46a', '#b27e4b', '#86603c', '#5f452f'],
  plate: ['#9a918a', '#7e7670', '#645e5a', '#4b4745'],
  steel: ['#f1e8d8', '#c3bdb5', '#8d8a88', '#5f5e62'],
  post: ['#f3e7cf', '#7a5a3c', '#4e3a2a'],
  board: ['#fffaf0', '#f0e3cc', '#c9b9a5', '#8f8379'],
  tape: ['#e0412f', '#fff4e2'],
  banner: {
    orange: ['#f0782f', '#c95a22'],
    navy: ['#2f4683', '#22335f'],
    yellow: ['#f6c93a', '#d6a524'],
    white: ['#fff7ea', '#e5d9c8'],
    red: ['#d8392f', '#ab2a25'],
    teal: ['#2f9b8c', '#237568'],
    grey: ['#d9d0c2', '#b7ad9f'],
    ink: ['#2a2520', '#2a2520'],
  },
  gold: ['#ffe07a', '#f2b23a', '#cc8327', '#93571f'],
  orange: ['#ffad5a', '#e8792f', '#b85428', '#7d3a1f'],
  rust: ['#ee8150', '#c6552f', '#933b26', '#62291d'],
  olive: ['#d9cb68', '#aea545', '#7f7f36', '#575a2c'],
  spruce: ['#7d8a58', '#5a6a49', '#41523d', '#2e3b31'],
  trunk: ['#9a7350', '#73523a', '#523b2c', '#3b2b22'],
  birch: ['#fbf1e0', '#dacbbb', '#3a3431'],
  topsoil: ['#6b4a2e', '#5a3d26', '#4a3220', '#3a271a'],
  soil: ['#9a7350', '#80603f', '#6c4f33', '#57402a'],
  root: '#b8946a',
  fade: ['#a88563', '#c4aa88', '#ddcfb8'],
  stone: ['#c9b8a6', '#9f9283', '#7a7068', '#5b544e'],
  lever: ['#f2c94c', '#2f5d8a'],
  paper: ['#f7f3ea', '#c9c0ae'],
  ink: '#2a2520',
  cap: '#2a2520',
  bottle: ['#f4f0e6', '#c9c0ae'],
  bidon: ['#7fb0dc', '#4a7fb5', '#2f5d8a'],
  /** Green glass of a Czech lager bottle, its cream label and gold foil. */
  glass: ['#a9cf7e', '#5f9147', '#3f6b34', '#284727'],
  label: ['#f6ecc8', '#d8c58f'],
  bone: ['#f3e9d2', '#d9c9a6', '#a8946f'],
  fur: ['#5b4f4b', '#3f3634', '#2b2424'],
  pink: ['#f2a7a0', '#d77f7c'],
  /** Cast shadows at golden hour are cool: blue and violet shifted. */
  shadow: {
    grass: ['#7f8a5a', '#66745a', '#525f55', '#414b4b'],
    dryGrass: ['#958765', '#7a6e5c', '#615a52', '#4b4648'],
    track: ['#83695c', '#6a5550', '#544446', '#40363b'],
    timber: ['#8e6f5a', '#725848', '#57443c', '#3f3333'],
  },
};
