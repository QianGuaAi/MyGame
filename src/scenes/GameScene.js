import Phaser from "phaser";
import { CHAPTERS, getChapterByLevelId } from "../data/chapters.js";
import { STORAGE_KEYS } from "../utils/storage.js";
import { EASTER_EGGS } from "../data/easterEggs.js";
import { ENEMY_SHEETS } from "../data/monsters.js";
import { WaveSystem } from "../systems/WaveSystem.js";
import { EnemySystem } from "../systems/EnemySystem.js";
import { ProjectileSystem } from "../systems/ProjectileSystem.js";
import { TowerSystem } from "../systems/TowerSystem.js";
import { HeroSystem } from "../systems/HeroSystem.js";
import { HudSystem } from "../systems/HudSystem.js";
import { EconomySystem } from "../systems/EconomySystem.js";
import { MapSystem } from "../systems/MapSystem.js";
import { BASIC_SHOP_ITEMS, EQUIPMENT_CATALOG, RARITY_CONFIG } from "../data/equipment.js";
import { HERO_DEFS } from "../data/heroes.js";
import { DEFAULT_LEVEL_ID, LEVELS, getLevelCompleteKey, isChapterFinalLevel, isWildMerchantLevel } from "../data/levels.js";
import {
  CHAPTER_LAYOUT,
  GAME_HEIGHT,
  GAME_WIDTH,
  PANEL_X,
  TEXT_STYLE,
  TOTAL_WAVES,
  buildPathSegments,
  getChapterPathLength,
  getChapterPathSegments,
} from "../data/map.js";
import { SPECIAL_TOWER_KEYS, TOWER_BUTTON_ORDER, TOWER_TYPES } from "../data/towers.js";
import { createGameTextures } from "../render/textures.js";
import { loadAllNewAssets } from "../data/assetManifest.js";
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
  frost: {
    l1: new URL("../assets/towers/frost-l1.png", import.meta.url).href,
    l2: new URL("../assets/towers/frost-l2.png", import.meta.url).href,
    l3: new URL("../assets/towers/frost-l3.png", import.meta.url).href,
    attack: new URL("../assets/towers/frost-attack.png", import.meta.url).href,
    branches: {
      storm: new URL("../assets/towers/frost-branch-storm.png", import.meta.url).href,
      crystal: new URL("../assets/towers/frost-branch-crystal.png", import.meta.url).href,
    },
  },
  altar: {
    l1: new URL("../assets/towers/altar-l1.png", import.meta.url).href,
    l2: new URL("../assets/towers/altar-l2.png", import.meta.url).href,
    l3: new URL("../assets/towers/altar-l3.png", import.meta.url).href,
    attack: new URL("../assets/towers/altar-attack.png", import.meta.url).href,
    branches: {
      swift: new URL("../assets/towers/altar-branch-swift.png", import.meta.url).href,
      force: new URL("../assets/towers/altar-branch-force.png", import.meta.url).href,
      balance: new URL("../assets/towers/altar-branch-balance.png", import.meta.url).href,
    },
  },
};
const HERO_ACTION_FRAME_COUNTS = {
  tiezhu: {
    walk: 5,
    run: 5,
    attack: 4,
    cast: 4,
    ultimate: 3,
    defeated: 4,
  },
  ergou: {
    walk: 4,
    run: 4,
    attack: 4,
    cast: 4,
    ultimate: 3,
    defeated: 4,
  },
  yueguang: {
    walk: 4,
    run: 4,
    attack: 4,
    cast: 4,
    ultimate: 3,
    defeated: 4,
  },
};
const HERO_TEXTURE_SIZE = 46;
const HERO_ACTION_FRAME_MS = 120;
const HERO_RUN_SPEED_THRESHOLD = 105;

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  init(data = {}) {
    // 子系统在 init 阶段就要建好：后面 init/preload 会调用它们的方法。
    this.waveSystem = new WaveSystem(this);
    this.enemySystem = new EnemySystem(this);
    this.projectileSystem = new ProjectileSystem(this);
    this.towerSystem = new TowerSystem(this);
    this.heroSystem = new HeroSystem(this);
    this.hudSystem = new HudSystem(this);
    this.economySystem = new EconomySystem(this);
    this.mapSystem = new MapSystem(this);

    this.levelId = data?.levelId ?? DEFAULT_LEVEL_ID;
    this.levelConfig = LEVELS[this.levelId] ?? LEVELS[DEFAULT_LEVEL_ID];
    this.chapter = getChapterByLevelId(this.levelId);
    this.chapterIndex = data?.chapterIndex ?? Math.max(0, (this.chapter?.id ?? 1) - 1);
    if (!CHAPTER_LAYOUT[this.chapterIndex]) {
      this.chapterIndex = 0;
    }
    this.layout = CHAPTER_LAYOUT[this.chapterIndex];
    this.pathPoints = this.layout.pathPoints;
    this.pathSegments = getChapterPathSegments(this.chapterIndex);
    this.pathLength = getChapterPathLength(this.chapterIndex);
    this.spawnLanes = this.mapSystem.buildSpawnLanes(this.layout);
    this.spawnLaneCursor = 0;
    this.totalWaves = this.levelConfig.waveCount ?? TOTAL_WAVES;
    this.gold = 160;
    this.lives = 20;
    this.wave = 0;
    this.score = 0;
    this.bestWave = Number(localStorage.getItem(STORAGE_KEYS.bestWave) || 0);
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
    this.spawnPlan = [];
    this.waveStartedAt = 0;
    this.rallySettingTower = null;
    this.rallyMarker = null;
    this.buildMenu = null;
    this.useSlotBuildMenu = true;
    this.claimedEasterEggs = this.mapSystem.loadClaimedEasterEggs();
    this.heroSystem.createHeroState();
  }

  preload() {
    this.load.on("loaderror", () => {});
    this.loadHeroAssets();
    this.loadChapterMaps();
    this.loadEnemySheets();
    loadAllNewAssets(this);
    this.load.image("tower-codex-barracks", "assets/towers/barracks_codex.png");
    this.load.image("tower-codex-flame", "assets/towers/flame_codex.png");
    this.load.image("tower-codex-treasure", "assets/towers/treasure_codex.png");
    this.load.image("tower-codex-mage", "assets/towers/mage_codex.png");
    this.load.image("tower-codex-mortar", "assets/towers/mortar_codex.png");
    this.load.image("enemy-codex", "assets/enemies/enemy_codex.png");
    this.load.image("enemy-elite-codex", "assets/enemies/elite/elite_codex.png");
    this.load.image("ch1-map", "assets/maps/ch1_map.png");
    this.load.image("ch2-map", "assets/maps/ch2_map.png");
    this.load.image("ch3-map", "assets/maps/ch3_map.png");
    this.load.image("ch4-map", "assets/maps/ch4_map.png");
    this.load.image("ch5-map", "assets/maps/ch5_map.png");
    this.load.image("boss-wraith-sheet", "assets/bosses/boss_wraith_sheet.png");
    this.load.image("boss-warlock-sheet", "assets/bosses/boss_warlock_sheet.png");
    this.load.image("boss-wraith", "assets/bosses/boss_wraith.png");
    this.load.image("boss-warlock", "assets/bosses/boss_warlock.png");
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
    this.mapSystem.createMap();
    this.mapSystem.createEasterEggs();
    this.mapSystem.createSlots();
    this.heroSystem.createHeroes();
    this.hudSystem.createUi();
    this.heroSystem.createHeroCommandInput();
    this.hudSystem.updateUi();
    this.waveSystem.startPrepPhase(60);
    this.input.keyboard.on("keydown-D", () => this.enableMapCalibrationMode());
  }

  update(time, delta) {
    if (this.gameEnded || this.modalOpen || this.paused) {
      return;
    }

    if (this.prepPhase) {
      this.prepCountdown -= delta / 1000;
      this.waveSystem.updatePrepDisplay();
      if (this.prepCountdown <= 0) {
        this.waveSystem.endPrepPhase(false);
        return;
      }
    }

    this.waveSystem.updateSpawning(time);
    this.enemySystem.updateEnemies(time, delta);
    this.towerSystem.updateTowers(time);
    this.projectileSystem.updateProjectiles(delta);
    this.heroSystem.updateHeroes(time, delta);
    this.heroSystem.updateHeroEffects(delta);
    this.towerSystem.drawSelectedRallyMarker();
    this.waveSystem.checkWaveComplete();
  }



  createTextures() {
    createGameTextures(this);
  }

  loadHeroAssets() {
    this.load.image("hero-tiezhu", new URL("../assets/heroes/tiezhu.png", import.meta.url).href);
    this.load.image("hero-ergou", new URL("../assets/heroes/ergou.png", import.meta.url).href);
    this.load.image("hero-yueguang", new URL("../assets/heroes/yueguang.png", import.meta.url).href);
    Object.entries(HERO_ACTION_FRAME_COUNTS).forEach(([heroId, actions]) => {
      Object.entries(actions).forEach(([action, frameCount]) => {
        for (let index = 1; index <= frameCount; index += 1) {
          const frame = String(index).padStart(2, "0");
          this.load.image(
            `hero-${heroId}-${action}-${frame}`,
            new URL(`../assets/heroes/action-sheets/${heroId}-${action}-${frame}.png`, import.meta.url).href,
          );
        }
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


  enableMapCalibrationMode() {
    if (this.calibrationEnabled) return;
    this.calibrationEnabled = true;
    this.input.on("pointerdown", (p) => {
      const x = Math.round(p.worldX);
      const y = Math.round(p.worldY);
      console.log(`[map] ch${this.chapterIndex + 1} click: [${x}, ${y}]`);
    });
    this.hudSystem.showNotice("已开启地图标定模式：点击空白记录坐标", "#2f4972");
  }
}

