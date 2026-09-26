// ドット絵の定義。1 文字 = 1 ピクセル、'.' は透明。起動時にオフスクリーン Canvas へ焼き込む。
// 虫は横向き（右向き）か上から見た姿で描く。

export interface SpriteDef {
  palette: Record<string, string>;
  /** 全フレーム同じサイズ */
  frames: string[][];
}

const E16 = '................';

/** 16 行に満たない定義の上下を透明で埋める */
function pad16(rows: string[], top: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < top; i++) out.push(E16);
  out.push(...rows);
  while (out.length < 16) out.push(E16);
  return out;
}

/** 2 フレーム目を「1 フレーム目の一部の行を差し替えたもの」として作る */
function variant(frame: string[], replace: Record<number, string>): string[] {
  return frame.map((row, i) => replace[i] ?? row);
}

// ---- 虫 ----

const dangoA = pad16(
  [
    '.....kkkkkk.....',
    '...kkGgGgGgkk...',
    '..kGgGgGgGgGgk..',
    '.kgGgGgGgGgGgGk.',
    '.kgGgGgGgGgGgkkk',
    '..kkkkkkkkkkkkk.',
    '...l.l.l.l.l.l..',
  ],
  8,
);

const tentouA = pad16(
  [
    '......kkkk......',
    '....kkrrrrkk....',
    '...krrkrrrrrk...',
    '..krrrrrrkrrkk..',
    '..krkrrrrrrrkwk.',
    '..krrrrrkrrrkkk.',
    '...kkkkkkkkkkk..',
    '...l..l...l.....',
  ],
  7,
);

const monshiroA = pad16(
  [
    '......k..k......',
    '..kkk..kk..kkk..',
    '.kwwwk.bb.kwwwk.',
    'kwwgwwkbbkwwgwwk',
    'kwwwwwkbbkwwwwwk',
    '.kwwwwkbbkwwwwk.',
    '..kkwwkbbkwwkk..',
    '..kwwwkbbkwwwk..',
    '..kwgwk..kwgwk..',
    '...kkk....kkk...',
  ],
  2,
);
const monshiroB = pad16(
  [
    '......k..k......',
    E16,
    '....kk.bb.kk....',
    '...kwwkbbkwwk...',
    '...kwgkbbkgwk...',
    '...kwwkbbkwwk...',
    '....kwkbbkwk....',
    '....kwkbbkwk....',
    '.....k....k.....',
  ],
  2,
);

const battaA = pad16(
  [
    '...kkkk...kkk...',
    '..kkkkkkkkkggek.',
    '.kGGGGGGGGGgggk.',
    'kggggggggggggk..',
    '.kkkkkkkkkkkk...',
    '..kk.k.....k.k..',
    '...k......k.k...',
  ],
  9,
);
const battaB = variant(battaA, {
  9: '..........kkk...',
  14: 'kk..........k...',
  15: 'k...............',
});

const semiA = pad16(
  [
    '......kkkk......',
    '.....kekkek.....',
    '....kbbbbbbk....',
    '...kwkbbbbkwk...',
    '..kwwkbbbbkwwk..',
    '..kwwkbbbbkwwk..',
    '..kwwwkbbkwwwk..',
    '..kwwwkbbkwwwk..',
    '..kwwwwkkwwwwk..',
    '...kwwwkkwwwk...',
    '....kkwkkwkk....',
    '......k..k......',
  ],
  2,
);
const semiB = variant(semiA, {
  5: '..kwwkbbbbkwwk..',
  6: '.kwwwkbbbbkwwwk.',
  7: '.kwwwkbbbbkwwwk.',
  8: '.kwwwwkbbkwwwwk.',
  9: '.kwwwwkbbkwwwwk.',
  10: '..kwwwwkkwwwwk..',
  11: '..kkwwwkkwwwkk..',
  12: '....kkkkkkkk....',
});

const kamakiriA = pad16(
  [
    '............kk..',
    '...........kgek.',
    '..........kggk..',
    '........kkgk.k..',
    '.......kggkkgk..',
    '......kggk..gk..',
    '.kkkkkggk...k...',
    'kGGGGGgk........',
    'kggggggk........',
    '.kkkkkk.........',
    '.k..k.k.........',
    'k..k...k........',
  ],
  3,
);
const kamakiriB = variant(kamakiriA, {
  13: '..k.k..k........',
  14: '.k...k..k.......',
});

