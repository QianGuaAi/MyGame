import { levelCompleteKey } from "../utils/storage.js";

export const DEFAULT_LEVEL_ID = "chapter-1-level-1";

function chapterLevels(chapterIndex, chapterName, variant) {
  // variant 决定整章整体难度 (1..5 对应章节 1..5)
  const stageHp = Math.max(1, variant);
  return {
    [`chapter-${chapterIndex}-level-1`]: {
      name: `${chapterName}·哨站`,
      waveCount: 10,
      enemyMix: variant <= 1 ? "basic" : "tougher",
      description: "基础敌人，熟悉节奏。",
      stageHpMultiplier: 1 + (stageHp - 1) * 0.15,
    },
    [`chapter-${chapterIndex}-level-2`]: {
      name: `${chapterName}·林道`,
      waveCount: 10,
      enemyMix: "tougher",
      description: "更硬的敌人，注意血线。",
      stageHpMultiplier: 1.05 + (stageHp - 1) * 0.18,
    },
    [`chapter-${chapterIndex}-level-3`]: {
      name: `${chapterName}·要道`,
      waveCount: 10,
      enemyMix: "rare-mix",
      description: "稀有敌人变多。",
      stageHpMultiplier: 1.1 + (stageHp - 1) * 0.2,
    },
    [`chapter-${chapterIndex}-boss`]: {
      name: `${chapterName}·Boss`,
      waveCount: 12,
      enemyMix: "boss",
      description: "章节 Boss，必掉稀有以上装备或图纸碎片。",
      stageHpMultiplier: 1.15 + (stageHp - 1) * 0.25,
    },
  };
}

export const LEVELS = {
  ...chapterLevels(1, "边境平原", 1),
  ...chapterLevels(2, "幽暗森林", 2),
  ...chapterLevels(3, "烈焰火山", 3),
  ...chapterLevels(4, "极北雪山", 4),
  ...chapterLevels(5, "回响之渊", 5),
};

// 原来的 chapter-1-level-1 名称兼容
LEVELS["chapter-1-level-1"].name = "王冠前哨";
LEVELS["chapter-1-level-2"].name = "北桥林道";
LEVELS["chapter-1-level-3"].name = "旧王城门";
LEVELS["chapter-1-boss"].name = "黑石要塞";

export const CHAPTER_LEVEL_ORDERS = {
  1: ["chapter-1-level-1", "chapter-1-level-2", "chapter-1-level-3", "chapter-1-boss"],
  2: ["chapter-2-level-1", "chapter-2-level-2", "chapter-2-level-3", "chapter-2-boss"],
  3: ["chapter-3-level-1", "chapter-3-level-2", "chapter-3-level-3", "chapter-3-boss"],
  4: ["chapter-4-level-1", "chapter-4-level-2", "chapter-4-level-3", "chapter-4-boss"],
  5: ["chapter-5-level-1", "chapter-5-level-2", "chapter-5-level-3", "chapter-5-boss"],
};

// 兼容旧导出
export const CHAPTER_ONE_LEVEL_ORDER = CHAPTER_LEVEL_ORDERS[1];

export function getChapterLevelOrder(chapterIndex) {
  return CHAPTER_LEVEL_ORDERS[chapterIndex] ?? CHAPTER_LEVEL_ORDERS[1];
}

export function getLevelCompleteKey(levelId) {
  return levelCompleteKey(levelId);
}

export function isLevelCompleted(levelId) {
  return localStorage.getItem(levelCompleteKey(levelId)) === "true";
}

export function isWildMerchantLevel(levelId) {
  const match = levelId.match(/^chapter-\d+-level-(\d+)$/);
  return match ? Number(match[1]) % 3 === 0 : false;
}

export function getChapterIndexOfLevel(levelId) {
  const match = levelId?.match(/^chapter-(\d+)/);
  return match ? Number(match[1]) : 1;
}

export function isChapterFinalLevel(levelId) {
  const order = getChapterLevelOrder(getChapterIndexOfLevel(levelId));
  return order[order.length - 1] === levelId;
}
