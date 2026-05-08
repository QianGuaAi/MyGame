export const DEFAULT_LEVEL_ID = "chapter-1-level-1";

export const LEVELS = {
  "chapter-1-level-1": {
    name: "王冠前哨",
    waveCount: 10,
    enemyMix: "basic",
    description: "基础敌人，熟悉建塔。",
  },
  "chapter-1-level-2": {
    name: "北桥林道",
    waveCount: 10,
    enemyMix: "tougher",
    description: "出现较硬的敌人，提高单位生命。",
  },
  "chapter-1-level-3": {
    name: "旧王城门",
    waveCount: 10,
    enemyMix: "rare-mix",
    description: "出现稀有敌人，掉率提高。",
  },
  "chapter-1-boss": {
    name: "黑石要塞",
    waveCount: 12,
    enemyMix: "boss",
    description: "章节 Boss，必掉稀有以上装备或图纸碎片。",
  },
};

export const CHAPTER_ONE_LEVEL_ORDER = [
  "chapter-1-level-1",
  "chapter-1-level-2",
  "chapter-1-level-3",
  "chapter-1-boss",
];

export function getLevelCompleteKey(levelId) {
  return `crown-outpost-${levelId}-complete`;
}

export function isWildMerchantLevel(levelId) {
  const match = levelId.match(/^chapter-\d+-level-(\d+)$/);
  return match ? Number(match[1]) % 3 === 0 : false;
}