const agehaA = pad16(
  [
    '......k..k......',
    '.kkkk..kk..kkkk.',
    'kyykyk.bb.kykyyk',
    'kyykyykbbkyykyyk',
    'kykyyykbbkyyykyk',
    '.kkyyykbbkyyykk.',
    '..kyuykbbkyuyk..',
    '..kkyk.bb.kykk..',
    '...kk..bb..kk...',
    '...k........k...',
    '...k........k...',
  ],
  2,
);
const agehaB = pad16(
  [
    '......k..k......',
    E16,
    '....kk.bb.kk....',
    '...kyykbbkyyk...',
    '...kykkbbkkyk...',
    '...kyykbbkyyk...',
    '....kukbbkuk....',
    '....kkkbbkkk....',
    '.....k.bb.k.....',
    '.....k....k.....',
  ],
  2,
);

const kabutoA = pad16(
  [
    '......k..k......',
    '......kHHk......',
    '.......kk.......',
    '..k...kHHk...k..',
    '...k.kbbbbk.k...',
    '....kbhbbbbk....',
    '..k.kkkkkkkk.k..',
    '...kbhbbbbbbk...',
    '..kbhbbbkbbbbk..',
    '.k.kbhbbkbbbbk.k',
    '...kbhbbkbbbbk..',
    '...kbbbbkbbbbk..',
    '..k.kbbbkbbbk.k.',
    '.....kbbkbbk....',
    '......kkkkk.....',
  ],
  0,
);
const kabutoB = variant(kabutoA, {
  7: 'wwwkbhbbbbbbkwww',
  8: 'wwkbhbbbkbbbbkww',
  9: 'wwwkbhbbkbbbbkww',
  10: '.wwkbhbbkbbbbkw.',
  11: '..wkbbbbkbbbbk..',
});

const stagBody = [
  '..k.kbhbbbbk.k..',
  '...kbhbbkbbbk...',
  '.k.kbhbbkbbbk.k.',
  '...kbhbbkbbbk...',
  '..k.kbbbkbbk.k..',
  '.....kbbkbk.....',
  '......kkkk......',
];
const stagWings: Record<number, string> = {
  8: 'wwwkbhbbkbbbkwww',
  9: 'wwwkbhbbkbbbkwww',
  10: '.wwkbhbbkbbbkww.',
  11: '..wkbbbbkbbbkw..',
};

const nokogiriA = pad16(
  [
    '....k......k....',
    '....kk....kk....',
    '.....kk..kk.....',
    '.....kmkkmk.....',
    '..k...kbbk...k..',
    '...k.kbhbbk.k...',
    '....kkkkkkkk....',
    ...stagBody,
  ],
  0,
);
const nokogiriB = variant(nokogiriA, stagWings);

const miyamaA = pad16(
  [
    '...k........k...',
    '...kk......kk...',
    '....kk....kk....',
    '....kmk..kmk....',
    '....kkkkkkkk....',
    '..k.kggggggk.k..',
    '...kkkkkkkkkk...',
    ...stagBody,
  ],
  0,
);
const miyamaB = variant(miyamaA, stagWings);

const ookuwaA = pad16(
  [
    E16,
    '....kk....kk....',
    '....kmk..kmk....',
    '.....kmkkmk.....',
    '..k..kkkkkk..k..',
    '...kkbbbbbbkk...',
    '....kkkkkkkk....',
    ...stagBody,
  ],
  0,
);
const ookuwaB = variant(ookuwaA, stagWings);

const hotaruA = pad16(
  [
    '......k..k......',
    '.......kk.......',
    '......krrk......',
    '.....krrrrk.....',
    '....k.kkkk.k....',
    '......kbbk......',
    '.....kbbbbk.....',
    '....k.kbbk.k....',
    '......kLLk......',
    '......kLLk......',
    '.......kk.......',
  ],
  3,
);
const hotaruB = variant(hotaruA, {
  11: '......kllk......',
  12: '......kllk......',
});

