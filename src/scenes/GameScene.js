import Phaser from "phaser";
import { CHAPTERS, getChapterByLevelId } from "../data/chapters.js";
import { EASTER_EGGS } from "../data/easterEggs.js";
import { ENEMY_SHEETS, pickWaveMonsterTypes } from "../data/monsters.js";
import { BASIC_SHOP_ITEMS, EQUIPMENT_CATALOG, RARITY_CONFIG } from "../data/equipment.js";
import { HERO_DEFS } from "../data/heroes.js";
import { DEFAULT_LEVEL_ID, LEVELS, getLevelCompleteKey, isWildMerchantLevel } from "../data/levels.js";
import {
  DECORATIONS,
  GAME_HEIGHT,
  GAME_WIDTH,
  PANEL_X,
  PATH_LENGTH,
  PATH_POINTS,
  PATH_SEGMENTS,
  TEXT_STYLE,
  TOTAL_WAVES,
  TOWER_SLOTS,
  pointOnPath,
} from "../data/map.js";
import { SPECIAL_TOWER_KEYS, TOWER_BUTTON_ORDER, TOWER_TYPES } from "../data/towers.js";
import { createGameTextures } from "../render/textures.js";
import { cloneStats, pickRandom } from "../utils/random.js";

const HERO_OUTPOST_OFFSET = 24;
const HERO_OUTPOST_SPACING = 34;
const HERO_MOVE_SPEED = 150;
const HERO_RESPAWN_MS = 8000;
const HERO_ULTIMATE_ATTACKS = 5;
const HERO_COLLISION_RADIUS = 18;
const HERO_FIELD_SIZE = 34;
const TOWER_DISPLAY_SIZE_BY_LEVEL = [62, 66, 69, 72];
const TOWER_TEXTURE_KEYS = {
  arrow: "tower-arrow",
  mage: "tower-mage",
  barracks: "tower-barracks",
  artillery: "tower-artillery",
  frost: "tower-frost",
  flame: "tower-flame",
  altar: "tower-altar",
};
const TOWER_STATE_ASSETS = {
  arrow: {
    l1: new URL("../assets/towers/arrow-l1.png", import.meta.url).href,
    l2: new URL("../assets/towers/arrow-l2.png", import.meta.url).href,
    l3: new URL("../assets/towers/arrow-l3.png", import.meta.url).href,
    attack: new URL("../assets/towers/arrow-attack.png", import.meta.url).href,
    branches: {
      burst: new URL("../assets/towers/arrow-branch-burst.png", import.meta.url).href,
      hawk: new URL("../assets/towers/arrow-branch-hawk.png", import.meta.url).href,
    },
  },
  mage: {
    l1: new URL("../assets/towers/mage-l1.png", import.meta.url).href,
    l2: new URL("../assets/towers/mage-l2.png", import.meta.url).href,
    l3: new URL("../assets/towers/mage-l3.png", import.meta.url).href,
    attack: new URL("../assets/towers/mage-attack.png", import.meta.url).href,
    branches: {
      arcane: new URL("../assets/towers/mage-branch-arcane.png", import.meta.url).href,
      meteor: new URL("../assets/towers/mage-branch-meteor.png", import.meta.url).href,
    },
  },
  barracks: {
    l1: new URL("../assets/towers/barracks-l1.png", import.meta.url).href,
    l2: new URL("../assets/towers/barracks-l2.png", import.meta.url).href,
    l3: new URL("../assets/towers/barracks-l3.png", import.meta.url).href,
    attack: new URL("../assets/towers/barracks-attack.png", import.meta.url).href,
    branches: {
      veteran: new URL("../assets/towers/barracks-branch-veteran.png", import.meta.url).href,
      reserve: new URL("../assets/towers/barracks-branch-reserve.png", import.meta.url).href,
    },
  },
  artillery: {
    l1: new URL("../assets/towers/artillery-l1.png", import.meta.url).href,
    l2: new URL("../assets/towers/artillery-l2.png", import.meta.url).href,
    l3: new URL("../assets/towers/artillery-l3.png", import.meta.url).href,
    attack: new URL("../assets/towers/artillery-attack.png", import.meta.url).href,
    branches: {
      shrapnel: new URL("../assets/towers/artillery-branch-shrapnel.png", import.meta.url).href,
      rapid: new URL("../assets/towers/artillery-branch-rapid.png", import.meta.url).href,
    },
  },
  flame: {
    l1: new URL("../assets/towers/flame-l1.png", import.meta.url).href,
    l2: new URL("../assets/towers/flame-l2.png", import.meta.url).href,
    l3: new URL("../assets/towers/flame-l3.png", import.meta.url).href,
    attack: new URL("../assets/towers/flame-attack.png", import.meta.url).href,
    branches: {
      inferno: new URL("../assets/towers/flame-branch-inferno.png", import.meta.url).href,
      wildfire: new URL("../assets/towers/flame-branch-wildfire.png", import.meta.url).href,
    },
  },
};
const HERO_POSES = ["move", "attack", "block"];
const HERO_TEXTURE_SIZE = 46;
const HERO_POSE_ASSETS = {
  tiezhu: {
    move: new URL("../assets/heroes/tiezhu-move.png", import.meta.url).href,
    attack: new URL("../assets/heroes/tiezhu-attack.png", import.meta.url).href,
    block: new URL("../assets/heroes/tiezhu-block.png", import.meta.url).href,
  },
  ergou: {
    move: new URL("../assets/heroes/ergou-move.png", import.meta.url).href,
    attack: new URL("../assets/heroes/ergou-attack.png", import.meta.url).href,
    block: new URL("../assets/heroes/ergou-block.png", import.meta.url).href,
  },
  yueguang: {
    move: new URL("../assets/heroes/yueguang-move.png", import.meta.url).href,
    attack: new URL("../assets/heroes/yueguang-attack.png", import.meta.url).href,
    block: new URL("../assets/heroes/yueguang-block.png", import.meta.url).href,
  },
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  init(data = {}) {
    this.levelId = data?.levelId ?? DEFAULT_LEVEL_ID;
    this.levelConfig = LEVELS[this.levelId] ?? LEVELS[DEFAULT_LEVEL_ID];
    this.chapter = getChapterByLevelId(this.levelId);
    this.totalWaves = this.levelConfig.waveCount ?? TOTAL_WAVES;
    this.gold = 160;
    this.lives = 20;
    this.wave = 0;
    this.score = 0;
    this.bestWave = Number(localStorage.getItem("crown-outpost-best-wave") || 0);
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.heroEffects = [];
    this.inventory = [];
    this.unlockedBlueprints = new Set();
    this.blueprintFragments = 0;
    this.selectedBuildType = "arrow";
    this.pendingBuildType = "arrow";
    this.selectedTower = null;
    this.selectedHero = null;
    this.heroMoveMarker = null;
    this.selectedShopHeroId = "tiezhu";
    this.waveActive = false;
    this.prepPhase = false;
    this.prepCountdown = 0;
    this.prepInitialDuration = 0;
    this.gameEnded = false;
    this.paused = false;
    this.modalOpen = false;
    this.modalObjects = [];
    this.currentMerchant = null;
    this.spawnedThisWave = 0;
    this.enemiesThisWave = 0;
    this.defeatedWaves = 0;
    this.nextSpawnAt = 0;
    this.spawnEvery = 820;
    this.claimedEasterEggs = this.loadClaimedEasterEggs();
    this.createHeroState();
  }

  preload() {
    this.loadHeroAssets();
    this.loadChapterMaps();
    this.loadEnemySheets();
  }

  loadChapterMaps() {
    CHAPTERS.forEach((chapter) => {
      if (!this.textures.exists(chapter.mapKey)) {
        this.load.image(chapter.mapKey, chapter.mapUrl);
      }
    });
  }

  loadEnemySheets() {
    ENEMY_SHEETS.forEach((sheet) => {
      if (!this.textures.exists(sheet.key)) {
        this.load.image(sheet.key, sheet.url);
      }
    });
  }

  create() {
    this.createTextures();
    this.createMap();
    this.createEasterEggs();
    this.createSlots();
    this.createHeroes();
    this.createUi();
    this.createHeroCommandInput();
    this.updateUi();
    this.startPrepPhase(60);
  }

  update(time, delta) {
    if (this.gameEnded || this.modalOpen || this.paused) {
      return;
    }

    if (this.prepPhase) {
      this.prepCountdown -= delta / 1000;
      this.updatePrepDisplay();
      if (this.prepCountdown <= 0) {
        this.endPrepPhase(false);
        return;
      }
    }

    this.updateSpawning(time);
    this.updateEnemies(time, delta);
    this.updateTowers(time);
    this.updateProjectiles(delta);
    this.updateHeroes(time, delta);
    this.updateHeroEffects(delta);
    this.checkWaveComplete();
  }

  createHeroState() {
    this.heroes = HERO_DEFS.map((def, index) => {
      const pathProgress = this.getOutpostHeroProgress(index);
      const start = pointOnPath(pathProgress);
      const hero = {
        ...def,
        homeX: start.x,
        homeY: start.y,
        x: start.x,
        y: start.y,
        pathProgress,
        targetProgress: pathProgress,
        targetX: start.x,
        targetY: start.y,
        hp: def.maxHp,
        equipment: { weapon: null, armor: null, offhand: null },
        nextAttackAt: 0,
        nextHealAt: 0,
        actionState: "idle",
        actionUntil: 0,
        attackCount: 0,
        blockStreak: 0,
        dead: false,
        respawnAt: 0,
      };

      this.recalculateHeroStats(hero);
      hero.hp = hero.stats.maxHp;
      return hero;
    });
  }

  getOutpostHeroProgress(index) {
    return Phaser.Math.Clamp(PATH_LENGTH - HERO_OUTPOST_OFFSET - index * HERO_OUTPOST_SPACING, 0, PATH_LENGTH);
  }

  createTextures() {
    createGameTextures(this);
  }

  loadHeroAssets() {
    this.load.image("hero-tiezhu", new URL("../assets/heroes/tiezhu.png", import.meta.url).href);
    this.load.image("hero-ergou", new URL("../assets/heroes/ergou.png", import.meta.url).href);
    this.load.image("hero-yueguang", new URL("../assets/heroes/yueguang.png", import.meta.url).href);
    Object.entries(HERO_POSE_ASSETS).forEach(([heroId, poses]) => {
      Object.entries(poses).forEach(([pose, assetUrl]) => {
        this.load.image(`hero-${heroId}-${pose}`, assetUrl);
      });
    });
    this.load.image("tower-arrow", new URL("../assets/towers/arrow.png", import.meta.url).href);
    this.load.image("tower-mage", new URL("../assets/towers/mage.png", import.meta.url).href);
    this.load.image("tower-barracks", new URL("../assets/towers/barracks.png", import.meta.url).href);
    this.load.image("tower-artillery", new URL("../assets/towers/artillery.png", import.meta.url).href);
    this.load.image("tower-frost", new URL("../assets/towers/frost.png", import.meta.url).href);
    this.load.image("tower-flame", new URL("../assets/towers/flame.png", import.meta.url).href);
    this.load.image("tower-altar", new URL("../assets/towers/altar.png", import.meta.url).href);
    Object.entries(TOWER_STATE_ASSETS).forEach(([typeKey, assets]) => {
      ["l1", "l2", "l3", "attack"].forEach((state) => {
        this.load.image(`tower-${typeKey}-${state}`, assets[state]);
      });
      Object.entries(assets.branches).forEach(([branchKey, assetUrl]) => {
        this.load.image(`tower-${typeKey}-branch-${branchKey}`, assetUrl);
      });
    });
  }

  createMap() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x87b866).setOrigin(0);

    const chapterMapKey = this.chapter?.mapKey;
    if (chapterMapKey && this.textures.exists(chapterMapKey)) {
      this.add.image(0, 0, chapterMapKey)
        .setOrigin(0)
        .setDisplaySize(PANEL_X, GAME_HEIGHT)
        .setAlpha(0.92);
    } else {
      this.add.rectangle(0, 0, PANEL_X, GAME_HEIGHT, 0x9bcf73, 0.62).setOrigin(0);
    }
    this.add.grid(PANEL_X / 2, GAME_HEIGHT / 2, PANEL_X, GAME_HEIGHT, 48, 48, 0x000000, 0, 0x6a9f4b, 0.1);

    this.drawTerrainPatches();
    this.drawBaseAndEntry();
    this.placeDecorations();

    this.add.rectangle(PANEL_X + 101, GAME_HEIGHT / 2, 202, GAME_HEIGHT, 0xead39a, 1);
    this.add.rectangle(PANEL_X + 101, GAME_HEIGHT / 2, 184, GAME_HEIGHT - 22, 0xf6e2a9, 1)
      .setStrokeStyle(4, 0x7a4b25, 1);
    this.add.rectangle(PANEL_X, GAME_HEIGHT / 2, 4, GAME_HEIGHT, 0x5d3c20, 0.9);
  }

  drawTerrainPatches() {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x7eb45d, 0.32);
    [
      [70, 78, 124, 54],
      [610, 78, 164, 56],
      [202, 492, 170, 52],
      [592, 498, 142, 46],
      [420, 64, 112, 36],
    ].forEach(([x, y, width, height]) => graphics.fillEllipse(x, y, width, height));

    graphics.fillStyle(0x6fa855, 0.24);
    for (let i = 0; i < 44; i += 1) {
      graphics.fillEllipse(Phaser.Math.Between(16, PANEL_X - 28), Phaser.Math.Between(24, GAME_HEIGHT - 20), 16, 6);
    }
  }

  drawPath() {
    const graphics = this.add.graphics();

    this.strokePath(graphics, 70, 0x5f4a2f, 0.28);
    this.strokePath(graphics, 58, 0x7d633b, 0.62);
    this.drawDirtRoadTexture(44);
    this.drawRaggedRoadEdges(graphics, 44);

    graphics.lineStyle(4, 0x6f4b2d, 0.28);
    PATH_SEGMENTS.forEach((segment) => {
      const offset = segment.angle === 0 || Math.abs(segment.angle) === Math.PI ? 12 : 0;
      const sideOffset = segment.angle === Math.PI / 2 || segment.angle === -Math.PI / 2 ? 12 : 0;
      graphics.lineBetween(segment.from.x + sideOffset, segment.from.y + offset, segment.to.x + sideOffset, segment.to.y + offset);
      graphics.lineBetween(segment.from.x - sideOffset, segment.from.y - offset, segment.to.x - sideOffset, segment.to.y - offset);
    });

    graphics.fillStyle(0x5f4329, 0.24);
    PATH_SEGMENTS.forEach((segment) => {
      const count = Math.max(2, Math.floor(segment.length / 70));

      for (let i = 0; i < count; i += 1) {
        const t = (i + 0.45) / count;
        const x = Phaser.Math.Linear(segment.from.x, segment.to.x, t);
        const y = Phaser.Math.Linear(segment.from.y, segment.to.y, t);
        graphics.fillEllipse(x, y, 18, 7);
      }
    });

    graphics.fillStyle(0x6f9d4f, 0.32);
    PATH_SEGMENTS.forEach((segment) => {
      const count = Math.max(2, Math.floor(segment.length / 84));
      const horizontal = Math.abs(segment.to.y - segment.from.y) < 1;

      for (let i = 0; i < count; i += 1) {
        const t = (i + 0.28) / count;
        const baseX = Phaser.Math.Linear(segment.from.x, segment.to.x, t);
        const baseY = Phaser.Math.Linear(segment.from.y, segment.to.y, t);
        const side = i % 2 === 0 ? -1 : 1;
        const x = baseX + (horizontal ? 0 : side * 27);
        const y = baseY + (horizontal ? side * 27 : 0);
        graphics.fillEllipse(x, y, 18, 6);
      }
    });
  }

  drawRaggedRoadEdges(graphics, width) {
    PATH_SEGMENTS.forEach((segment, segmentIndex) => {
      const horizontal = Math.abs(segment.to.y - segment.from.y) < 1;
      const count = Math.max(4, Math.floor(segment.length / 30));

      for (let i = 0; i < count; i += 1) {
        const t = (i + 0.18 + (segmentIndex % 3) * 0.08) / count;
        const baseX = Phaser.Math.Linear(segment.from.x, segment.to.x, t);
        const baseY = Phaser.Math.Linear(segment.from.y, segment.to.y, t);
        const wobble = Math.sin((i + 1) * 1.73 + segmentIndex * 2.11);
        const side = i % 2 === 0 ? -1 : 1;
        const edgeOffset = width / 2 + 2 + wobble * 5;
        const x = baseX + (horizontal ? Phaser.Math.Between(-8, 8) : side * edgeOffset);
        const y = baseY + (horizontal ? side * edgeOffset : Phaser.Math.Between(-8, 8));

        graphics.fillStyle(0x8fc468, 0.46);
        graphics.fillEllipse(x, y, Phaser.Math.Between(18, 34), Phaser.Math.Between(7, 15));

        if (i % 3 === 0) {
          graphics.fillStyle(0x6f4b2d, 0.3);
          graphics.fillEllipse(
            baseX + (horizontal ? Phaser.Math.Between(-12, 12) : side * (edgeOffset - 9)),
            baseY + (horizontal ? side * (edgeOffset - 9) : Phaser.Math.Between(-12, 12)),
            Phaser.Math.Between(12, 24),
            Phaser.Math.Between(5, 10),
          );
        }
      }
    });

    PATH_POINTS.forEach(([x, y], index) => {
      if (index === 0 || index === PATH_POINTS.length - 1) {
        return;
      }

      graphics.fillStyle(0xb1824d, 0.42);
      graphics.fillEllipse(x + Phaser.Math.Between(-12, 12), y + Phaser.Math.Between(-12, 12), 32, 18);
      graphics.fillStyle(0x7fab5a, 0.28);
      graphics.fillEllipse(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-20, 20), 42, 14);
    });
  }

  drawDirtRoadTexture(width) {
    PATH_SEGMENTS.forEach((segment) => {
      const horizontal = Math.abs(segment.to.y - segment.from.y) < 1;
      const x = (segment.from.x + segment.to.x) / 2;
      const y = (segment.from.y + segment.to.y) / 2;
      const roadWidth = horizontal ? segment.length + width : width;
      const roadHeight = horizontal ? width : segment.length + width;
      this.add.tileSprite(x, y, roadWidth, roadHeight, "dirt-road")
        .setDepth(1.5);
    });

    PATH_POINTS.forEach(([x, y]) => {
      this.add.tileSprite(x, y, width, width, "dirt-road")
        .setDepth(1.5)
        .setMask(this.createCircleMask(x, y, width / 2));
    });
  }

  createCircleMask(x, y, radius) {
    const shape = this.make.graphics({ x: 0, y: 0, add: false });
    shape.fillStyle(0xffffff, 1);
    shape.fillCircle(x, y, radius);
    return shape.createGeometryMask();
  }

  strokePath(graphics, width, color, alpha) {
    graphics.lineStyle(width, color, alpha);
    graphics.beginPath();
    graphics.moveTo(PATH_POINTS[0][0], PATH_POINTS[0][1]);
    PATH_POINTS.slice(1).forEach(([x, y]) => graphics.lineTo(x, y));
    graphics.strokePath();
    graphics.fillStyle(color, alpha);
    PATH_POINTS.forEach(([x, y]) => graphics.fillCircle(x, y, width / 2));
  }

  drawBaseAndEntry() {
    this.add.circle(736, 324, 28, 0xffcf45, 1)
      .setStrokeStyle(5, 0x7a4b25, 0.9)
      .setDepth(4);
    this.add.circle(736, 324, 18, 0xf7d76e, 0.86)
      .setDepth(4.1);
    this.add.circle(24, 338, 28, 0xffcf45, 1)
      .setStrokeStyle(5, 0x7a4b25, 0.9)
      .setDepth(4);
    this.add.circle(24, 338, 18, 0xf7d76e, 0.86)
      .setDepth(4.1);
    this.add.rectangle(740, 324, 34, 82, 0x8b5a2b, 1).setStrokeStyle(4, 0x593516, 1).setDepth(4.2);
    this.add.rectangle(740, 298, 48, 24, 0xb43b2f, 1).setStrokeStyle(3, 0x5d2b22, 1).setDepth(4.3);
    this.add.rectangle(740, 332, 18, 50, 0x4f2f18, 1).setDepth(4.4);
    this.add.circle(736, 350, 2, 0xf6d37a, 1).setDepth(4.5);
    this.add.text(710, 272, "前哨", {
      ...TEXT_STYLE,
      fontSize: "16px",
      color: "#4b2c13",
    }).setDepth(3);
  }

  placeDecorations() {
    this.mapObstacles = [];
    DECORATIONS.forEach(([texture, x, y, scale, options = {}]) => {
      this.add.image(x, y, texture).setScale(scale).setDepth(y < 150 ? 1 : 2).setAlpha(0.96);
      if (options.obstacleRadius) {
        this.mapObstacles.push({
          x,
          y,
          radius: options.obstacleRadius * scale,
        });
      }
    });
  }

  createEasterEggs() {
    this.easterEggObjects = [];

    EASTER_EGGS.forEach((egg) => {
      if (egg.virtual) {
        return;
      }

      if (this.claimedEasterEggs.has(egg.id)) {
        return;
      }

      const marker = this.add.circle(egg.x, egg.y, 8, egg.fragment ? 0xdedcff : 0xf6c453, 0.9)
        .setStrokeStyle(2, 0x6b4a22, 0.8)
        .setDepth(8)
        .setInteractive({ useHandCursor: true });
      const sparkle = this.add.star(egg.x + 10, egg.y - 9, 5, 3, 6, 0xfff3bd, 0.85)
        .setDepth(8)
        .setInteractive({ useHandCursor: true });
      const claim = () => this.claimEasterEgg(egg, [marker, sparkle]);

      marker.on("pointerdown", claim);
      sparkle.on("pointerdown", claim);
      this.tweens.add({
        targets: sparkle,
        angle: 360,
        duration: 1800,
        repeat: -1,
      });
      this.easterEggObjects.push(marker, sparkle);
    });
  }

  claimEasterEgg(egg, objects) {
    if (this.claimedEasterEggs.has(egg.id)) {
      return;
    }

    this.claimedEasterEggs.add(egg.id);
    this.saveClaimedEasterEggs();
    objects.forEach((item) => item.destroy());

    if (egg.fragment) {
      this.addBlueprintFragment();
      this.showNotice(`${egg.label}：图纸碎片 +1`, "#5a4ba6");
    } else {
      this.gold += egg.reward;
      this.showNotice(`${egg.label}：金币 +${egg.reward}`, "#315c22");
    }

    this.updateUi();
  }

  loadClaimedEasterEggs() {
    const oldKey = "crown-outpost-easter-eggs";
    const newKey = "crown-outpost-easter-eggs-v2";
    const parseJson = (value, fallback) => {
      try {
        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    };
    const existing = localStorage.getItem(newKey);

    if (existing) {
      const byChapter = parseJson(existing, {});
      return new Set(byChapter["0"] ?? []);
    }

    const oldClaimed = parseJson(localStorage.getItem(oldKey), []);
    localStorage.setItem(newKey, JSON.stringify({ 0: oldClaimed }));
    return new Set(oldClaimed);
  }

  saveClaimedEasterEggs() {
    const oldKey = "crown-outpost-easter-eggs";
    const newKey = "crown-outpost-easter-eggs-v2";
    const claimed = [...this.claimedEasterEggs];

    localStorage.setItem(newKey, JSON.stringify({ 0: claimed }));
    localStorage.setItem(oldKey, JSON.stringify(claimed));
  }

  createSlots() {
    this.slots = TOWER_SLOTS.map(([x, y], index) => {
      const platform = this.add.ellipse(x, y, 54, 36, 0x5a4028, 0.92)
        .setStrokeStyle(4, 0x2f2415, 0.68)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });
      const inner = this.add.ellipse(x, y + 1, 38, 22, 0x2d261d, 0.48)
        .setStrokeStyle(2, 0x9d7a4c, 0.5)
        .setDepth(6)
        .setInteractive({ useHandCursor: true });
      const rim = this.add.ellipse(x - 5, y - 7, 34, 9, 0xc7a36d, 0.24)
        .setDepth(6.1)
        .setInteractive({ useHandCursor: true });
      const slot = { index, x, y, platform, inner, rim, tower: null };
      const click = () => this.handleSlotClick(slot);

      [platform, inner, rim].forEach((item) => {
        item.on("pointerover", () => this.previewBuildRange(slot));
        item.on("pointerout", () => this.clearHoverRange(slot));
        item.on("pointerdown", click);
      });

      return slot;
    });
  }

  createHeroes() {
    this.heroes.forEach((hero) => {
      const selectionRing = this.add.circle(0, 0, 19, 0xffe28a, 0.18)
        .setStrokeStyle(3, 0xffd15a, 0.95)
        .setVisible(false);
      const shadow = this.add.ellipse(0, 12, 25, 8, 0x2f2415, 0.24);
      const actionAura = this.add.circle(0, -8, 18, hero.accent, 0)
        .setStrokeStyle(2, hero.accent, 0);
      const sprite = this.add.image(0, -8, `hero-${hero.id}`)
        .setDisplaySize(HERO_TEXTURE_SIZE, HERO_TEXTURE_SIZE);
      const name = this.add.text(0, 18, hero.name, {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "12px",
        color: "#2b1c10",
        backgroundColor: "rgba(246,226,169,0.75)",
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5);
      const hpBack = this.add.rectangle(-17, -24, 34, 4, 0x3b2415, 0.9).setOrigin(0, 0.5);
      const hpFill = this.add.rectangle(-17, -24, 34, 4, 0x4cbe58, 1).setOrigin(0, 0.5);
      const group = this.add.container(hero.x, hero.y, [selectionRing, shadow, actionAura, sprite, hpBack, hpFill, name])
        .setDepth(16)
        .setInteractive(new Phaser.Geom.Circle(0, 0, 22), Phaser.Geom.Circle.Contains);

      group.on("pointerdown", (pointer, localX, localY, event) => {
        event?.stopPropagation();
        this.selectHero(hero);
      });

      hero.group = group;
      hero.sprite = sprite;
      hero.spriteBaseScaleX = sprite.scaleX;
      hero.spriteBaseScaleY = sprite.scaleY;
      hero.actionAura = actionAura;
      hero.shadow = shadow;
      hero.hpFill = hpFill;
      hero.nameLabel = name;
      hero.selectionRing = selectionRing;
      this.updateHeroSprite(hero);
    });
  }

  createHeroCommandInput() {
    this.input.on("pointerdown", (pointer, gameObjects) => {
      this.handleHeroCommandPointer(pointer, gameObjects);
    });
  }

  selectHero(hero) {
    if (this.gameEnded || this.modalOpen) {
      return;
    }

    if (hero.dead) {
      this.showNotice(`${hero.name} 已倒下`, "#9c2b24");
      this.updateHeroPortraits();
      return;
    }

    this.selectedHero = hero;
    this.selectedShopHeroId = hero.id;
    this.selectedTower = null;
    this.clearSelectedRange();
    this.updateHeroSelectionVisuals();
    this.showNotice(`${hero.name}：点击地图移动`, "#2f4972");
    this.updateUi();
  }

  updateHeroSelectionVisuals() {
    this.heroes.forEach((hero) => {
      hero.selectionRing?.setVisible(hero === this.selectedHero && !hero.dead);
    });
  }

  handleHeroCommandPointer(pointer, gameObjects = []) {
    if (!this.selectedHero || this.gameEnded || this.modalOpen || this.paused) {
      return;
    }

    if (gameObjects.length > 0 || pointer.worldX >= PANEL_X) {
      return;
    }

    const point = { x: pointer.worldX, y: pointer.worldY };

    if (!this.isHeroPointWalkable(point.x, point.y)) {
      this.showNotice("英雄无法穿过阻碍", "#9c2b24");
      return;
    }

    this.commandSelectedHero(point);
  }

  commandSelectedHero(point) {
    const hero = this.selectedHero;

    if (!hero || hero.dead) {
      return;
    }

    hero.targetX = point.x;
    hero.targetY = point.y;
    this.showHeroMoveMarker(point.x, point.y, hero.accent);
    this.showNotice(`${hero.name} 移动`, "#315c22");
  }

  showHeroMoveMarker(x, y, color) {
    this.heroMoveMarker?.destroy();
    this.heroMoveMarker = this.add.circle(x, y, 12, color, 0.22)
      .setStrokeStyle(3, color, 0.92)
      .setDepth(15);
    this.tweens.add({
      targets: this.heroMoveMarker,
      alpha: 0,
      scale: 1.55,
      duration: 520,
      onComplete: () => {
        this.heroMoveMarker?.destroy();
        this.heroMoveMarker = null;
      },
    });
  }

  getClosestPointOnPath(x, y) {
    return PATH_SEGMENTS.reduce((best, segment) => {
      const dx = segment.to.x - segment.from.x;
      const dy = segment.to.y - segment.from.y;
      const lengthSq = dx * dx + dy * dy;
      const t = lengthSq === 0
        ? 0
        : Phaser.Math.Clamp(((x - segment.from.x) * dx + (y - segment.from.y) * dy) / lengthSq, 0, 1);
      const pathX = Phaser.Math.Linear(segment.from.x, segment.to.x, t);
      const pathY = Phaser.Math.Linear(segment.from.y, segment.to.y, t);
      const distance = Phaser.Math.Distance.Between(x, y, pathX, pathY);

      if (distance >= best.distance) {
        return best;
      }

      return {
        x: pathX,
        y: pathY,
        distance,
        progress: segment.start + segment.length * t,
      };
    }, { distance: Infinity, progress: 0, x: 0, y: 0 });
  }

  createUi() {
    this.hudBox = this.add.rectangle(20, 14, 714, 42, 0xf6e2a9, 0.93)
      .setOrigin(0)
      .setStrokeStyle(3, 0x7a4b25, 0.92)
      .setDepth(30);
    this.hudText = this.add.text(34, 24, "", {
      ...TEXT_STYLE,
      fontSize: "13px",
      color: "#352415",
      lineSpacing: 2,
    }).setDepth(31);

    this.noticeText = this.add.text(PANEL_X / 2, 516, "", {
      ...TEXT_STYLE,
      fontSize: "18px",
      color: "#6d2e18",
      align: "center",
    }).setOrigin(0.5).setDepth(30).setAlpha(0);

    this.prepBox = this.add.rectangle(PANEL_X / 2, 76, 360, 40, 0xf6e2a9, 0.94)
      .setStrokeStyle(2, 0x7a4b25, 0.92)
      .setDepth(30)
      .setVisible(false);
    this.prepText = this.add.text(PANEL_X / 2, 76, "", {
      ...TEXT_STYLE,
      fontSize: "14px",
      color: "#4a2d17",
      align: "center",
    }).setOrigin(0.5).setDepth(31).setVisible(false);

    this.createHeroPortraits();

    this.add.text(PANEL_X + 24, 24, "王冠前哨", {
      ...TEXT_STYLE,
      fontSize: "24px",
      color: "#4a2d17",
    }).setDepth(30);

    this.pauseButton = this.createButton(PANEL_X + 178, 30, 54, 26, "", () => this.togglePause(), {
      fill: 0xe7c980,
      stroke: 0x8a5a26,
      color: "#3a2816",
      hoverFill: 0xf0d894,
    });

    this.startButton = this.createButton(PANEL_X + 101, 70, 154, 34, "", () => this.handleStartButton(), {
      fill: 0xc64c35,
      stroke: 0x74301f,
      color: "#fff6d8",
      hoverFill: 0xd95f42,
    });

    this.equipmentButton = this.createButton(PANEL_X + 62, 112, 74, 30, "装备", () => this.openEquipmentShop(), {
      fill: 0x6f8dbd,
      stroke: 0x2d4978,
      color: "#fff6d8",
      hoverFill: 0x7fa0d2,
    });

    this.inventoryButton = this.createButton(PANEL_X + 140, 112, 74, 30, "背包", () => this.openInventory(), {
      fill: 0x8fb76b,
      stroke: 0x4c7135,
      color: "#183111",
      hoverFill: 0xa0c77e,
    });

    this.add.text(PANEL_X + 24, 136, "建造", {
      ...TEXT_STYLE,
      fontSize: "15px",
      color: "#70451f",
    }).setDepth(30);

    this.towerButtons = TOWER_BUTTON_ORDER.map((key, index) => {
      const tower = TOWER_TYPES[key];
      const y = 164 + index * 34;
      const button = this.createButton(PANEL_X + 101, y, 154, 28, `${tower.name}  ${tower.price}`, () => this.selectBuildType(key), {
        fill: 0xe7c980,
        stroke: 0x8a5a26,
        color: "#3a2816",
        hoverFill: 0xf0d894,
      });
      const icon = this.add.circle(PANEL_X + 36, y, 7, tower.color, 1)
        .setStrokeStyle(2, 0x5c3218, 0.68)
        .setDepth(32);

      return { key, button, icon };
    });

    this.selectionText = this.add.text(PANEL_X + 25, 402, "", {
      ...TEXT_STYLE,
      fontSize: "13px",
      color: "#3c2814",
      lineSpacing: 2,
      wordWrap: { width: 154, useAdvancedWrap: true },
    }).setDepth(30);

    this.upgradeButton = this.createButton(PANEL_X + 101, 466, 154, 34, "", () => this.upgradeSelectedTower(), {
      fill: 0xf5b83c,
      stroke: 0x89501f,
      color: "#3b250f",
      hoverFill: 0xffca55,
    });

    this.sellButton = this.createButton(PANEL_X + 101, 506, 154, 30, "", () => this.sellSelectedTower(), {
      fill: 0x8fb76b,
      stroke: 0x4c7135,
      color: "#183111",
      hoverFill: 0xa0c77e,
    });

    this.endOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x20150d, 0.62)
      .setDepth(80)
      .setVisible(false);
    this.centerText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "36px",
      color: "#fff6d8",
      align: "center",
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(81).setVisible(false);
    this.restartButton = this.createButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 72, 154, 42, "重新开始", () => this.scene.restart(), {
      fill: 0xf5b83c,
      stroke: 0x89501f,
      color: "#3b250f",
      hoverFill: 0xffca55,
    });
    this.restartButton.setDepth(82).setVisible(false);
  }

  createHeroPortraits() {
    this.heroPortraits = this.heroes.map((hero, index) => {
      const x = 18 + index * 106;
      const y = GAME_HEIGHT - 66;
      const bg = this.add.rectangle(0, 0, 98, 58, 0xf6e2a9, 0.95)
        .setOrigin(0)
        .setStrokeStyle(3, 0x7a4b25, 0.95);
      const portraitImage = this.add.image(22, 28, `hero-${hero.id}`)
        .setDisplaySize(42, 42);
      const name = this.add.text(48, 9, hero.name.slice(1), {
        ...TEXT_STYLE,
        fontSize: "12px",
        color: "#2b1c10",
      });
      const hp = this.add.text(48, 29, "", {
        ...TEXT_STYLE,
        fontSize: "12px",
        color: "#315c22",
      });
      const container = this.add.container(x, y, [bg, portraitImage, name, hp])
        .setDepth(35)
        .setSize(98, 58)
        .setInteractive(new Phaser.Geom.Rectangle(0, 0, 98, 58), Phaser.Geom.Rectangle.Contains);

      container.on("pointerdown", (pointer, localX, localY, event) => {
        event?.stopPropagation();
        this.selectHero(hero);
      });

      const portrait = { hero, container, bg, portraitImage, name, hp };
      hero.portrait = portrait;
      return portrait;
    });

    this.updateHeroPortraits();
  }

  createButton(x, y, width, height, label, onClick, options = {}) {
    const fill = options.fill ?? 0xe7c980;
    const hoverFill = options.hoverFill ?? 0xf0d894;
    const stroke = options.stroke ?? 0x8a5a26;
    const color = options.color ?? "#3a2816";
    const bg = this.add.rectangle(0, 0, width, height, fill, 1)
      .setStrokeStyle(3, stroke, 1)
      .setDepth(30);
    const highlight = this.add.rectangle(0, -height / 2 + 5, width - 12, 4, 0xfff1bb, 0.35)
      .setDepth(31);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: height <= 30 ? "13px" : "15px",
      color,
      align: "center",
    }).setOrigin(0.5).setDepth(32);
    const button = this.add.container(x, y, [bg, highlight, text]).setDepth(30);

    button.setSize(width, height);
    button.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
    button.bg = bg;
    button.label = text;
    button.defaultFill = fill;
    button.hoverFill = hoverFill;
    button.enabled = true;
    button.on("pointerover", () => {
      if (button.enabled) {
        bg.setFillStyle(hoverFill, 1);
      }
    });
    button.on("pointerout", () => {
      bg.setFillStyle(button.selected ? 0xf5b83c : fill, 1);
    });
    button.on("pointerdown", () => {
      if (button.enabled) {
        onClick();
      }
    });

    return button;
  }

  setButtonEnabled(button, enabled) {
    button.enabled = enabled;
    button.setAlpha(enabled ? 1 : 0.48);
    if (!enabled) {
      button.bg.setFillStyle(button.defaultFill, 1);
    }
  }

  setButtonLabel(button, label) {
    button.label.setText(label);
  }

  togglePause(force = null) {
    if (this.gameEnded) {
      return;
    }

    this.paused = force ?? !this.paused;
    this.showNotice(this.paused ? "暂停" : "继续", this.paused ? "#7a3d12" : "#315c22");
    this.updateUi();
  }

  selectBuildType(key) {
    if (this.paused) {
      this.showNotice("游戏已暂停", "#7a3d12");
      return;
    }

    if (!this.isTowerUnlocked(key)) {
      this.showNotice(`${TOWER_TYPES[key].name} 需要图纸`, "#9c2b24");
      return;
    }

    this.selectedBuildType = key;
    this.pendingBuildType = key;
    this.selectedTower = null;
    this.selectedHero = null;
    this.updateHeroSelectionVisuals();
    this.clearSelectedRange();
    this.updateUi();
  }

  handleSlotClick(slot) {
    if (this.gameEnded || this.modalOpen || this.paused) {
      return;
    }

    if (slot.tower) {
      this.selectTower(slot.tower);
      return;
    }

    this.buildTower(slot, this.getPendingBuildType());
  }

  getPendingBuildType() {
    const typeKey = this.pendingBuildType || this.selectedBuildType || "arrow";
    return TOWER_TYPES[typeKey] ? typeKey : "arrow";
  }

  getTowerTextureKey(typeKey, level = 1, branch = null, state = "base") {
    if (state === "attack" && this.textures.exists(`tower-${typeKey}-attack`)) {
      return `tower-${typeKey}-attack`;
    }

    if (branch && this.textures.exists(`tower-${typeKey}-branch-${branch}`)) {
      return `tower-${typeKey}-branch-${branch}`;
    }

    const levelKey = `tower-${typeKey}-l${Phaser.Math.Clamp(level, 1, 3)}`;
    if (this.textures.exists(levelKey)) {
      return levelKey;
    }

    return TOWER_TEXTURE_KEYS[typeKey] ?? TOWER_TYPES[typeKey]?.texture ?? TOWER_TEXTURE_KEYS.arrow;
  }

  buildTower(slot, typeKey) {
    const safeTypeKey = TOWER_TYPES[typeKey] ? typeKey : "arrow";
    const type = TOWER_TYPES[safeTypeKey];

    if (!this.isTowerUnlocked(safeTypeKey)) {
      this.showNotice(`${type.name} 需要特殊塔图纸`, "#9c2b24");
      return;
    }

    if (this.gold < type.price) {
      this.showNotice("金币不足", "#9c2b24");
      this.cameras.main.shake(120, 0.004);
      return;
    }

    this.gold -= type.price;
    const shadow = this.add.ellipse(slot.x, slot.y + 19, 48, 14, 0x2f2415, 0.22).setDepth(7);
    const textureKey = this.getTowerTextureKey(safeTypeKey, 1);
    const sprite = this.add.image(slot.x, slot.y - 14, textureKey)
      .setDisplaySize(TOWER_DISPLAY_SIZE_BY_LEVEL[0], TOWER_DISPLAY_SIZE_BY_LEVEL[0])
      .setDepth(9)
      .setInteractive({ useHandCursor: true });
    const levelText = this.add.text(slot.x + 22, slot.y + 20, "I", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "13px",
      color: "#fff6d8",
      backgroundColor: "#6e3e1e",
      padding: { x: 4, y: 1 },
    }).setOrigin(0.5).setDepth(11);
    const tower = {
      slot,
      typeKey: safeTypeKey,
      textureKey,
      level: 1,
      branch: null,
      x: slot.x,
      y: slot.y,
      shadow,
      sprite,
      levelText,
      guards: [],
      totalCost: type.price,
      nextFireAt: 0,
      ...this.getTowerStats(safeTypeKey, 1, null),
    };

    if (safeTypeKey === "barracks") {
      tower.guards = this.createTowerGuards(tower);
    }

    slot.tower = tower;
    slot.platform.setAlpha(0.42);
    slot.inner.setAlpha(0.16);
    slot.rim.setAlpha(0.12);
    sprite.on("pointerdown", () => this.selectTower(tower));
    this.towers.push(tower);
    this.selectTower(tower);
    this.showNotice(`${type.name} 已部署`, "#315c22");
    this.updateUi();
  }

  createTowerGuards(tower) {
    return [-18, 18].map((offset) => {
      const guard = this.add.image(tower.x + offset, tower.y + 18, "guard")
        .setScale(0.82)
        .setDepth(13);

      return {
        sprite: guard,
        homeX: tower.x + offset,
        homeY: tower.y + 18,
      };
    });
  }

  getTowerStats(typeKey, level, branch) {
    const type = TOWER_TYPES[typeKey];

    if (typeKey === "altar") {
      const stats = level >= 4 && branch
        ? type.branches[branch]
        : type.levels[Math.min(level, 3) - 1];
      return {
        range: type.range + (level - 1) * 10,
        damage: 0,
        rate: type.rate,
        projectileSpeed: 0,
        splash: 0,
        slowFactor: 1,
        slowMs: 0,
        burnMs: 0,
        burnDps: 0,
        projectileKind: "buff",
        damageBuff: stats.damageBuff,
        rateBuff: stats.rateBuff,
      };
    }

    if (type.branches) {
      if (level >= 4 && branch) {
        const branchStats = type.branches[branch];
        return {
          range: type.range + 18,
          damage: branchStats.damage,
          rate: branchStats.rate,
          projectileSpeed: branchStats.projectileSpeed ?? type.projectileSpeed ?? 590,
          splash: branchStats.splash ?? 0,
          slowFactor: branchStats.slowFactor ?? type.slowFactor ?? 1,
          slowMs: branchStats.slowMs ?? type.slowMs ?? 0,
          burnMs: branchStats.burnMs ?? type.burnMs ?? 0,
          burnDps: branchStats.burnDps ?? type.burnDps ?? 0,
          shrapnelDamage: branchStats.shrapnelDamage ?? 0,
          projectileKind: branchStats.projectile ?? type.projectile,
        };
      }

      const stats = type.levels[Math.min(level, 3) - 1];
      return {
        range: type.range + (level - 1) * 10,
        damage: stats.damage,
        rate: stats.rate,
        projectileSpeed: stats.projectileSpeed ?? type.projectileSpeed ?? 560,
        splash: stats.splash ?? type.splash ?? 0,
        slowFactor: stats.slowFactor ?? type.slowFactor ?? 1,
        slowMs: stats.slowMs ?? type.slowMs ?? 0,
        burnMs: stats.burnMs ?? type.burnMs ?? 0,
        burnDps: stats.burnDps ?? type.burnDps ?? 0,
        shrapnelDamage: stats.shrapnelDamage ?? 0,
        projectileKind: stats.projectile ?? type.projectile,
      };
    }

    const levelBonus = level - 1;
    return {
      range: Math.round(type.range + levelBonus * 14),
      damage: Math.round(type.damage * (1 + levelBonus * 0.36)),
      rate: Math.max(220, Math.round(type.rate * (1 - levelBonus * 0.09))),
      projectileSpeed: type.projectileSpeed,
      splash: type.splash ?? 0,
      slowFactor: type.slowFactor ?? 1,
      slowMs: type.slowMs ?? 0,
      burnMs: type.burnMs ?? 0,
      burnDps: type.burnDps ? Math.round(type.burnDps * (1 + levelBonus * 0.24)) : 0,
      projectileKind: type.projectile,
      damageBuff: type.damageBuff ?? 0,
      rateBuff: type.rateBuff ?? 0,
    };
  }

  selectTower(tower) {
    this.selectedTower = tower;
    this.selectedHero = null;
    this.updateHeroSelectionVisuals();
    this.clearSelectedRange();
    this.selectedRange = this.add.circle(tower.x, tower.y, tower.range, 0xffffff, 0)
      .setStrokeStyle(3, TOWER_TYPES[tower.typeKey].color, 0.42)
      .setDepth(6);
    this.updateUi();
  }

  clearSelectedRange() {
    this.selectedRange?.destroy();
    this.selectedRange = null;
  }

  previewBuildRange(slot) {
    if (slot.tower || this.gameEnded || this.modalOpen || this.paused) {
      return;
    }

    const type = TOWER_TYPES[this.getPendingBuildType()];
    slot.platform.setStrokeStyle(4, type.color, 0.78);
    this.hoverRange?.destroy();
    this.hoverRange = this.add.circle(slot.x, slot.y, type.range, 0xffffff, 0)
      .setStrokeStyle(2, type.color, 0.24)
      .setDepth(4);
  }

  clearHoverRange(slot) {
    if (!slot.tower) {
      slot.platform.setStrokeStyle(4, 0x2f2415, 0.68);
    }

    this.hoverRange?.destroy();
    this.hoverRange = null;
  }

  startPrepPhase(duration) {
    this.prepPhase = true;
    this.prepCountdown = duration;
    this.prepInitialDuration = duration;
    this.updateUi();
    this.updatePrepDisplay();
  }

  endPrepPhase(early) {
    if (!this.prepPhase || this.paused) {
      return;
    }
    const bonus = early ? Math.floor(this.prepCountdown) : 0;
    this.prepPhase = false;
    this.prepCountdown = 0;
    this.updatePrepDisplay();
    if (bonus > 0) {
      this.gold += bonus;
      this.showNotice(`提前开始奖励 +${bonus} 金币`, "#315c22");
    }
    this.startWave();
  }

  handleStartButton() {
    if (this.paused) {
      this.showNotice("游戏已暂停", "#7a3d12");
      return;
    }

    if (this.prepPhase) {
      this.endPrepPhase(true);
    } else {
      this.startWave();
    }
  }

  updatePrepDisplay() {
    if (!this.prepBox) {
      return;
    }
    const visible = this.prepPhase;
    this.prepBox.setVisible(visible);
    this.prepText.setVisible(visible);
    if (visible) {
      const secs = Math.ceil(this.prepCountdown);
      const label = this.prepInitialDuration === 60 ? "游戏准备" : "下波准备";
      const bonus = Math.floor(this.prepCountdown);
      this.prepText.setText(`${label}  ${secs} 秒  提前开始可奖励 ${bonus} 金币`);
    }
  }

  startWave() {
    if (this.prepPhase || this.waveActive || this.gameEnded || this.modalOpen || this.paused || this.wave >= this.totalWaves) {
      return;
    }

    this.wave += 1;
    this.recalculateAllHeroes();
    this.recoverHeroes(0.22);
    this.waveActive = true;
    this.spawnedThisWave = 0;
    this.enemiesThisWave = this.getWaveEnemyTotal(this.wave);
    this.spawnEvery = Math.max(410, 860 - this.wave * 32);
    this.nextSpawnAt = this.time.now + 450;
    this.waveMonsterPool = this.buildWaveMonsterPool(this.wave);
    this.showNotice(`第 ${this.wave}/${this.totalWaves} 波来袭`, "#7a3d12");
    this.updateUi();
  }

  buildWaveMonsterPool(wave) {
    const types = pickWaveMonsterTypes(wave);
    return types
      .map((monster) => {
        const frameKey = this.ensureMonsterFrame(monster);
        return frameKey ? { ...monster, frameKey } : null;
      })
      .filter(Boolean);
  }

  pickWaveMonster(rank) {
    const pool = this.waveMonsterPool;
    if (!pool || pool.length === 0) {
      return null;
    }
    // Boss / elite 倾向于 tier 较高的怪
    let candidates = pool;
    if (rank === "boss" || rank === "elite") {
      const maxTier = Math.max(...pool.map((m) => m.tier));
      candidates = pool.filter((m) => m.tier === maxTier);
    } else if (rank === "heavy") {
      const sorted = [...pool].sort((a, b) => b.tier - a.tier);
      candidates = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  ensureMonsterFrame(monster) {
    const tex = this.textures.get(monster.sheetKey);
    if (!tex || tex.key === "__MISSING") {
      return null;
    }
    const frameName = monster.id;
    if (!tex.has(frameName)) {
      const source = tex.source[0];
      if (!source) {
        return null;
      }
      const maxW = source.width;
      const maxH = source.height;
      const x = Math.min(monster.frame.x, maxW - 1);
      const y = Math.min(monster.frame.y, maxH - 1);
      const w = Math.min(monster.frame.w, maxW - x);
      const h = Math.min(monster.frame.h, maxH - y);
      tex.add(frameName, 0, x, y, w, h);
    }
    return frameName;
  }

  getWaveEnemyTotal(wave) {
    return 9 + wave * 3;
  }

  updateSpawning(time) {
    if (!this.waveActive || this.spawnedThisWave >= this.enemiesThisWave || time < this.nextSpawnAt) {
      return;
    }

    const rank = this.getSpawnRank();
    this.spawnEnemy(rank);
    this.spawnedThisWave += 1;
    this.nextSpawnAt = time + this.spawnEvery;
  }

  getSpawnRank() {
    const isLast = this.spawnedThisWave === this.enemiesThisWave - 1;

    if ((this.levelConfig.enemyMix === "boss" || this.wave === this.totalWaves) && this.wave === this.totalWaves && isLast) {
      return "boss";
    }

    if (this.levelConfig.enemyMix === "rare-mix" && this.wave >= 3 && Math.random() < 0.3) {
      return "rare";
    }

    if (this.wave >= 4 && isLast && this.wave % 2 === 0) {
      return "elite";
    }

    if (this.wave >= 2 && Math.random() < 0.1) {
      return "rare";
    }

    if (this.wave >= 2 && (this.spawnedThisWave % 6 === 5 || isLast)) {
      return "heavy";
    }

    return "normal";
  }

  spawnEnemy(rank) {
    const waveScale = this.wave - 1;
    const rankStats = {
      normal: { hp: 50, hpGrowth: 23, reward: 8, rewardGrowth: 1.5, speed: 62, texture: "enemy-scout", tint: 0xffffff, scale: 1, damage: 7 },
      heavy: { hp: 145, hpGrowth: 50, reward: 28, rewardGrowth: 4, speed: 43, texture: "enemy-brute", tint: 0xffffff, scale: 1, damage: 12 },
      rare: { hp: 92, hpGrowth: 34, reward: 16, rewardGrowth: 3, speed: 66, texture: "enemy-scout", tint: 0xb8deff, scale: 1.08, damage: 9 },
      elite: { hp: 225, hpGrowth: 62, reward: 42, rewardGrowth: 6, speed: 45, texture: "enemy-brute", tint: 0xd6bbff, scale: 1.12, damage: 15 },
      boss: { hp: 620, hpGrowth: 88, reward: 120, rewardGrowth: 10, speed: 34, texture: "enemy-brute", tint: 0xffcf70, scale: 1.35, damage: 22 },
    };
    const stats = rankStats[rank];
    const hpMultiplier = this.levelConfig.enemyMix === "tougher" ? 1.2 : this.levelConfig.enemyMix === "boss" ? 1.1 : 1;
    const monster = this.pickWaveMonster(rank);
    const tierScale = monster ? 1 + (monster.tier - 1) * 0.06 : 1;
    const maxHp = Math.round((stats.hp + waveScale * stats.hpGrowth) * hpMultiplier * tierScale);
    const reward = Math.round((stats.reward + this.wave * stats.rewardGrowth) * (monster ? 1 + (monster.tier - 1) * 0.05 : 1));
    const point = pointOnPath(0);
    const useSheet = monster && this.textures.exists(monster.sheetKey) && this.textures.get(monster.sheetKey).has(monster.frameKey);
    const textureKey = useSheet ? monster.sheetKey : stats.texture;
    const frameKey = useSheet ? monster.frameKey : undefined;
    const sprite = this.add.sprite(point.x, point.y, textureKey, frameKey)
      .setRotation(useSheet ? 0 : point.angle)
      .setDepth(18);
    if (useSheet) {
      const targetSize = (rank === "boss" ? 56 : rank === "elite" ? 46 : rank === "heavy" ? 42 : 36) * stats.scale;
      const maxDim = Math.max(monster.frame.w, monster.frame.h);
      const fit = targetSize / maxDim;
      sprite.setScale(fit);
    } else {
      sprite.setScale(stats.scale).setTint(stats.tint);
    }
    const barWidth = rank === "boss" ? 58 : rank === "elite" ? 48 : rank === "heavy" ? 40 : 32;
    const barBack = this.add.rectangle(point.x - barWidth / 2, point.y - 28, barWidth, 5, 0x3b2415, 0.9)
      .setOrigin(0, 0.5)
      .setDepth(19);
    const barFill = this.add.rectangle(point.x - barWidth / 2, point.y - 28, barWidth, 5, rank === "boss" ? 0xf6c453 : 0xd6422a, 1)
      .setOrigin(0, 0.5)
      .setDepth(20);
    const enemy = {
      sprite,
      barBack,
      barFill,
      maxHp,
      hp: maxHp,
      reward,
      progress: 0,
      speed: (stats.speed + (rank === "normal" || rank === "rare" ? Math.min(28, this.wave * 3) : Math.min(18, this.wave * 2)))
        * (this.levelConfig.enemyMix === "tougher" ? 0.96 : 1),
      alive: true,
      isHeavy: rank === "heavy" || rank === "elite" || rank === "boss",
      rank,
      attackDamage: stats.damage + Math.floor(this.wave * 0.8),
      nextAttackAt: 0,
      slowUntil: 0,
      slowFactor: 1,
      burnUntil: 0,
      burnDps: 0,
      baseTint: useSheet ? 0xffffff : stats.tint,
      usesSheet: useSheet,
      barWidth,
    };

    this.enemies.push(enemy);
  }

  updateEnemies(time, delta) {
    const dt = delta / 1000;

    [...this.enemies].forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }

      if (time < enemy.burnUntil) {
        enemy.hp -= enemy.burnDps * dt;
        if (enemy.hp <= 0) {
          this.destroyEnemy(enemy, true);
          return;
        }
      }

      if (time >= enemy.slowUntil) {
        enemy.slowFactor = 1;
      }

      const slowed = time < enemy.slowUntil;
      const burning = time < enemy.burnUntil;
      const speed = enemy.speed * (slowed ? enemy.slowFactor : 1);
      enemy.progress += speed * dt;

      if (enemy.progress >= PATH_LENGTH) {
        this.enemyEscaped(enemy);
        return;
      }

      const point = pointOnPath(enemy.progress);
      enemy.sprite.setPosition(point.x, point.y);
      if (!enemy.usesSheet) {
        enemy.sprite.setRotation(point.angle);
      }
      enemy.sprite.setTint(slowed ? 0xb8d9ff : burning ? 0xff9b55 : enemy.baseTint);
      enemy.barBack.setPosition(point.x - enemy.barWidth / 2, point.y - 28);
      enemy.barFill.setPosition(point.x - enemy.barWidth / 2, point.y - 28);
      enemy.barFill.setDisplaySize(enemy.barWidth * Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1), 5);
    });
  }

  updateTowers(time) {
    this.towers.forEach((tower) => {
      if (tower.typeKey === "altar") {
        this.updateAltarTower(tower, time);
        return;
      }

      const target = this.findTargetForTower(tower);

      if (tower.typeKey === "barracks") {
        this.updateBarracksTower(tower, target, time);
        return;
      }

      if (!target) {
        return;
      }

      if (time >= tower.nextFireAt) {
        this.fireTower(tower, target, time);
        this.playTowerAttackAction(tower, target);
      }
    });
  }

  updateAltarTower(tower, time) {
    if (time < tower.nextFireAt) {
      return;
    }

    this.tweens.killTweensOf(tower.sprite);
    tower.sprite.setPosition(tower.x, tower.y - 14);
    this.tweens.add({
      targets: tower.sprite,
      y: tower.y - 18,
      angle: 4,
      yoyo: true,
      duration: 160,
      onComplete: () => {
        tower.sprite.setPosition(tower.x, tower.y - 14);
        tower.sprite.setAngle(0);
      },
    });

    const aura = this.add.circle(tower.x, tower.y, tower.range, TOWER_TYPES.altar.color, 0.08)
      .setStrokeStyle(2, TOWER_TYPES.altar.accent, 0.25)
      .setDepth(5);
    this.tweens.add({
      targets: aura,
      alpha: 0,
      scale: 1.06,
      duration: 480,
      onComplete: () => aura.destroy(),
    });
    tower.nextFireAt = time + 1800;
  }

  updateBarracksTower(tower, target, time) {
    tower.guards.forEach((guard, index) => {
      const goalX = target ? target.sprite.x - 18 + index * 36 : guard.homeX;
      const goalY = target ? target.sprite.y + 18 : guard.homeY;

      guard.sprite.x = Phaser.Math.Linear(guard.sprite.x, goalX, 0.16);
      guard.sprite.y = Phaser.Math.Linear(guard.sprite.y, goalY, 0.16);
      guard.sprite.setFlipX(target ? guard.sprite.x > target.sprite.x : false);
    });

    if (!target || time < tower.nextFireAt) {
      return;
    }

    target.slowUntil = Math.max(target.slowUntil, time + tower.slowMs);
    target.slowFactor = Math.min(target.slowFactor, tower.slowFactor);
    this.damageEnemy(target, Math.round(tower.damage * this.getTowerDamageMultiplier(tower)), {
      slowMs: tower.slowMs,
      slowFactor: tower.slowFactor,
    });
    this.playBarracksAttackAction(tower, target);
    tower.nextFireAt = time + tower.rate * this.getTowerRateMultiplier(tower);
  }

  findTargetForTower(tower) {
    return this.enemies
      .filter((enemy) => enemy.alive && Phaser.Math.Distance.Between(tower.x, tower.y, enemy.sprite.x, enemy.sprite.y) <= tower.range)
      .sort((a, b) => b.progress - a.progress)[0];
  }

  getTowerRateMultiplier(tower) {
    return 1 / (1 + this.getTowerAltarBuff(tower).rateBuff);
  }

  getTowerDamageMultiplier(tower) {
    return 1 + this.getTowerAltarBuff(tower).damageBuff;
  }

  getTowerAltarBuff(tower) {
    const altar = this.towers
      .filter((item) => item.typeKey === "altar" && item !== tower
        && Phaser.Math.Distance.Between(item.x, item.y, tower.x, tower.y) <= item.range)
      .sort((a, b) => (b.damageBuff + b.rateBuff) - (a.damageBuff + a.rateBuff))[0];
    return altar ? { damageBuff: altar.damageBuff ?? 0, rateBuff: altar.rateBuff ?? 0 } : { damageBuff: 0, rateBuff: 0 };
  }

  fireTower(tower, target, time) {
    const type = TOWER_TYPES[tower.typeKey];
    const projectileKind = tower.projectileKind ?? type.projectile;

    if (projectileKind === "meteor") {
      const meteor = this.add.circle(target.sprite.x - 72, target.sprite.y - 130, 14, 0xff6a2b, 1)
        .setStrokeStyle(3, 0xffd18a, 0.9)
        .setDepth(24);
      this.projectiles.push(this.createProjectileData(meteor, tower, target, {
        speed: tower.projectileSpeed || 760,
        targetX: target.sprite.x,
        targetY: target.sprite.y,
      }));
    } else if (projectileKind === "arrow") {
      const arrow = this.add.image(tower.x, tower.y - 16, "arrow-shot")
        .setDepth(22);
      this.projectiles.push(this.createProjectileData(arrow, tower, target));
    } else {
      const projectile = this.add.circle(tower.x, tower.y - 16, tower.splash ? 7 : 6, type.color, 1)
        .setStrokeStyle(2, type.accent, 0.8)
        .setDepth(22);
      this.projectiles.push(this.createProjectileData(projectile, tower, target));
    }

    tower.nextFireAt = time + tower.rate * this.getTowerRateMultiplier(tower);
  }

  createProjectileData(sprite, tower, target, overrides = {}) {
    return {
      sprite,
      target,
      damage: Math.round(tower.damage * this.getTowerDamageMultiplier(tower)),
      speed: overrides.speed ?? tower.projectileSpeed,
      splash: tower.splash,
      slowFactor: tower.slowFactor,
      slowMs: tower.slowMs,
      burnMs: tower.burnMs,
      burnDps: tower.burnDps,
      shrapnelDamage: tower.shrapnelDamage ?? 0,
      typeKey: tower.typeKey,
      projectileKind: tower.projectileKind,
      targetX: overrides.targetX,
      targetY: overrides.targetY,
    };
  }

  playTowerAttackAction(tower, target) {
    const type = TOWER_TYPES[tower.typeKey];
    const angle = Phaser.Math.Angle.Between(tower.x, tower.y, target.sprite.x, target.sprite.y);
    const recoil = tower.typeKey === "artillery" ? 8 : 4;
    const flashX = tower.x + Math.cos(angle) * 18;
    const flashY = tower.y - 16 + Math.sin(angle) * 18;
    const baseTextureKey = this.getTowerTextureKey(tower.typeKey, tower.level, tower.branch);
    const attackTextureKey = this.getTowerTextureKey(tower.typeKey, tower.level, tower.branch, "attack");

    this.tweens.killTweensOf(tower.sprite);
    tower.sprite.setPosition(tower.x, tower.y - 14);
    tower.sprite.setAngle(0);
    if (attackTextureKey !== baseTextureKey) {
      tower.sprite.setTexture(attackTextureKey);
    }
    this.tweens.add({
      targets: tower.sprite,
      x: tower.x - Math.cos(angle) * recoil,
      y: tower.y - 14 - Math.sin(angle) * recoil,
      angle: tower.typeKey === "arrow" ? Phaser.Math.RadToDeg(angle) * 0.03 : 0,
      yoyo: true,
      duration: tower.typeKey === "artillery" ? 95 : 70,
      onComplete: () => {
        tower.sprite.setTexture(baseTextureKey);
        tower.sprite.setPosition(tower.x, tower.y - 14);
        tower.sprite.setAngle(0);
      },
    });

    if (tower.typeKey === "arrow") {
      this.addTowerFlash(flashX, flashY, 0xfff0a8, 12, 110);
    } else if (tower.typeKey === "mage") {
      this.addTowerRing(tower.x, tower.y - 14, type.color, type.accent, 20, 160);
    } else if (tower.typeKey === "artillery") {
      this.addTowerFlash(flashX, flashY, 0xffb74d, 20, 140);
      this.cameras.main.shake(55, 0.0015);
    } else if (tower.typeKey === "frost") {
      this.addTowerRing(tower.x, tower.y - 14, 0x9bdcff, 0xdbf7ff, 24, 190);
    } else if (tower.typeKey === "flame") {
      this.addTowerFlash(flashX, flashY, 0xff7a35, 18, 130);
    }
  }

  playBarracksAttackAction(tower, target) {
    tower.guards.forEach((guard, index) => {
      const direction = guard.sprite.x > target.sprite.x ? -1 : 1;
      this.tweens.killTweensOf(guard.sprite);
      this.tweens.add({
        targets: guard.sprite,
        x: guard.sprite.x + direction * 8,
        angle: direction * (index === 0 ? -10 : 10),
        yoyo: true,
        duration: 80,
        onComplete: () => guard.sprite.setAngle(0),
      });
    });

    const slash = this.add.arc(target.sprite.x, target.sprite.y - 8, 18, 210, 330, false, 0xffdf82, 0)
      .setStrokeStyle(4, 0xffdf82, 0.82)
      .setDepth(23);
    this.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.25,
      duration: 130,
      onComplete: () => slash.destroy(),
    });
  }

  addTowerFlash(x, y, color, radius, duration) {
    const flash = this.add.star(x, y, 6, radius * 0.28, radius, color, 0.85)
      .setDepth(23);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.35,
      angle: 35,
      duration,
      onComplete: () => flash.destroy(),
    });
  }

  addTowerRing(x, y, color, stroke, radius, duration) {
    const ring = this.add.circle(x, y, radius, color, 0.12)
      .setStrokeStyle(3, stroke, 0.72)
      .setDepth(23);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.45,
      duration,
      onComplete: () => ring.destroy(),
    });
  }

  updateProjectiles(delta) {
    const dt = delta / 1000;

    [...this.projectiles].forEach((projectile) => {
      if (!projectile.target?.alive) {
        this.destroyProjectile(projectile);
        return;
      }

      const targetX = projectile.targetX ?? projectile.target.sprite.x;
      const targetY = projectile.targetY ?? projectile.target.sprite.y;
      const distance = Phaser.Math.Distance.Between(projectile.sprite.x, projectile.sprite.y, targetX, targetY);
      const travel = projectile.speed * dt;

      projectile.sprite.rotation = Phaser.Math.Angle.Between(projectile.sprite.x, projectile.sprite.y, targetX, targetY);

      if (distance <= travel) {
        this.impactProjectile(projectile, targetX, targetY);
        this.destroyProjectile(projectile);
        return;
      }

      const angle = Phaser.Math.Angle.Between(projectile.sprite.x, projectile.sprite.y, targetX, targetY);
      projectile.sprite.x += Math.cos(angle) * travel;
      projectile.sprite.y += Math.sin(angle) * travel;
    });
  }

  impactProjectile(projectile, x, y) {
    if (projectile.splash > 0) {
      const blast = this.add.circle(x, y, projectile.splash, projectile.typeKey === "flame" ? 0xd95f32 : 0xf5b83c, 0.2)
        .setStrokeStyle(3, 0xffe2a2, 0.38)
        .setDepth(21);

      this.tweens.add({
        targets: blast,
        alpha: 0,
        scale: 1.24,
        duration: 220,
        onComplete: () => blast.destroy(),
      });

      [...this.enemies].forEach((enemy) => {
        const distance = Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y);

        if (enemy.alive && distance <= projectile.splash) {
          const falloff = Phaser.Math.Clamp(1 - distance / (projectile.splash * 1.6), 0.42, 1);
          this.damageEnemy(enemy, Math.round(projectile.damage * falloff), projectile);
          if (projectile.shrapnelDamage > 0) {
            this.damageEnemy(enemy, projectile.shrapnelDamage, {});
          }
        }
      });
      return;
    }

    this.damageEnemy(projectile.target, projectile.damage, projectile);
  }

  damageEnemy(enemy, amount, source = {}) {
    if (!enemy.alive) {
      return;
    }

    enemy.hp -= amount;

    if (source.slowMs > 0) {
      enemy.slowUntil = Math.max(enemy.slowUntil, this.time.now + source.slowMs);
      enemy.slowFactor = Math.min(enemy.slowFactor, source.slowFactor ?? 1);
    }

    if (source.stunMs > 0) {
      enemy.slowUntil = Math.max(enemy.slowUntil, this.time.now + source.stunMs);
      enemy.slowFactor = Math.min(enemy.slowFactor, 0.08);
    }

    if (source.burnMs > 0) {
      enemy.burnUntil = Math.max(enemy.burnUntil, this.time.now + source.burnMs);
      enemy.burnDps = Math.max(enemy.burnDps, source.burnDps ?? 0);
    }

    if (enemy.hp <= 0) {
      this.destroyEnemy(enemy, true);
    }
  }

  enemyEscaped(enemy) {
    this.destroyEnemy(enemy, false);
    this.lives -= enemy.isHeavy ? 2 : 1;
    this.cameras.main.shake(160, 0.006);

    if (this.lives <= 0) {
      this.finishGame();
      return;
    }

    this.updateUi();
  }

  destroyEnemy(enemy, rewarded) {
    if (!enemy.alive) {
      return;
    }

    enemy.alive = false;
    this.enemies = this.enemies.filter((item) => item !== enemy);
    enemy.sprite.destroy();
    enemy.barBack.destroy();
    enemy.barFill.destroy();

    if (rewarded) {
      this.gold += enemy.reward;
      this.score += enemy.reward * 5;
      this.tryDropLoot(enemy);
      this.updateUi();
    }
  }

  destroyProjectile(projectile) {
    this.projectiles = this.projectiles.filter((item) => item !== projectile);
    projectile.sprite.destroy();
  }

  tryDropLoot(enemy) {
    const rates = {
      normal: 0.02,
      heavy: 0.035,
      rare: this.levelConfig.enemyMix === "rare-mix" ? 0.18 : 0.12,
      elite: this.levelConfig.enemyMix === "rare-mix" ? 0.24 : 0.2,
      boss: 1,
    };

    if (this.levelId === "chapter-1-boss" && enemy.rank === "boss") {
      if (Math.random() < 0.5) {
        const rarity = Math.random() < 0.6 ? "稀有" : "史诗";
        const item = this.createEquipment(pickRandom(BASIC_SHOP_ITEMS), rarity);
        this.inventory.push(item);
        this.showNotice(`Boss 必掉：${item.name} 已进背包`, RARITY_CONFIG[rarity].color);
      } else {
        this.addBlueprintFragment();
        this.showNotice("Boss 必掉：图纸碎片 +1", "#5a4ba6");
      }
      return;
    }

    if (Math.random() > (rates[enemy.rank] ?? 0.02)) {
      return;
    }

    if (enemy.rank === "boss" && this.chooseLockedBlueprint()) {
      const key = this.chooseLockedBlueprint();
      this.unlockBlueprint(key);
      this.showNotice(`Boss 掉落图纸：${TOWER_TYPES[key].name}`, "#5a4ba6");
      return;
    }

    const rarity = enemy.rank === "boss" ? "传说" : enemy.rank === "elite" ? "史诗" : enemy.rank === "rare" ? "稀有" : "普通";
    const item = this.createEquipment(pickRandom(BASIC_SHOP_ITEMS), rarity);
    this.inventory.push(item);
    this.showNotice(`敌人掉落：${item.name} 已进背包`, RARITY_CONFIG[rarity].color);
  }

  checkWaveComplete() {
    if (!this.waveActive || this.spawnedThisWave < this.enemiesThisWave || this.enemies.length > 0) {
      return;
    }

    const bonus = 24 + this.wave * 5;
    this.waveActive = false;
    this.defeatedWaves = Math.max(this.defeatedWaves, this.wave);
    this.gold += bonus;
    this.bestWave = Math.max(this.bestWave, this.wave);
    localStorage.setItem("crown-outpost-best-wave", String(this.bestWave));
    this.recoverHeroes(0.38);

    if (this.wave >= this.totalWaves) {
      this.finishVictorySequence();
      return;
    }

    this.showNotice(`守住第 ${this.wave} 波 +${bonus}`, "#315c22");
    this.startPrepPhase(30);
  }

  upgradeSelectedTower() {
    const tower = this.selectedTower;

    if (!tower) {
      return;
    }

    if (this.canChooseTowerBranch(tower)) {
      this.openTowerBranchModal(tower);
      return;
    }

    if (tower.level >= this.getTowerMaxLevel(tower)) {
      return;
    }

    const cost = this.getUpgradeCost(tower);

    if (this.gold < cost) {
      this.showNotice("金币不足", "#9c2b24");
      this.cameras.main.shake(120, 0.004);
      return;
    }

    this.gold -= cost;
    tower.level += 1;
    tower.totalCost += cost;
    Object.assign(tower, this.getTowerStats(tower.typeKey, tower.level, tower.branch));
    this.applyTowerVisual(tower);
    this.selectTower(tower);
    this.showNotice(`${this.getTowerDisplayName(tower)} Lv.${tower.level}`, "#7a3d12");
    this.updateUi();
  }

  openTowerBranchModal(tower) {
    const type = TOWER_TYPES[tower.typeKey];
    this.createModalBase(`${type.name}四级分支`, "选择一条升级路线。");
    const branches = Object.entries(type.branches ?? {});

    branches.forEach(([key, branch], index) => {
      const x = 310 + index * 300;
      this.addModalText(x - 105, 190, `${branch.name}\n${branch.description}\n升级费用 ${this.getUpgradeCost(tower)}`, 15, "#3a2816", 220);
      const button = this.createButton(x, 292, 180, 38, `选择${branch.name}`, () => this.applyTowerBranch(tower, key), {
        fill: index === 0 ? 0xd95f32 : 0x6f8dbd,
        stroke: 0x70451f,
        color: "#fff6d8",
        hoverFill: index === 0 ? 0xec7448 : 0x84a7dc,
      }).setDepth(93);
      this.modalObjects.push(button);
      this.setButtonEnabled(button, this.gold >= this.getUpgradeCost(tower));
    });

    const close = this.createButton(GAME_WIDTH / 2, 392, 150, 36, "稍后再说", () => this.closeModal(), {
      fill: 0xe7c980,
      stroke: 0x8a5a26,
    }).setDepth(93);
    this.modalObjects.push(close);
  }

  applyTowerBranch(tower, branchKey) {
    const cost = this.getUpgradeCost(tower);

    if (this.gold < cost) {
      this.showNotice("金币不足", "#9c2b24");
      return;
    }

    this.gold -= cost;
    tower.level = 4;
    tower.branch = branchKey;
    tower.totalCost += cost;
    Object.assign(tower, this.getTowerStats(tower.typeKey, 4, branchKey));
    this.applyTowerVisual(tower);
    this.closeModal();
    this.selectTower(tower);
    this.showNotice(`升级为 ${this.getTowerDisplayName(tower)}`, "#7a3d12");
    this.updateUi();
  }
  applyTowerVisual(tower) {
    tower.levelText.setText(["I", "II", "III", "IV"][tower.level - 1]);
    const displaySize = TOWER_DISPLAY_SIZE_BY_LEVEL[tower.level - 1] ?? TOWER_DISPLAY_SIZE_BY_LEVEL.at(-1);
    const textureKey = this.getTowerTextureKey(tower.typeKey, tower.level, tower.branch);
    if (tower.textureKey !== textureKey) {
      tower.sprite.setTexture(textureKey);
      tower.textureKey = textureKey;
    }
    tower.sprite.setDisplaySize(displaySize, displaySize);
    tower.sprite.clearTint();
  }

  sellSelectedTower() {
    const tower = this.selectedTower;

    if (!tower) {
      return;
    }

    const refund = Math.floor(tower.totalCost * 0.55);
    tower.slot.tower = null;
    tower.slot.platform.setAlpha(1);
    tower.slot.inner.setAlpha(1);
    tower.slot.rim.setAlpha(1);
    tower.shadow.destroy();
    tower.sprite.destroy();
    tower.levelText.destroy();
    tower.guards.forEach((guard) => guard.sprite.destroy());
    this.towers = this.towers.filter((item) => item !== tower);
    this.selectedTower = null;
    this.clearSelectedRange();
    this.gold += refund;
    this.showNotice(`回收 +${refund}`, "#315c22");
    this.updateUi();
  }

  getTowerMaxLevel(tower) {
    return TOWER_TYPES[tower.typeKey].branches ? 4 : 3;
  }

  getUpgradeCost(tower) {
    if (this.canChooseTowerBranch(tower)) {
      return 120;
    }

    return Math.round(TOWER_TYPES[tower.typeKey].price * (0.8 + tower.level * 0.58));
  }

  getTowerDisplayName(tower) {
    if (tower.branch) {
      return TOWER_TYPES[tower.typeKey].branches?.[tower.branch]?.name ?? TOWER_TYPES[tower.typeKey].name;
    }

    return TOWER_TYPES[tower.typeKey].name;
  }

  canChooseTowerBranch(tower) {
    return Boolean(TOWER_TYPES[tower.typeKey].branches) && tower.level === 3 && !tower.branch;
  }

  isTowerUnlocked(key) {
    const type = TOWER_TYPES[key];
    return !type.blueprintKey || this.unlockedBlueprints.has(key);
  }

  createEquipment(id, rarity = "普通") {
    const base = EQUIPMENT_CATALOG[id];
    const rarityConfig = RARITY_CONFIG[rarity];
    const multiplier = rarityConfig.multiplier;
    const suffix = rarity === "普通" ? "" : `·${rarity}`;

    return {
      uid: `${id}-${rarity}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      catalogId: id,
      rarity,
      name: `${rarityConfig.prefix}${base.name}${suffix}`,
      baseName: base.name,
      price: Math.max(1, Math.round(base.price * multiplier)),
      slot: base.slot,
      strengthReq: base.strengthReq ?? 0,
      allowedHeroes: base.allowedHeroes ?? null,
      stats: cloneStats(base.stats, multiplier),
      desc: base.desc,
    };
  }

  getSelectedShopHero() {
    return this.heroes.find((hero) => hero.id === this.selectedShopHeroId) ?? this.heroes[0];
  }

  canEquip(hero, item) {
    if (item.strengthReq && hero.strength < item.strengthReq) {
      return false;
    }

    if (item.allowedHeroes && !item.allowedHeroes.includes(hero.id)) {
      return false;
    }

    return true;
  }

  equipHero(hero, item) {
    if (!this.canEquip(hero, item)) {
      this.showNotice(`${hero.name} 无法装备 ${item.name}`, "#9c2b24");
      return false;
    }

    const oldItem = hero.equipment[item.slot];
    if (oldItem) {
      this.inventory.push(oldItem);
    }

    hero.equipment[item.slot] = item;
    this.recalculateHeroStats(hero);
    hero.hp = Math.min(hero.hp + Math.round(hero.stats.maxHp * 0.12), hero.stats.maxHp);
    this.updateHeroSprite(hero);
    this.showNotice(`${hero.name} 装备了 ${item.name}`, RARITY_CONFIG[item.rarity].color);
    return true;
  }

  recalculateAllHeroes() {
    this.heroes.forEach((hero) => this.recalculateHeroStats(hero));
  }

  recalculateHeroStats(hero) {
    const stage = this.getTiezhuBlockStage();
    const stats = {
      maxHp: hero.maxHp,
      damage: hero.damage,
      range: hero.range,
      rate: hero.rate,
      armor: hero.armor ?? 0,
      magicArmor: 0,
      critChance: hero.critChance ?? 0,
      blockChance: hero.id === "tiezhu" ? stage.chance : 0,
      blockReduce: hero.id === "tiezhu" ? stage.reduce : 0,
      regen: 0,
      healPower: hero.healPower ?? 0,
      slowMs: hero.slowMs ?? 0,
      slowFactor: hero.slowFactor ?? 1,
      stunChance: 0,
      ranged: 0,
    };

    Object.values(hero.equipment).filter(Boolean).forEach((item) => {
      Object.entries(item.stats).forEach(([key, value]) => {
        if (key === "attackSpeed") {
          stats.rate *= 1 - value;
        } else if (key === "cooldown") {
          stats.rate *= 1 - value;
        } else if (key === "ranged") {
          stats.ranged = Math.max(stats.ranged, value);
        } else if (key === "blockChance") {
          stats.blockChance += value;
        } else if (key === "blockReduce") {
          stats.blockReduce = Math.max(stats.blockReduce, value);
        } else {
          stats[key] = (stats[key] ?? 0) + value;
        }
      });
    });

    stats.rate = Math.max(260, Math.round(stats.rate));
    stats.maxHp = Math.round(stats.maxHp);
    stats.damage = Math.round(stats.damage);
    stats.range = Math.round(stats.range);
    stats.armor = Math.round(stats.armor);
    stats.blockChance = Phaser.Math.Clamp(stats.blockChance, 0, 0.55);
    stats.blockReduce = Phaser.Math.Clamp(stats.blockReduce, 0, 0.75);
    hero.stats = stats;
    hero.hp = Math.min(hero.hp ?? stats.maxHp, stats.maxHp);
  }

  getTiezhuBlockStage() {
    if (this.wave >= 7) {
      return { chance: 0.25, reduce: 0.5 };
    }

    if (this.wave >= 4) {
      return { chance: 0.2, reduce: 0.45 };
    }

    return { chance: 0.15, reduce: 0.4 };
  }

  updateHeroes(time, delta) {
    const dt = delta / 1000;

    this.heroes.forEach((hero) => {
      if (hero.dead) {
        this.updateHeroRespawn(hero, time);
        return;
      }

      if (hero.stats.regen > 0 && hero.hp < hero.stats.maxHp) {
        hero.hp = Math.min(hero.stats.maxHp, hero.hp + hero.stats.regen * dt);
      }

      const moving = this.updateHeroMovement(hero, dt);
      this.updateHeroSupport(hero, time);
      const target = this.findHeroTarget(hero);

      if (target && time >= hero.nextAttackAt) {
        this.heroAttack(hero, target, time);
      }

      this.updateHeroSprite(hero, time, moving);
    });

    this.updateHeroPortraits(time);
    this.updateEnemyAttacks(time);
  }

  updateHeroRespawn(hero, time) {
    if (hero.respawnAt <= 0 || time < hero.respawnAt) {
      return;
    }

    hero.dead = false;
    hero.respawnAt = 0;
    hero.hp = Math.max(1, Math.round(hero.stats.maxHp * 0.45));
    hero.group?.setAlpha(1);
    this.addFloatingText(hero.x, hero.y - 18, "复活", "#315c22");
    this.updateHeroSprite(hero);
    this.updateHeroSelectionVisuals();
    this.updateUi();
  }

  updateHeroMovement(hero, dt) {
    if (typeof hero.targetX !== "number" || typeof hero.targetY !== "number") {
      hero.targetX = hero.x;
      hero.targetY = hero.y;
    }

    const dx = hero.targetX - hero.x;
    const dy = hero.targetY - hero.y;
    const distance = Math.hypot(dx, dy);
    let moving = false;

    if (distance <= 1) {
      hero.x = hero.targetX;
      hero.y = hero.targetY;
    } else {
      const step = Math.min(distance, HERO_MOVE_SPEED * dt);
      const nextX = hero.x + (dx / distance) * step;
      const nextY = hero.y + (dy / distance) * step;

      if (this.isHeroPointWalkable(nextX, nextY)) {
        hero.x = nextX;
        hero.y = nextY;
        moving = true;
      } else {
        hero.targetX = hero.x;
        hero.targetY = hero.y;
        this.addFloatingText(hero.x, hero.y - 34, "受阻", "#9c2b24");
      }
    }

    if (moving) {
      hero.moveDirection = dx >= 0 ? 1 : -1;
    }

    const closest = this.getClosestPointOnPath(hero.x, hero.y);
    if (closest) {
      hero.pathProgress = closest.progress;
      hero.targetProgress = closest.progress;
    }

    return moving;
  }

  isHeroPointWalkable(x, y) {
    if (x < HERO_COLLISION_RADIUS || x > PANEL_X - HERO_COLLISION_RADIUS) {
      return false;
    }

    if (y < HERO_COLLISION_RADIUS || y > GAME_HEIGHT - HERO_COLLISION_RADIUS) {
      return false;
    }

    return !(this.mapObstacles ?? []).some((obstacle) => (
      Phaser.Math.Distance.Between(x, y, obstacle.x, obstacle.y) < obstacle.radius + HERO_COLLISION_RADIUS
    ));
  }

  updateHeroSupport(hero, time) {
    if (hero.id !== "yueguang" || time < hero.nextHealAt) {
      return;
    }

    const target = this.heroes
      .filter((item) => !item.dead && item.hp < item.stats.maxHp * 0.82)
      .sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0];

    if (!target) {
      return;
    }

    const heal = hero.stats.healPower + Math.round((hero.stats.magic ?? 0) * 0.45);
    target.hp = Math.min(target.stats.maxHp, target.hp + heal);
    this.addFloatingText(target.x, target.y - 34, `+${heal}`, "#3a8f52");
    hero.nextHealAt = time + 2400;
  }

  findHeroTarget(hero) {
    return this.enemies
      .filter((enemy) => enemy.alive && Phaser.Math.Distance.Between(hero.x, hero.y, enemy.sprite.x, enemy.sprite.y) <= hero.stats.range)
      .sort((a, b) => {
        const frontPostPriority = b.progress - a.progress;

        if (frontPostPriority !== 0) {
          return frontPostPriority;
        }

        return Phaser.Math.Distance.Between(hero.x, hero.y, a.sprite.x, a.sprite.y)
          - Phaser.Math.Distance.Between(hero.x, hero.y, b.sprite.x, b.sprite.y);
      })[0];
  }

  heroAttack(hero, target, time) {
    let damage = hero.stats.damage;
    const critical = Math.random() < hero.stats.critChance;

    if (critical) {
      damage = Math.round(damage * 1.75);
    }

    const source = {};

    if (hero.stats.slowMs > 0) {
      source.slowMs = hero.stats.slowMs;
      source.slowFactor = hero.stats.slowFactor;
    }

    if (hero.stats.stunChance > 0 && Math.random() < hero.stats.stunChance) {
      source.stunMs = 420;
      this.addFloatingText(target.sprite.x, target.sprite.y - 36, "眩晕", "#6d2e18");
    }

    this.damageEnemy(target, damage, source);
    this.playHeroAttackAction(hero, target);
    this.addHeroStrike(hero, target, critical);
    hero.attackCount = (hero.attackCount ?? 0) + 1;
    if (hero.attackCount >= HERO_ULTIMATE_ATTACKS) {
      hero.attackCount = 0;
      this.playHeroUltimateAction(hero, target);
    }
    hero.nextAttackAt = time + hero.stats.rate;
  }

  addHeroStrike(hero, target, critical) {
    const line = this.add.line(0, 0, hero.x, hero.y - 4, target.sprite.x, target.sprite.y, critical ? 0xfff1a8 : hero.accent, 0.86)
      .setLineWidth(critical ? 4 : 2)
      .setDepth(24);
    this.heroEffects.push({ object: line, ttl: 110 });
  }

  updateEnemyAttacks(time) {
    this.enemies.forEach((enemy) => {
      if (!enemy.alive || time < enemy.nextAttackAt) {
        return;
      }

      const target = this.heroes
        .filter((hero) => !hero.dead && Phaser.Math.Distance.Between(hero.x, hero.y, enemy.sprite.x, enemy.sprite.y) <= 48)
        .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, enemy.sprite.x, enemy.sprite.y)
          - Phaser.Math.Distance.Between(b.x, b.y, enemy.sprite.x, enemy.sprite.y))[0];

      if (!target) {
        return;
      }

      this.damageHero(target, enemy.attackDamage, enemy);
      enemy.nextAttackAt = time + (enemy.rank === "boss" ? 760 : 1120);
    });
  }

  damageHero(hero, amount) {
    let damage = Math.max(1, amount - hero.stats.armor);
    let blocked = false;

    if (hero.stats.blockChance > 0 && Math.random() < hero.stats.blockChance) {
      damage = Math.max(1, Math.round(damage * (1 - hero.stats.blockReduce)));
      blocked = true;
    }

    if (hero.id === "tiezhu") {
      hero.blockStreak = blocked ? (hero.blockStreak ?? 0) + 1 : 0;
      if (blocked) {
        this.tryClaimTiezhuBlockStreak(hero);
      }
    }

    hero.hp -= damage;
    if (blocked) {
      this.playHeroBlockAction(hero);
    }
    this.addFloatingText(hero.x, hero.y - 38, blocked ? `格挡 -${damage}` : `-${damage}`, blocked ? "#2f4972" : "#9c2b24");

    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.dead = true;
      hero.blockStreak = 0;
      hero.respawnAt = this.time.now + HERO_RESPAWN_MS;
      hero.group.setAlpha(0.42);
      if (this.selectedHero === hero) {
        this.selectedHero = null;
        this.updateHeroSelectionVisuals();
      }
      this.addFloatingText(hero.x, hero.y - 16, "倒下", "#9c2b24");
    }

    this.updateHeroSprite(hero);
    this.updateUi();
  }

  tryClaimTiezhuBlockStreak(hero) {
    const egg = EASTER_EGGS.find((item) => item.id === "tiezhu-block-streak");

    if (!egg || this.claimedEasterEggs.has(egg.id) || hero.blockStreak < egg.threshold) {
      return;
    }

    this.gold += egg.reward;
    this.claimedEasterEggs.add(egg.id);
    this.saveClaimedEasterEggs();
    this.showNotice("彩蛋：铁壁连防 +50 金币", "#315c22");
    hero.blockStreak = 0;
    this.updateUi();
  }

  recoverHeroes(ratio) {
    this.heroes.forEach((hero) => {
      hero.dead = false;
      hero.respawnAt = 0;
      hero.group?.setAlpha(1);
      hero.hp = Math.min(hero.stats.maxHp, Math.max(hero.hp, hero.stats.maxHp * ratio));
      this.updateHeroSprite(hero);
    });
    this.updateHeroSelectionVisuals();
    this.updateHeroPortraits();
  }

  updateHeroSprite(hero, time = this.time?.now ?? 0, moving = false) {
    if (!hero.group) {
      return;
    }

    hero.group.setPosition(hero.x, hero.y);
    hero.sprite?.setTint(hero.dead ? 0x777777 : 0xffffff);
    this.updateHeroActionPose(hero, time, moving);
    hero.hpFill.setDisplaySize(34 * Phaser.Math.Clamp(hero.hp / hero.stats.maxHp, 0, 1), 4);
    hero.nameLabel.setText(`${hero.name}`);
  }

  updateHeroActionPose(hero, time, moving) {
    if (!hero.sprite || hero.dead) {
      return;
    }

    const actionActive = (hero.actionUntil ?? 0) > time;
    const state = actionActive ? hero.actionState : moving ? "move" : "idle";
    const phase = time * 0.012 + (hero.id === "ergou" ? 1.2 : hero.id === "yueguang" ? 2.4 : 0);

    this.setHeroPoseTexture(hero, state);
    hero.sprite.setFlipX((hero.moveDirection ?? 1) < 0);
    hero.sprite.setAlpha(1);
    hero.actionAura?.setAlpha(0);
    hero.actionAura?.setScale(1);
    hero.actionAura?.setStrokeStyle(2, hero.accent, 0);
    hero.shadow?.setScale(1, 1);
    hero.sprite.setX(0);

    if (state === "move") {
      hero.sprite.setAngle(Math.sin(phase) * 5);
      hero.sprite.setY(-8 + Math.abs(Math.sin(phase)) * -3);
      this.setHeroSpritePoseScale(hero, 1 + Math.sin(phase) * 0.025, 1 - Math.sin(phase) * 0.02);
      hero.shadow?.setScale(1.05 - Math.abs(Math.sin(phase)) * 0.12, 1);
      return;
    }

    if (state === "attack") {
      const progress = Phaser.Math.Clamp(1 - (hero.actionUntil - time) / 220, 0, 1);
      const lunge = Math.sin(progress * Math.PI) * 9;
      hero.sprite.setAngle(hero.id === "ergou" ? -14 : 10);
      hero.sprite.setY(-8 - lunge * 0.3);
      hero.sprite.setX((hero.sprite.flipX ? -1 : 1) * lunge);
      this.setHeroSpritePoseScale(hero, 1.08, 0.94);
      return;
    }

    if (state === "block") {
      const progress = Phaser.Math.Clamp(1 - (hero.actionUntil - time) / 300, 0, 1);
      hero.sprite.setAngle(Math.sin(progress * Math.PI) * -8);
      hero.sprite.setY(-6);
      this.setHeroSpritePoseScale(hero, 1.12, 0.86);
      hero.actionAura?.setAlpha(0.5 * (1 - progress));
      hero.actionAura?.setScale(1.2 + progress * 0.65);
      hero.actionAura?.setStrokeStyle(4, hero.accent, 0.72 * (1 - progress));
      return;
    }

    if (state === "ultimate") {
      const progress = Phaser.Math.Clamp(1 - (hero.actionUntil - time) / 680, 0, 1);
      hero.sprite.setAngle(Math.sin(progress * Math.PI * 3) * 8);
      hero.sprite.setY(-11 + Math.sin(progress * Math.PI) * -6);
      this.setHeroSpritePoseScale(hero, 1.2, 1.2);
      hero.actionAura?.setAlpha(0.62 * (1 - progress));
      hero.actionAura?.setScale(1.35 + progress * 1.1);
      hero.actionAura?.setStrokeStyle(5, hero.accent, 0.82 * (1 - progress));
      return;
    }

    hero.sprite.setY(-8 + Math.sin(phase * 0.45) * 1);
    hero.sprite.setAngle(0);
    this.setHeroSpritePoseScale(hero, 1, 1);
  }

  setHeroPoseTexture(hero, state) {
    const pose = state === "ultimate" ? "block" : state;
    const textureKey = HERO_POSES.includes(pose) ? `hero-${hero.id}-${pose}` : `hero-${hero.id}`;

    if (hero.currentTextureKey !== textureKey && this.textures.exists(textureKey)) {
      hero.sprite.setTexture(textureKey);
      hero.currentTextureKey = textureKey;
    }
  }

  setHeroSpritePoseScale(hero, scaleX, scaleY = scaleX) {
    hero.sprite?.setScale(
      (hero.spriteBaseScaleX ?? 1) * scaleX,
      (hero.spriteBaseScaleY ?? 1) * scaleY,
    );
  }

  setHeroAction(hero, state, duration) {
    hero.actionState = state;
    hero.actionUntil = this.time.now + duration;
  }

  playHeroAttackAction(hero, target) {
    hero.moveDirection = target.sprite.x >= hero.x ? 1 : -1;
    this.setHeroAction(hero, "attack", 220);
  }

  playHeroBlockAction(hero) {
    this.setHeroAction(hero, "block", 300);
    const shield = this.add.circle(hero.x, hero.y - 12, 22, hero.accent, 0.14)
      .setStrokeStyle(4, hero.accent, 0.9)
      .setDepth(25);
    this.tweens.add({
      targets: shield,
      alpha: 0,
      scale: 1.75,
      duration: 300,
      onComplete: () => shield.destroy(),
    });
  }

  playHeroUltimateAction(hero, target) {
    this.setHeroAction(hero, "ultimate", 680);
    const color = hero.id === "tiezhu" ? 0x9fb8d6 : hero.id === "ergou" ? 0xffc34f : 0xdcc8ff;
    const burst = this.add.circle(hero.x, hero.y - 12, 16, color, 0.18)
      .setStrokeStyle(5, color, 0.86)
      .setDepth(23);

    this.tweens.add({
      targets: burst,
      alpha: 0,
      scale: hero.id === "yueguang" ? 3.2 : 2.45,
      duration: 620,
      ease: "Sine.easeOut",
      onComplete: () => burst.destroy(),
    });

    if (hero.id === "tiezhu") {
      this.addHeroSlamEffect(hero, color);
    } else if (hero.id === "ergou") {
      this.addHeroBladeEffect(hero, target, color);
    } else {
      this.addHeroMoonEffect(hero, color);
    }
  }

  addHeroSlamEffect(hero, color) {
    [-18, 0, 18].forEach((offset, index) => {
      const spark = this.add.rectangle(hero.x + offset, hero.y + 6, 7, 24, color, 0.8)
        .setDepth(24)
        .setAngle(offset * 0.8);
      this.tweens.add({
        targets: spark,
        y: hero.y - 22,
        alpha: 0,
        duration: 260 + index * 70,
        onComplete: () => spark.destroy(),
      });
    });
  }

  addHeroBladeEffect(hero, target, color) {
    const slash = this.add.line(0, 0, hero.x - 22, hero.y + 8, target.sprite.x + 22, target.sprite.y - 22, color, 0.94)
      .setLineWidth(6)
      .setDepth(24);
    this.heroEffects.push({ object: slash, ttl: 180, initialTtl: 180 });
  }

  addHeroMoonEffect(hero, color) {
    const moon = this.add.arc(hero.x, hero.y - 18, 34, 210, 510, false, color, 0)
      .setStrokeStyle(5, color, 0.88)
      .setDepth(24);
    this.heroEffects.push({ object: moon, ttl: 420, initialTtl: 420 });
  }

  updateHeroPortraits(time = this.time?.now ?? 0) {
    if (!this.heroPortraits) {
      return;
    }

    this.heroPortraits.forEach((portrait) => {
      const hero = portrait.hero;
      const selected = hero === this.selectedHero && !hero.dead;

      portrait.bg.setFillStyle(hero.dead ? 0xd4cec0 : 0xf6e2a9, 0.95);
      portrait.bg.setStrokeStyle(3, selected ? 0xffd15a : 0x7a4b25, 0.95);
      portrait.portraitImage.setTint(hero.dead ? 0x777777 : 0xffffff);
      portrait.portraitImage.setAlpha(hero.dead ? 0.62 : 1);
      portrait.name.setColor(hero.dead ? "#6d665c" : "#2b1c10");

      if (hero.dead) {
        const seconds = Math.max(0, Math.ceil((hero.respawnAt - time) / 1000));
        portrait.hp.setText(`复活 ${seconds}s`).setColor("#6d665c");
      } else {
        portrait.hp.setText(`${Math.ceil(hero.hp)}/${hero.stats.maxHp}`).setColor("#315c22");
      }
    });
  }

  updateHeroEffects(delta) {
    this.heroEffects = this.heroEffects.filter((effect) => {
      effect.ttl -= delta;
      effect.object.setAlpha(Math.max(0, effect.ttl / (effect.initialTtl ?? 110)));
      if (effect.ttl <= 0) {
        effect.object.destroy();
        return false;
      }

      return true;
    });
  }

  addFloatingText(x, y, text, color) {
    const label = this.add.text(x, y, text, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      color,
      fontStyle: "700",
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: label,
      y: y - 18,
      alpha: 0,
      duration: 720,
      onComplete: () => label.destroy(),
    });
  }

  openEquipmentShop() {
    this.createModalBase("装备商店", "选择英雄后购买装备。力量不足或职业不合时不能装备。");
    const hero = this.getSelectedShopHero();

    this.renderHeroPicker(128);
    this.addModalText(164, 156, `当前：${hero.name}  力量 ${hero.strength}\n${this.getHeroEquipmentSummary(hero)}`, 14, "#3a2816", 620);

    BASIC_SHOP_ITEMS.forEach((id, index) => {
      const item = this.createEquipment(id);
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 174 + col * 326;
      const y = 220 + row * 48;
      const canBuy = this.gold >= item.price && this.canEquip(hero, item);
      const req = item.strengthReq ? ` 力量${item.strengthReq}` : "";

      this.addModalText(x, y - 18, `${item.name} ${item.price}金${req}\n${item.desc}`, 13, RARITY_CONFIG[item.rarity].color, 238);
      const button = this.createButton(x + 230, y - 2, 80, 28, "购买", () => {
        this.buyAndEquipShopItem(id);
      }, {
        fill: 0xe7c980,
        stroke: 0x8a5a26,
      }).setDepth(93);
      this.modalObjects.push(button);
      this.setButtonEnabled(button, canBuy);
    });

    this.addModalCloseButton("关闭", () => this.closeModal());
  }

  buyAndEquipShopItem(id) {
    const hero = this.getSelectedShopHero();
    const item = this.createEquipment(id);

    if (this.gold < item.price) {
      this.showNotice("金币不足", "#9c2b24");
      return;
    }

    if (!this.canEquip(hero, item)) {
      this.showNotice(`${hero.name} 无法装备 ${item.name}`, "#9c2b24");
      return;
    }

    this.gold -= item.price;
    this.equipHero(hero, item);
    this.openEquipmentShop();
    this.updateUi();
  }

  openInventory() {
    this.createModalBase("背包", "敌人掉落的装备会放在这里。选择英雄后点击装备。");
    const hero = this.getSelectedShopHero();

    this.renderHeroPicker(128);
    this.addModalText(164, 156, `当前：${hero.name}  力量 ${hero.strength}\n${this.getHeroEquipmentSummary(hero)}`, 14, "#3a2816", 620);

    if (this.inventory.length === 0) {
      this.addModalText(350, 256, "背包是空的。打稀有敌人、精英敌人或 Boss 可以掉装备。", 16, "#70451f", 310);
    } else {
      this.inventory.slice(0, 8).forEach((item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = 174 + col * 326;
        const y = 224 + row * 56;
        const canEquip = this.canEquip(hero, item);

        this.addModalText(x, y - 20, `${item.name}\n${item.desc}${item.strengthReq ? ` 力量${item.strengthReq}` : ""}`, 13, RARITY_CONFIG[item.rarity].color, 238);
        const button = this.createButton(x + 230, y - 2, 80, 28, "装备", () => this.equipInventoryItem(item.uid), {
          fill: 0x8fb76b,
          stroke: 0x4c7135,
          color: "#183111",
          hoverFill: 0xa0c77e,
        }).setDepth(93);
        this.modalObjects.push(button);
        this.setButtonEnabled(button, canEquip);
      });
    }

    this.addModalCloseButton("关闭", () => this.closeModal());
  }

  equipInventoryItem(uid) {
    const hero = this.getSelectedShopHero();
    const index = this.inventory.findIndex((item) => item.uid === uid);

    if (index === -1) {
      return;
    }

    const [item] = this.inventory.splice(index, 1);
    if (!this.equipHero(hero, item)) {
      this.inventory.splice(index, 0, item);
    }

    this.openInventory();
    this.updateUi();
  }

  renderHeroPicker(y) {
    this.heroes.forEach((hero, index) => {
      const selected = hero.id === this.selectedShopHeroId;
      const button = this.createButton(260 + index * 170, y, 136, 32, hero.name, () => {
        this.selectedShopHeroId = hero.id;
        if (this.modalKind === "inventory") {
          this.openInventory();
        } else {
          this.openEquipmentShop();
        }
      }, {
        fill: selected ? 0xf5b83c : 0xe7c980,
        stroke: selected ? 0xc64c35 : 0x8a5a26,
      }).setDepth(93);
      button.selected = selected;
      this.modalObjects.push(button);
    });
  }

  getHeroEquipmentSummary(hero) {
    const slotNames = { weapon: "武器", armor: "防具", offhand: "副手" };
    return Object.entries(slotNames)
      .map(([slot, label]) => `${label}:${hero.equipment[slot]?.name ?? "无"}`)
      .join("  ");
  }

  openMerchant(kind, finalAfterClose) {
    this.currentMerchant = {
      kind,
      finalAfterClose,
      limit: kind === "elite" ? 2 : 99,
      purchases: 0,
      goods: kind === "elite" ? this.generateEliteGoods() : this.generateWildGoods(),
    };
    this.renderMerchant();
  }

  generateWildGoods() {
    const goods = [
      { kind: "heal", name: "行军药包", price: 22, desc: "所有英雄恢复 45% 生命" },
      { kind: "lives", name: "修补城门", price: 28, desc: "生命 +4" },
      { kind: "equipment", item: this.createEquipment(pickRandom(BASIC_SHOP_ITEMS), "稀有"), price: 34, desc: "随机稀有装备" },
    ];

    const blueprint = Math.random() < 0.25 ? this.chooseLockedBlueprint() : null;
    if (blueprint) {
      goods.push({ kind: "blueprint", towerKey: blueprint, name: `${TOWER_TYPES[blueprint].name}图纸`, price: 62, desc: "永久解锁特殊塔" });
    } else {
      goods.push({ kind: "fragment", name: "特殊塔图纸碎片", price: 26, desc: "集齐 3 个自动解锁一张图纸" });
    }

    goods.push({ kind: "equipment", item: this.createEquipment(pickRandom(BASIC_SHOP_ITEMS), Math.random() < 0.35 ? "史诗" : "稀有"), price: 48, desc: "野外带来的好货" });
    return goods;
  }

  generateEliteGoods() {
    const goods = [];
    const blueprint = this.chooseLockedBlueprint();

    if (blueprint) {
      goods.push({ kind: "blueprint", towerKey: blueprint, name: `${TOWER_TYPES[blueprint].name}图纸`, price: 70, desc: "章末必出特殊塔图纸" });
    } else {
      goods.push({ kind: "fragment", name: "图纸大师补偿", price: 0, desc: "所有特殊塔已解锁，获得 80 金币" });
    }

    ["hammer", "bow", "staff", "iron", "shield"].slice(0, 4).forEach((id) => {
      const item = this.createEquipment(id, "传说");
      goods.push({ kind: "equipment", item, price: Math.max(65, item.price * 3), desc: "传说级装备武器" });
    });

    return goods;
  }

  renderMerchant() {
    const merchant = this.currentMerchant;
    const title = merchant.kind === "elite" ? "精英商人" : "野生商人";
    const subtitle = merchant.kind === "elite"
      ? `章节最后出现。只能购买 2 个商品，必定有特殊塔图纸。已买 ${merchant.purchases}/${merchant.limit}`
      : "每三关出现。可能出售特殊塔图纸、稀有装备和补给。";

    this.createModalBase(title, subtitle);
    merchant.goods.forEach((good, index) => {
      const y = 150 + index * 54;
      const name = good.item ? good.item.name : good.name;
      const price = good.price ?? good.item?.price ?? 0;
      const bought = good.bought;
      const limited = merchant.purchases >= merchant.limit;

      this.addModalText(168, y - 18, `${name}  ${price}金\n${good.desc}`, 14, good.item ? RARITY_CONFIG[good.item.rarity].color : "#3a2816", 460);
      const button = this.createButton(706, y, 120, 30, bought ? "已购买" : "购买", () => this.buyMerchantGood(index), {
        fill: merchant.kind === "elite" ? 0xf5b83c : 0xe7c980,
        stroke: 0x8a5a26,
      }).setDepth(93);
      this.modalObjects.push(button);
      this.setButtonEnabled(button, !bought && !limited && this.gold >= price);
    });

    this.addModalCloseButton(merchant.finalAfterClose ? "结束章节" : "离开", () => {
      const final = merchant.finalAfterClose;
      this.closeModal();
      if (final) {
        this.finishVictory();
      } else {
        if (this.pendingCampaignReturn) {
          this.finishVictory();
        } else {
          this.startPrepPhase(30);
        }
      }
    });
  }

  buyMerchantGood(index) {
    const merchant = this.currentMerchant;
    const good = merchant.goods[index];
    const price = good.price ?? good.item?.price ?? 0;

    if (good.bought || merchant.purchases >= merchant.limit || this.gold < price) {
      return;
    }

    this.gold -= price;
    good.bought = true;
    merchant.purchases += 1;

    if (good.kind === "equipment") {
      this.inventory.push(good.item);
      this.showNotice(`${good.item.name} 已进背包`, RARITY_CONFIG[good.item.rarity].color);
    } else if (good.kind === "blueprint") {
      this.unlockBlueprint(good.towerKey);
    } else if (good.kind === "fragment") {
      if (this.chooseLockedBlueprint()) {
        this.addBlueprintFragment();
      } else {
        this.gold += 80;
        this.showNotice("特殊塔已全解锁：金币 +80", "#315c22");
      }
    } else if (good.kind === "heal") {
      this.recoverHeroes(0.45);
      this.showNotice("所有英雄恢复生命", "#315c22");
    } else if (good.kind === "lives") {
      this.lives += 4;
      this.showNotice("城门生命 +4", "#315c22");
    }

    this.renderMerchant();
    this.updateUi();
  }

  chooseLockedBlueprint() {
    const locked = SPECIAL_TOWER_KEYS.filter((key) => !this.unlockedBlueprints.has(key));
    return locked.length ? pickRandom(locked) : null;
  }

  unlockBlueprint(key) {
    if (!key || this.unlockedBlueprints.has(key)) {
      return;
    }

    this.unlockedBlueprints.add(key);
    this.showNotice(`解锁特殊塔：${TOWER_TYPES[key].name}`, "#5a4ba6");
    this.updateUi();
  }

  addBlueprintFragment() {
    this.blueprintFragments += 1;

    if (this.blueprintFragments >= 3) {
      const key = this.chooseLockedBlueprint();
      this.blueprintFragments = 0;
      if (key) {
        this.unlockBlueprint(key);
      } else {
        this.gold += 60;
        this.showNotice("图纸已全解锁：金币 +60", "#315c22");
      }
    }
  }

  createModalBase(title, subtitle) {
    this.closeModal(true);
    this.modalOpen = true;
    this.modalKind = title === "背包" ? "inventory" : title === "装备商店" ? "shop" : "modal";
    const addObject = (object) => {
      this.modalObjects.push(object);
      return object;
    };

    addObject(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x20150d, 0.58)
      .setDepth(88)
      .setInteractive());
    addObject(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 456, 0xf6e2a9, 1)
      .setStrokeStyle(4, 0x7a4b25, 1)
      .setDepth(89));
    addObject(this.add.text(146, 62, title, {
      ...TEXT_STYLE,
      fontSize: "28px",
      color: "#4a2d17",
    }).setDepth(90));
    addObject(this.add.text(148, 100, subtitle, {
      ...TEXT_STYLE,
      fontSize: "15px",
      color: "#70451f",
      wordWrap: { width: 650, useAdvancedWrap: true },
    }).setDepth(90));
  }

  addModalText(x, y, text, size, color, width) {
    const label = this.add.text(x, y, text, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: `${size}px`,
      color,
      lineSpacing: 4,
      wordWrap: { width, useAdvancedWrap: true },
    }).setDepth(92);
    this.modalObjects.push(label);
    return label;
  }

  addModalCloseButton(label, onClick) {
    const button = this.createButton(GAME_WIDTH / 2, 470, 154, 36, label, onClick, {
      fill: 0x8fb76b,
      stroke: 0x4c7135,
      color: "#183111",
      hoverFill: 0xa0c77e,
    }).setDepth(93);
    this.modalObjects.push(button);
  }

  closeModal(silent = false) {
    this.modalObjects.forEach((object) => object.destroy());
    this.modalObjects = [];
    this.modalOpen = false;
    this.modalKind = null;
    if (!silent) {
      this.updateUi?.();
    }
  }

  finishGame() {
    this.gameEnded = true;
    this.waveActive = false;
    this.bestWave = Math.max(this.bestWave, this.wave);
    localStorage.setItem("crown-outpost-best-wave", String(this.bestWave));
    this.endOverlay.setVisible(true);
    this.centerText.setText(`前哨失守\n坚持到第 ${this.wave} 波\n得分 ${this.score}`);
    this.centerText.setVisible(true);
    this.restartButton.setVisible(true);
    this.updateUi();
  }

  finishVictory() {
    this.gameEnded = true;
    this.bestWave = this.totalWaves;
    localStorage.setItem("crown-outpost-best-wave", String(this.bestWave));
    localStorage.setItem("crown-outpost-last-score", String(this.score));
    localStorage.setItem(getLevelCompleteKey(this.levelId), "true");
    this.waveActive = false;
    this.showNotice(`${this.levelConfig.name} 完成，返回章节地图`, "#315c22");
    this.updateUi();
    this.returnToCampaign();
  }

  finishVictorySequence() {
    if (this.levelId === "chapter-1-boss") {
      this.openMerchant("elite", true);
      return;
    }

    if (isWildMerchantLevel(this.levelId)) {
      this.pendingCampaignReturn = true;
      this.openMerchant("wild", false);
      return;
    }

    this.finishVictory();
  }

  returnToCampaign() {
    this.pendingCampaignReturn = false;
    this.cameras.main.fadeOut(420, 32, 21, 13);
    this.time.delayedCall(440, () => {
      this.scene.start("CampaignScene", {
        completedLevelId: this.levelId,
        gold: this.gold,
        score: this.score,
      });
    });
  }

  showNotice(message, color) {
    this.tweens.killTweensOf(this.noticeText);
    this.noticeText.setText(message).setColor(color).setAlpha(1);
    this.tweens.add({
      targets: this.noticeText,
      alpha: 0,
      delay: 950,
      duration: 450,
    });
  }

  updateUi() {
    if (!this.hudText) {
      return;
    }

    const remainingEnemies = this.getRemainingEnemiesInWave();
    const waveLabel = this.wave > 0 ? `${this.wave}/${this.totalWaves}` : `0/${this.totalWaves}`;
    const heroHp = this.heroes.map((hero) => `${hero.name.slice(1)} ${Math.ceil(hero.hp)}/${hero.stats.maxHp}`).join("  ");
    this.hudText.setText(
      `金币 ${this.gold}  生命 ${Math.max(this.lives, 0)}  第 ${waveLabel} 波  敌人 ${remainingEnemies}  背包 ${this.inventory.length}  碎片 ${this.blueprintFragments}/3  得分 ${this.score}\n${heroHp}`,
    );

    if (this.wave >= this.totalWaves && !this.waveActive) {
      this.setButtonLabel(this.startButton, "波次已完成");
    } else if (this.prepPhase) {
      this.setButtonLabel(this.startButton, `立即开始 +${Math.floor(this.prepCountdown)}`);
    } else {
      this.setButtonLabel(this.startButton, this.waveActive ? `第 ${this.wave}/${this.totalWaves} 波中` : `开始第 ${this.wave + 1}/${this.totalWaves} 波`);
    }

    this.setButtonLabel(this.pauseButton, this.paused ? "继续" : "暂停");
    this.setButtonEnabled(this.pauseButton, !this.gameEnded && !this.modalOpen);
    this.setButtonEnabled(this.startButton, (this.prepPhase || (!this.waveActive && this.wave < this.totalWaves)) && !this.gameEnded && !this.modalOpen && !this.paused);
    this.setButtonLabel(this.inventoryButton, `背包 ${this.inventory.length}`);
    this.updateHeroPortraits();
    this.updateTowerButtons();
    this.updateSelectionPanel();
  }

  getRemainingEnemiesInWave() {
    if (!this.waveActive) {
      return 0;
    }

    return this.enemies.length + Math.max(this.enemiesThisWave - this.spawnedThisWave, 0);
  }

  updateTowerButtons() {
    this.towerButtons.forEach(({ key, button, icon }) => {
      const selected = key === this.getPendingBuildType() && !this.selectedTower;
      const unlocked = this.isTowerUnlocked(key);
      const tower = TOWER_TYPES[key];
      button.selected = selected;
      button.bg.setStrokeStyle(3, selected ? 0xc64c35 : 0x8a5a26, 1);
      button.bg.setFillStyle(selected ? 0xf5b83c : button.defaultFill, 1);
      this.setButtonLabel(button, unlocked ? `${tower.name} ${tower.price}` : `${tower.name} 图纸`);
      this.setButtonEnabled(button, unlocked && !this.gameEnded && !this.paused);
      icon.setAlpha(unlocked ? 1 : 0.38);
    });
  }

  updateSelectionPanel() {
    if (!this.selectedTower) {
      const typeKey = this.getPendingBuildType();
      const type = TOWER_TYPES[typeKey];
      const unlocked = this.isTowerUnlocked(typeKey);
      const previewStats = this.getTowerStats(typeKey, 1, null);
      const statLine = typeKey === "altar"
        ? `伤害加成 +${Math.round(previewStats.damageBuff * 100)}%\n攻速加成 +${Math.round(previewStats.rateBuff * 100)}%`
        : `伤害 ${previewStats.damage}\n射程 ${previewStats.range}\n攻速 ${(1000 / previewStats.rate).toFixed(1)}/秒`;
      this.selectionText.setText(
        `${type.name}\n${unlocked ? type.description : "需要特殊塔图纸"}\n花费 ${type.price}\n${statLine}`,
      );
      this.upgradeButton.setVisible(false);
      this.sellButton.setVisible(false);
      return;
    }

    const tower = this.selectedTower;
    const upgradeCost = this.getUpgradeCost(tower);
    const atMax = tower.level >= this.getTowerMaxLevel(tower);
    const branchReady = this.canChooseTowerBranch(tower);

    const towerType = TOWER_TYPES[tower.typeKey];
    const towerDescription = tower.branch ? towerType.branches?.[tower.branch]?.description : towerType.description;
    const towerStatLine = tower.typeKey === "altar"
      ? `伤害加成 +${Math.round((tower.damageBuff ?? 0) * 100)}%\n攻速加成 +${Math.round((tower.rateBuff ?? 0) * 100)}%`
      : `伤害 ${tower.damage}\n射程 ${tower.range}\n攻速 ${(1000 / tower.rate).toFixed(1)}/秒`;
    this.selectionText.setText(
      `${this.getTowerDisplayName(tower)} Lv.${tower.level}\n${towerDescription}\n${towerStatLine}`,
    );
    this.upgradeButton.setVisible(true);
    this.sellButton.setVisible(true);
    this.setButtonLabel(this.upgradeButton, atMax ? "已满级" : branchReady ? `四级分支 ${upgradeCost}` : `升级 ${upgradeCost}`);
    this.setButtonLabel(this.sellButton, `出售 +${Math.floor(tower.totalCost * 0.55)}`);
    this.setButtonEnabled(this.upgradeButton, !atMax);
    this.setButtonEnabled(this.sellButton, true);
  }
}
