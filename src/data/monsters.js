const sheetUrl = (file) => new URL(`../assets/enemies/${file}`, import.meta.url).href;

// Enemy source files are 1024 x 559 contact sheets: 2 rows x 5 cards.
// Each card contains labels plus walking/attack poses. We crop the first
// walking pose area so battlefield enemies use the artwork, not the UI text.
const CONTACT_SHEET = {
  rows: 2,
  cols: 5,
  offsetX: 30,
  offsetY: 58,
  cellW: 195,
  cellH: 250,
  sprite: { x: 10, y: 38, w: 92, h: 98 },
};

const SHEET_LAYOUTS = {
  "enemy-sheet-01": {
    url: sheetUrl("sheet-01.jpg"),
    ...CONTACT_SHEET,
    tierBase: 1,
  },
  "enemy-sheet-02": {
    url: sheetUrl("sheet-02.jpg"),
    ...CONTACT_SHEET,
    tierBase: 2,
  },
  "enemy-sheet-03": {
    url: sheetUrl("sheet-03.jpg"),
    ...CONTACT_SHEET,
    tierBase: 4,
  },
  "enemy-sheet-04": {
    url: sheetUrl("sheet-04.jpg"),
    ...CONTACT_SHEET,
    tierBase: 6,
  },
  "enemy-sheet-05": {
    url: sheetUrl("sheet-05.jpg"),
    ...CONTACT_SHEET,
    tierBase: 1,
  },
  "enemy-sheet-06": {
    url: sheetUrl("sheet-06.jpg"),
    ...CONTACT_SHEET,
    tierBase: 8,
  },
  "enemy-sheet-08": {
    url: sheetUrl("sheet-08.jpg"),
    ...CONTACT_SHEET,
    tierBase: 3,
  },
};

export const ENEMY_SHEETS = Object.entries(SHEET_LAYOUTS).map(([key, cfg]) => ({
  key,
  url: cfg.url,
}));

function frameForCell(cfg, row, col) {
  const cellX = cfg.offsetX + col * cfg.cellW;
  const cellY = cfg.offsetY + row * cfg.cellH;
  return {
    x: cellX + cfg.sprite.x,
    y: cellY + cfg.sprite.y,
    w: cfg.sprite.w,
    h: cfg.sprite.h,
  };
}

function buildMonsterCatalog() {
  const list = [];

  Object.entries(SHEET_LAYOUTS).forEach(([sheetKey, cfg]) => {
    for (let r = 0; r < cfg.rows; r += 1) {
      for (let c = 0; c < cfg.cols; c += 1) {
        const id = `${sheetKey}-r${r}-c${c}`;
        const rowBoost = cfg.rows > 1 ? Math.round((r / (cfg.rows - 1)) * 2) : 0;
        const tier = Math.min(10, Math.max(1, cfg.tierBase + rowBoost));

        list.push({
          id,
          sheetKey,
          frame: frameForCell(cfg, r, c),
          tier,
        });
      }
    }
  });

  return list;
}

export const MONSTERS = buildMonsterCatalog();

const WAVE_TIER_BANDS = [
  { min: 1, max: 1, types: 1 },
  { min: 1, max: 2, types: 2 },
  { min: 1, max: 3, types: 3 },
  { min: 2, max: 4, types: 3 },
  { min: 3, max: 5, types: 4 },
  { min: 3, max: 6, types: 4 },
  { min: 4, max: 7, types: 5 },
  { min: 5, max: 8, types: 5 },
  { min: 6, max: 9, types: 5 },
  { min: 8, max: 10, types: 5 },
  { min: 8, max: 10, types: 5 },
  { min: 9, max: 10, types: 5 },
];

export function getWaveBand(wave) {
  const idx = Math.max(1, wave) - 1;
  return WAVE_TIER_BANDS[Math.min(idx, WAVE_TIER_BANDS.length - 1)];
}

export function pickWaveMonsterTypes(wave, rng = Math.random) {
  const band = getWaveBand(wave);
  const eligible = MONSTERS.filter((monster) => monster.tier >= band.min && monster.tier <= band.max);

  if (eligible.length === 0) {
    return MONSTERS.slice(0, 1);
  }

  const want = Math.min(band.types, eligible.length);
  const pool = eligible.slice();
  const picked = [];

  for (let i = 0; i < want; i += 1) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }

  return picked;
}