const E24 = '........................';
const oniyanmaA = [
  E24,
  E24,
  E24,
  E24,
  '..........wwww..wwww....',
  '...........wwww.wwww....',
  '............wwwwwww.gg..',
  '..............kyyk.kggk.',
  'kyykyykyykyykyykyyykggk.',
  '..............kyyk.kggk.',
  '............wwwwwww.gg..',
  '...........wwww.wwww....',
  '..........wwww..wwww....',
  E24,
  E24,
  E24,
];
const oniyanmaB = variant(oniyanmaA, {
  4: '...........wwww.wwww....',
  5: '..........wwwww.wwww....',
  11: '..........wwwww.wwww....',
  12: '...........wwww.wwww....',
});

const tamamushiA = pad16(
  [
    '......k..k......',
    '.......kk.......',
    '......kggk......',
    '..k..kggggk..k..',
    '...kkkkkkkkkk...',
    '...kgrgGGgrgk...',
    '.k.kgrgGGgrgk.k.',
    '...kgrgGGgrgk...',
    '..kkgrgGGgrgkk..',
    '...kgrgGGgrgk...',
    '....kgrggrgk....',
    '.....kggggk.....',
    '......kkkk......',
  ],
  1,
);
const tamamushiB = variant(tamamushiA, {
  7: 'wwwkgrgGGgrgkwww',
  8: 'wwwkgrgGGgrgkwww',
  9: '.wwkgrgGGgrgkww.',
  10: '..wkgrgGGgrgkw..',
});

/** 虫のスプライト（id は bugs.ts の Species.id と一致させる） */
export const BUG_SPRITES: Record<string, SpriteDef> = {
  dangomushi: {
    palette: { k: '#25222b', g: '#5d6270', G: '#8d93a3', l: '#3a3642' },
    frames: [dangoA, variant(dangoA, { 14: '..l.l.l.l.l.l...' })],
  },
  tentoumushi: {
    palette: { k: '#1a1418', r: '#e0362c', w: '#f0f0f0', l: '#1a1418' },
    frames: [tentouA, variant(tentouA, { 14: '....l..l...l....' })],
  },
  monshirochou: {
    palette: { k: '#6b6b78', w: '#fbfbf2', g: '#3a3a3a', b: '#3b3b44' },
    frames: [monshiroA, monshiroB],
  },
  batta: {
    palette: { k: '#1f3a14', g: '#5fae3a', G: '#9ade62', e: '#101010' },
    frames: [battaA, battaB],
  },
  semi: {
    palette: { k: '#2a1d12', b: '#6b4a2a', w: '#cfe6e8', e: '#e0d0a0' },
    frames: [semiA, semiB],
  },
  kamakiri: {
    palette: { k: '#1f4a1c', g: '#6cc24a', G: '#a3e07a', e: '#101010' },
    frames: [kamakiriA, kamakiriB],
  },
  ageha: {
    palette: { k: '#1c1a20', y: '#f2d04a', b: '#2a2630', u: '#3f6fd8' },
    frames: [agehaA, agehaB],
  },
  kabutomushi: {
    palette: { k: '#1a0e08', b: '#5a3418', h: '#8a5a30', H: '#7a4a24', w: '#d9c9a0' },
    frames: [kabutoA, kabutoB],
  },
  nokogiri: {
    palette: { k: '#1e0c06', b: '#7a2e14', h: '#a8482a', m: '#5a2010', w: '#d9c0a0' },
    frames: [nokogiriA, nokogiriB],
  },
  miyama: {
    palette: { k: '#1a1008', b: '#6a4a22', h: '#9a7038', g: '#c9a24a', m: '#4a3010', w: '#d9c9a0' },
    frames: [miyamaA, miyamaB],
  },
  hotaru: {
    palette: { k: '#111018', r: '#e0503a', b: '#2a2830', L: '#f6ff8a', l: '#a8b060' },
    frames: [hotaruA, hotaruB],
  },
  oniyanma: {
    palette: { k: '#111111', y: '#f2d02a', g: '#3fbf5a', w: '#cfe8f0' },
    frames: [oniyanmaA, oniyanmaB],
  },
  tamamushi: {
    palette: { k: '#0e2a1a', g: '#2fae5a', G: '#7ff0a0', r: '#d8402a', w: '#b0e8d0' },
    frames: [tamamushiA, tamamushiB],
  },
  ookuwagata: {
    palette: { k: '#000000', b: '#22222a', h: '#50505e', m: '#34343e', w: '#c0c0cc' },
    frames: [ookuwaA, ookuwaB],
  },
};

