/**
 * 集中管理所有需要 preload 的新素材。
 * key: Phaser texture key
 * url: 文件路径（通过 import.meta.url 解析）
 */

const img = (file) => new URL(`../assets/${file}`, import.meta.url).href;

// ─── 投射物 / 特效 ───────────────────────────────────────
export const PROJECTILE_ASSETS = {
  "proj-arrow-basic": img("projectiles/arrow-basic.png"),
  "proj-arrow-burst": img("projectiles/arrow-burst.png"),
  "proj-arrow-hawk": img("projectiles/arrow-hawk.png"),
  "proj-bomb": img("projectiles/bomb.png"),
  "proj-flame": img("projectiles/flame.png"),
  "proj-frost-shard": img("projectiles/frost-shard.png"),
  "proj-magic-bolt": img("projectiles/magic-bolt.png"),
  "proj-meteor": img("projectiles/meteor.png"),
  "proj-shrapnel": img("projectiles/shrapnel.png"),
  "proj-slow-ring": img("projectiles/slow-ring.png"),
  "proj-heal-ring": img("projectiles/heal-ring.png"),
  "proj-flame-puff-1": img("projectiles/flame-puff-1.png"),
  "proj-flame-puff-2": img("projectiles/flame-puff-2.png"),
  "proj-flame-puff-3": img("projectiles/flame-puff-3.png"),
  "proj-hit-spark-1": img("projectiles/hit-spark-1.png"),
  "proj-hit-spark-2": img("projectiles/hit-spark-2.png"),
  "proj-hit-spark-3": img("projectiles/hit-spark-3.png"),
  "proj-block-spark-1": img("projectiles/block-spark-1.png"),
  "proj-block-spark-2": img("projectiles/block-spark-2.png"),
  "proj-block-spark-3": img("projectiles/block-spark-3.png"),
};

// ─── 图标 ───────────────────────────────────────────────
export const ICON_ASSETS = {
  "icon-coin": img("icons/coin.png"),
  "icon-heart": img("icons/heart.png"),
  "icon-heart-shield": img("icons/heart-shield.png"),
  "icon-blueprint": img("icons/blueprint.png"),
  "icon-blueprint-fragment": img("icons/blueprint-fragment.png"),
  "icon-easter-egg": img("icons/easter-egg.png"),
  "icon-equip-armor": img("icons/equipment-armor.png"),
  "icon-equip-trinket": img("icons/equipment-trinket.png"),
  "icon-equip-weapon": img("icons/equipment-weapon.png"),
  "icon-skill-tiezhu": img("icons/skill-tiezhu.png"),
  "icon-skill-ergou": img("icons/skill-ergou.png"),
  "icon-skill-yueguang": img("icons/skill-yueguang.png"),
};

// ─── UI 面板 / 按钮 ─────────────────────────────────────
export const UI_ASSETS = {
  "ui-btn-default": img("ui/button-default.png"),
  "ui-btn-hover": img("ui/button-hover.png"),
  "ui-btn-danger": img("ui/button-danger.png"),
  "ui-btn-disabled": img("ui/button-disabled.png"),
  "ui-panel-wood": img("ui/panel-wood.png"),
};

// ─── 人物立绘 / 图鉴 ────────────────────────────────────
export const PORTRAIT_ASSETS = {
  "portrait-tiezhu": img("portraits/heroes/tiezhu.png"),
  "portrait-ergou": img("portraits/heroes/ergou.png"),
  "portrait-yueguang": img("portraits/heroes/yueguang.png"),
  "portrait-queen": img("portraits/queen.png"),
  "portrait-yeshi": img("portraits/yeshi.png"),
};

// ─── 怪物图鉴 ───────────────────────────────────────────
export const MONSTER_PORTRAIT_ASSETS = {
  "portrait-sprout-01": img("portraits/monsters/sprout-01.png"),
  "portrait-mushroom-02": img("portraits/monsters/mushroom-02.png"),
  "portrait-boar-03": img("portraits/monsters/boar-03.png"),
  "portrait-wisp-04": img("portraits/monsters/wisp-04.png"),
  "portrait-lizard-05": img("portraits/monsters/lizard-05.png"),
  "portrait-golem-06": img("portraits/monsters/golem-06.png"),
  "portrait-shadow-07": img("portraits/monsters/shadow-07.png"),
  "portrait-snow-08": img("portraits/monsters/snow-08.png"),
  "portrait-sprout-09": img("portraits/monsters/sprout-09.png"),
  "portrait-mushroom-10": img("portraits/monsters/mushroom-10.png"),
  "portrait-boar-11": img("portraits/monsters/boar-11.png"),
  "portrait-wisp-12": img("portraits/monsters/wisp-12.png"),
  "portrait-lizard-13": img("portraits/monsters/lizard-13.png"),
  "portrait-golem-14": img("portraits/monsters/golem-14.png"),
  "portrait-shadow-15": img("portraits/monsters/shadow-15.png"),
  "portrait-snow-16": img("portraits/monsters/snow-16.png"),
  "portrait-sprout-17": img("portraits/monsters/sprout-17.png"),
  "portrait-mushroom-18": img("portraits/monsters/mushroom-18.png"),
  "portrait-boar-19": img("portraits/monsters/boar-19.png"),
  "portrait-wisp-20": img("portraits/monsters/wisp-20.png"),
  "portrait-lizard-21": img("portraits/monsters/lizard-21.png"),
  "portrait-golem-22": img("portraits/monsters/golem-22.png"),
  "portrait-shadow-23": img("portraits/monsters/shadow-23.png"),
  "portrait-snow-24": img("portraits/monsters/snow-24.png"),
  "portrait-sprout-25": img("portraits/monsters/sprout-25.png"),
  "portrait-mushroom-26": img("portraits/monsters/mushroom-26.png"),
  "portrait-boar-27": img("portraits/monsters/boar-27.png"),
  "portrait-wisp-28": img("portraits/monsters/wisp-28.png"),
  "portrait-lizard-29": img("portraits/monsters/lizard-29.png"),
  "portrait-golem-30": img("portraits/monsters/golem-30.png"),
};

