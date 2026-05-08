// 萌怪 sprite sheet definitions.
// 每张原图 1024 × 559。坐标为手工估算，可能与实际像素有 ±5px 偏差。
// 每个 cell 取 "行走状态" 第一帧作为静态图。

const sheetUrl = (file) => new URL(`../assets/enemies/${file}`, import.meta.url).href;

// 单元格内 "行走状态第 1 帧" 的相对裁剪盒（相对 cell 左上角）。
const SHEET_LAYOUTS = {
  "enemy-sheet-01": {
    url: sheetUrl("sheet-01.jpg"),
    rows: 5,
    cols: 5,
    offsetX: 48,
    offsetY: 4,
    cellW: 195,
    cellH: 111,
    sprite: { x: 78, y: 22, w: 70, h: 55 },
    tierBase: 1, // 行下移会略微提升强度
  },
  "enemy-sheet-02": {
    url: sheetUrl("sheet-02.jpg"),
    rows: 5,
    cols: 5,
    offsetX: 48,
    offsetY: 4,
    cellW: 195,
    cellH: 111,
    sprite: { x: 78, y: 22, w: 70, h: 55 },
    tierBase: 2,
  },
  "enemy-sheet-03": {
    url: sheetUrl("sheet-03.jpg"),
    rows: 4,
    cols: 5,
    offsetX: 0,
    offsetY: 0,
    cellW: 205,
    cellH: 140,
    sprite: { x: 60, y: 28, w: 80, h: 65 },
    tierBase: 4,
  },
  "enemy-sheet-04": {
    url: sheetUrl("sheet-04.jpg"),
    rows: 4,
    cols: 5,
    offsetX: 0,
    offsetY: 0,
    cellW: 205,
    cellH: 140,
    sprite: { x: 30, y: 28, w: 80, h: 65 },
    tierBase: 6,
  },
  "enemy-sheet-05": {
    url: sheetUrl("sheet-05.jpg"),
    rows: 2,
    cols: 5,
    offsetX: 0,
    offsetY: 0,
    cellW: 205,
    cellH: 280,
    sprite: { x: 35, y: 70, w: 95, h: 95 },
    tierBase: 1,
  },
  "enemy-sheet-06": {
    url: sheetUrl("sheet-06.jpg"),
    rows: 4,
    cols: 5,
    offsetX: 0,
    offsetY: 0,
    cellW: 205,
    cellH: 140,
    sprite: { x: 25, y: 22, w: 80, h: 70 },
    tierBase: 8,
  },
  "enemy-sheet-08": {
    url: sheetUrl("sheet-08.jpg"),
    rows: 2,
    cols: 5,
    offsetX: 0,
    offsetY: 0,
    cellW: 205,
    cellH: 280,
    sprite: { x: 35, y: 70, w: 95, h: 95 },
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
        const frame = frameForCell(cfg, r, c);
        // 同一张表内，越靠下的行视觉强度略高（最高表内 +2 tier）
        const rowBoost = cfg.rows > 1 ? Math.round((r / (cfg.rows - 1)) * 2) : 0;
        const tier = Math.min(10, Math.max(1, cfg.tierBase + rowBoost));
        list.push({
          id,
          sheetKey,
          frame,
          tier,
        });
      }
    }
  });
  return list;
}

export const MONSTERS = buildMonsterCatalog();

// 每波允许的 tier 区间。列表长度 = 最大波数（按 12 安排，超出按最后一行）。
const WAVE_TIER_BANDS = [
  { min: 1, max: 1, types: 1 },  // 1
  { min: 1, max: 2, types: 2 },  // 2
  { min: 1, max: 3, types: 3 },  // 3
  { min: 2, max: 4, types: 3 },  // 4
  { min: 3, max: 5, types: 4 },  // 5
  { min: 3, max: 6, types: 4 },  // 6
  { min: 4, max: 7, types: 5 },  // 7
  { min: 5, max: 8, types: 5 },  // 8
  { min: 6, max: 9, types: 5 },  // 9
  { min: 8, max: 10, types: 5 }, // 10
  { min: 8, max: 10, types: 5 }, // 11
  { min: 9, max: 10, types: 5 }, // 12
];

export function getWaveBand(wave) {
  const idx = Math.max(1, wave) - 1;
  return WAVE_TIER_BANDS[Math.min(idx, WAVE_TIER_BANDS.length - 1)];
}

export function pickWaveMonsterTypes(wave, rng = Math.random) {
  const band = getWaveBand(wave);
  const eligible = MONSTERS.filter((m) => m.tier >= band.min && m.tier <= band.max);
  if (eligible.length === 0) {
    return MONSTERS.slice(0, 1);
  }
  const want = Math.min(band.types, eligible.length);
  // 随机不放回抽取
  const pool = eligible.slice();
  const picked = [];
  for (let i = 0; i < want; i += 1) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}