// ---- 主人公（後ろ姿, 24×32） ----

const heroLegs = [
  '...kkkbbbbbbbbbbbbkkk...',
  '.....kbbbbbbbbbbbbk.....',
  '.....kbbbbbBBbbbbbk.....',
  '.....kBBBBBkkBBBBBk.....',
  '......kssssk.kssssk.....',
  '......kssssk.kssssk.....',
  '......kSssSk.kSssSk.....',
  '......kssssk.kssssk.....',
  '......kSssSk.kSssSk.....',
  '.....kooook..kooook.....',
  '.....kkkkkk..kkkkkk.....',
  '........................',
  '........................',
];

const heroHead = [
  '........kkkkkkkk........',
  '......kkyyyyyyyykk......',
  '.....kyyyyyyyyyyyyk.....',
  '.....kyyyyyyyyyyyyk.....',
  '....kkrrrrrrrrrrrrkk....',
  '.kkkyyyyyyyyyyyyyyyykkk.',
  'kyyyyyyyyyyyyyyyyyyyyyyk',
  '.kkYYYYYYYYYYYYYYYYYYkk.',
  '...kkkhhhhhhhhhhhhkkk...',
];

const heroStand = [
  ...heroHead,
  '.....khhhhhhhhhhhhk.....',
  '.....khhhhhhhhhhhhk.....',
  '......khhhhhhhhhhk......',
  '.......kSsssssssSk......',
  '....kkkwwwwwwwwwwkkk....',
  '...kswwwwwwwwwwwwwwsk...',
  '..ksswwwwwwwwwwwwwwssk..',
  '..ksskwwwwwwwwwwwwkssk..',
  '..ksskwwwwwwwwwwWWkssk..',
  '..kSSkWwwwwwwwwwWWkSSk..',
  ...heroLegs,
];

const heroSwing = [
  ...heroHead,
  '.ksskkhhhhhhhhhhhhkkssk.',
  '.ksskkhhhhhhhhhhhhkkssk.',
  '..ksk.khhhhhhhhhhk.ksk..',
  '..kssk.kSsssssssSk.kssk.',
  '...ksskwwwwwwwwwwkssk...',
  '....kkwwwwwwwwwwwwkk....',
  '....kwwwwwwwwwwwwwwk....',
  '....kwwwwwwwwwwwwwwk....',
  '....kwwwwwwwwwwWWWWk....',
  '....kWwwwwwwwwwWWWWk....',
  ...heroLegs,
];

export const HERO_SPRITE: SpriteDef = {
  palette: {
    k: '#22181a',
    y: '#e8c860',
    Y: '#b89640',
    r: '#d84040',
    h: '#3a2418',
    s: '#eab48a',
    S: '#c88a60',
    w: '#f6f6f0',
    W: '#c8ccd8',
    b: '#3a64c8',
    B: '#28468c',
    o: '#c84030',
  },
  frames: [heroStand, heroSwing],
};

/** 主人公スプライトの足元の行（下からの余白を除いた最下段） */
export const HERO_FEET_ROW = 29;

// ---- UI ----

const speaker = [
  '....kk......',
  '...kwk...w..',
  'kkkwwk.w..w.',
  'kwwwwk..w..w',
  'kwwwwk..w..w',
  'kwwwwk..w..w',
  'kwwwwk..w..w',
  'kkkwwk.w..w.',
  '...kwk...w..',
  '....kk......',
  '............',
  '............',
];
const speakerOff = [
  '....kk......',
  '...kwk......',
  'kkkwwk......',
  'kwwwwk.r...r',
  'kwwwwk..r.r.',
  'kwwwwk...r..',
  'kwwwwk..r.r.',
  'kkkwwk.r...r',
  '...kwk......',
  '....kk......',
  '............',
  '............',
];

export const MUTE_SPRITE: SpriteDef = {
  palette: { k: '#1a1a22', w: '#f4f4ec', r: '#e04848' },
  frames: [speaker, speakerOff],
};