// ─── 敌人动画帧 ─────────────────────────────────────────
// 返回 { key, url } 数组，按 monsterId/action-frame 格式
const REGULAR_MONSTERS = [
  "sprout-01", "mushroom-02", "boar-03", "wisp-04",
  "lizard-05", "golem-06", "shadow-07", "snow-08",
  "sprout-09", "mushroom-10", "boar-11", "wisp-12",
  "lizard-13", "golem-14", "shadow-15", "snow-16",
  "sprout-17", "mushroom-18", "boar-19", "wisp-20",
  "lizard-21", "golem-22", "shadow-23", "snow-24",
  "sprout-25", "mushroom-26", "boar-27", "wisp-28",
  "lizard-29", "golem-30",
];
const BOSS_MONSTERS = ["boss-ch1", "boss-ch2", "boss-ch3", "boss-ch4", "boss-ch5"];

function buildEnemyFrameAssets() {
  const regularAnims = { walk: 4, attack: 3, death: 3 };
  const bossAnims = { walk: 4, attack: 4, death: 4 };
  const list = [];

  for (const monsterId of REGULAR_MONSTERS) {
    for (const [action, count] of Object.entries(regularAnims)) {
      for (let i = 1; i <= count; i++) {
        const frame = String(i).padStart(2, "0");
        list.push({ key: `enemy-${monsterId}-${action}-${frame}`, url: img(`enemies/${monsterId}/${action}-${frame}.png`) });
      }
    }
  }
  for (const monsterId of BOSS_MONSTERS) {
    for (const [action, count] of Object.entries(bossAnims)) {
      for (let i = 1; i <= count; i++) {
        const frame = String(i).padStart(2, "0");
        list.push({ key: `enemy-${monsterId}-${action}-${frame}`, url: img(`enemies/${monsterId}/${action}-${frame}.png`) });
      }
    }
    list.push({ key: `enemy-${monsterId}-portrait`, url: img(`enemies/${monsterId}/portrait.png`) });
  }
  return list;
}

export { REGULAR_MONSTERS, BOSS_MONSTERS };

export const ENEMY_FRAME_ASSETS = buildEnemyFrameAssets();

// ─── 漫画 ───────────────────────────────────────────────
function buildComicAssets() {
  const list = [];
  for (let ch = 1; ch <= 5; ch++) {
    for (const part of ["prologue", "epilogue"]) {
      for (let i = 1; i <= 4; i++) {
        const key = `comic-ch${ch}-${part}-${i}`;
        list.push({ key, url: img(`comics/ch${ch}-${part}-${i}.png`) });
      }
    }
  }
  return list;
}

export const COMIC_ASSETS = buildComicAssets();

// ─── 启动画面 / 菜单 ────────────────────────────────────
export const SPLASH_ASSETS = {
  "splash-main": img("splash/splash-main.png"),
  "menu-bg": img("menu/menu-bg.png"),
};

/**
 * 统一加载入口：在 scene.preload() 中调用
 */
export function loadAllNewAssets(scene) {
  const loadMap = (map) => {
    Object.entries(map).forEach(([key, url]) => {
      if (!scene.textures.exists(key)) {
        scene.load.image(key, url);
      }
    });
  };

  loadMap(PROJECTILE_ASSETS);
  loadMap(ICON_ASSETS);
  loadMap(UI_ASSETS);
  loadMap(PORTRAIT_ASSETS);
  loadMap(MONSTER_PORTRAIT_ASSETS);
  loadMap(SPLASH_ASSETS);

  ENEMY_FRAME_ASSETS.forEach(({ key, url }) => {
    if (!scene.textures.exists(key)) {
      scene.load.image(key, url);
    }
  });

  COMIC_ASSETS.forEach(({ key, url }) => {
    if (!scene.textures.exists(key)) {
      scene.load.image(key, url);
    }
  });
}
