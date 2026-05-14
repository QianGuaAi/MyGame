import Phaser from "phaser";
import { HERO_DEFS } from "../data/heroes.js";
import { EASTER_EGGS } from "../data/easterEggs.js";
import { GAME_HEIGHT, GAME_WIDTH, TEXT_STYLE } from "../data/map.js";

const HERO_OUTPOST_OFFSET = 24;
const HERO_OUTPOST_SPACING = 34;
const HERO_MOVE_SPEED = 150;
const HERO_RESPAWN_MS = 8000;
const HERO_ULTIMATE_ATTACKS = 5;
const HERO_COLLISION_RADIUS = 18;
const HERO_TEXTURE_SIZE = 46;
const HERO_ACTION_FRAME_MS = 120;
const HERO_RUN_SPEED_THRESHOLD = 105;
const HERO_ACTION_FRAME_COUNTS = {
  tiezhu:   { walk: 5, run: 5, attack: 4, cast: 4, ultimate: 3, defeated: 4 },
  ergou:    { walk: 4, run: 4, attack: 4, cast: 4, ultimate: 3, defeated: 4 },
  yueguang: { walk: 4, run: 4, attack: 4, cast: 4, ultimate: 3, defeated: 4 },
};

/**
 * 英雄系统：状态构建、移动、攻击、技能动作、肖像 HUD、敌人对英雄的攻击。
 * 状态依然存放在 scene 上（this.scene.heroes / heroPortraits / heroEffects / selectedHero ...）。
 */
export class HeroSystem {
  constructor(scene) {
    this.scene = scene;
  }

  // ---------- 初始化 ----------

  createHeroState() {
    const s = this.scene;
    s.heroes = HERO_DEFS.map((def, index) => {
      const pathProgress = this.getOutpostHeroProgress(index);
      const start = this.scene.mapSystem.pointOnSpawnLane(0, pathProgress);
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
        actionStartedAt: 0,
        attackCount: 0,
        blockStreak: 0,
        dead: false,
        defeatedAt: 0,
        respawnAt: 0,
      };

      this.recalculateHeroStats(hero);
      hero.hp = hero.stats.maxHp;
      return hero;
    });
  }

  getOutpostHeroProgress(index) {
    return Phaser.Math.Clamp(this.scene.pathLength - HERO_OUTPOST_OFFSET - index * HERO_OUTPOST_SPACING, 0, this.scene.pathLength);
  }

  createHeroes() {
    const s = this.scene;
    s.heroes.forEach((hero) => {
      const selectionRing = s.add.circle(0, 0, 19, 0xffe28a, 0.18)
        .setStrokeStyle(3, 0xffd15a, 0.95)
        .setVisible(false);
      const shadow = s.add.ellipse(0, 12, 25, 8, 0x2f2415, 0.24);
      const actionAura = s.add.circle(0, -8, 18, hero.accent, 0)
        .setStrokeStyle(2, hero.accent, 0);
      const sprite = s.add.image(0, -8, `hero-${hero.id}`)
        .setDisplaySize(HERO_TEXTURE_SIZE, HERO_TEXTURE_SIZE);
      const name = s.add.text(0, 18, hero.name, {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "12px",
        color: "#2b1c10",
        backgroundColor: "rgba(246,226,169,0.75)",
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5);
      const hpBack = s.add.rectangle(-17, -24, 34, 4, 0x3b2415, 0.9).setOrigin(0, 0.5);
      const hpFill = s.add.rectangle(-17, -24, 34, 4, 0x4cbe58, 1).setOrigin(0, 0.5);
      const group = s.add.container(hero.x, hero.y, [selectionRing, shadow, actionAura, sprite, hpBack, hpFill, name])
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
    this.scene.input.on("pointerdown", (pointer, gameObjects) => {
      this.handleHeroCommandPointer(pointer, gameObjects);
    });
  }

  // ---------- 选择 / 命令 ----------

  selectHero(hero) {
    const s = this.scene;
    if (s.gameEnded || s.modalOpen) {
      return;
    }

    if (hero.dead) {
      this.scene.hudSystem.showNotice(`${hero.name} 已倒下`, "#9c2b24");
      this.updateHeroPortraits();
      return;
    }

    s.selectedHero = hero;
    this.scene.hudSystem.closeBuildMenu();
    s.selectedShopHeroId = hero.id;
    s.rallySettingTower = null;
    s.selectedTower = null;
    this.scene.towerSystem.clearSelectedRange();
    this.updateHeroSelectionVisuals();
    this.scene.hudSystem.showNotice(`${hero.name}：点击地图移动`, "#2f4972");
    this.scene.hudSystem.updateUi();
  }

  updateHeroSelectionVisuals() {
    const s = this.scene;
    s.heroes.forEach((hero) => {
      hero.selectionRing?.setVisible(hero === s.selectedHero && !hero.dead);
    });
  }

  handleHeroCommandPointer(pointer, gameObjects = []) {
    const s = this.scene;
    if (s.rallySettingTower) {
      s.rallySettingTower.rallyPoint = { x: Math.round(pointer.worldX), y: Math.round(pointer.worldY) };
      this.scene.hudSystem.showNotice("集结点已更新", "#315c22");
      s.rallySettingTower = null;
      return;
    }
    if (s.buildMenu && !gameObjects.some((obj) => obj?.isBuildMenuOption)) {
      this.scene.hudSystem.closeBuildMenu();
    }

    if (!s.selectedHero || s.gameEnded || s.modalOpen || s.paused) {
      return;
    }

    if (gameObjects.length > 0) {
      return;
    }

    const point = { x: pointer.worldX, y: pointer.worldY };

    if (!this.isHeroPointWalkable(point.x, point.y)) {
      this.scene.hudSystem.showNotice("英雄无法穿过阻碍", "#9c2b24");
      return;
    }

    this.commandSelectedHero(point);
  }

  commandSelectedHero(point) {
    const s = this.scene;
    const hero = s.selectedHero;

    if (!hero || hero.dead) {
      return;
    }

    hero.targetX = point.x;
    hero.targetY = point.y;
    this.showHeroMoveMarker(point.x, point.y, hero.accent);
    this.scene.hudSystem.showNotice(`${hero.name} 移动`, "#315c22");
  }

  showHeroMoveMarker(x, y, color) {
    const s = this.scene;
    s.heroMoveMarker?.destroy();
    s.heroMoveMarker = s.add.circle(x, y, 12, color, 0.22)
      .setStrokeStyle(3, color, 0.92)
      .setDepth(15);
    s.tweens.add({
      targets: s.heroMoveMarker,
      alpha: 0,
      scale: 1.55,
      duration: 520,
      onComplete: () => {
        s.heroMoveMarker?.destroy();
        s.heroMoveMarker = null;
      },
    });
  }

  getClosestPointOnPath(x, y) {
    return this.scene.pathSegments.reduce((best, segment) => {
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

  // ---------- 肖像 HUD ----------

  createHeroPortraits() {
    const s = this.scene;
    s.heroPortraits = s.heroes.map((hero, index) => {
      const x = 18 + index * 106;
      const y = GAME_HEIGHT - 66;
      const bg = s.add.rectangle(0, 0, 98, 58, 0xf6e2a9, 0.95)
        .setOrigin(0)
        .setStrokeStyle(3, 0x7a4b25, 0.95);
      const portraitImage = s.add.image(22, 28, `hero-${hero.id}`)
        .setDisplaySize(42, 42);
      const name = s.add.text(48, 9, hero.name.slice(1), {
        ...TEXT_STYLE,
        fontSize: "12px",
        color: "#2b1c10",
      });
      const hp = s.add.text(48, 29, "", {
        ...TEXT_STYLE,
        fontSize: "12px",
        color: "#315c22",
      });
      const skillIconKey = `icon-skill-${hero.id}`;
      const skillIcon = s.textures.exists(skillIconKey)
        ? s.add.image(80, 44, skillIconKey).setDisplaySize(18, 18)
        : null;
      const containerItems = [bg, portraitImage, name, hp];
      if (skillIcon) containerItems.push(skillIcon);
      const container = s.add.container(x, y, containerItems)
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

  updateHeroPortraits(time = this.scene.time?.now ?? 0) {
    const s = this.scene;
    if (!s.heroPortraits) {
      return;
    }

    s.heroPortraits.forEach((portrait) => {
      const hero = portrait.hero;
      const selected = hero === s.selectedHero && !hero.dead;

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

  // ---------- 属性 / 装备 ----------

  recalculateAllHeroes() {
    this.scene.heroes.forEach((hero) => this.recalculateHeroStats(hero));
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
    const w = this.scene.wave;
    if (w >= 7) return { chance: 0.25, reduce: 0.5 };
    if (w >= 4) return { chance: 0.2, reduce: 0.45 };
    return { chance: 0.15, reduce: 0.4 };
  }

  // ---------- 主循环 ----------

  updateHeroes(time, delta) {
    const s = this.scene;
    const dt = delta / 1000;

    s.heroes.forEach((hero) => {
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
    const s = this.scene;
    if (hero.respawnAt <= 0 || time < hero.respawnAt) {
      return;
    }

    hero.dead = false;
    hero.defeatedAt = 0;
    hero.respawnAt = 0;
    hero.hp = Math.max(1, Math.round(hero.stats.maxHp * 0.45));
    hero.group?.setAlpha(1);
    this.addFloatingText(hero.x, hero.y - 18, "复活", "#315c22");
    this.updateHeroSprite(hero);
    this.updateHeroSelectionVisuals();
    this.scene.hudSystem.updateUi();
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
        hero.lastMoveSpeed = step / Math.max(dt, 0.001);
        moving = true;
      } else {
        hero.targetX = hero.x;
        hero.targetY = hero.y;
        hero.lastMoveSpeed = 0;
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
    if (x < HERO_COLLISION_RADIUS || x > GAME_WIDTH - HERO_COLLISION_RADIUS) {
      return false;
    }

    if (y < HERO_COLLISION_RADIUS || y > GAME_HEIGHT - HERO_COLLISION_RADIUS) {
      return false;
    }

    return !(this.scene.mapObstacles ?? []).some((obstacle) => (
      Phaser.Math.Distance.Between(x, y, obstacle.x, obstacle.y) < obstacle.radius + HERO_COLLISION_RADIUS
    ));
  }

  updateHeroSupport(hero, time) {
    if (hero.id !== "yueguang" || time < hero.nextHealAt) {
      return;
    }

    const target = this.scene.heroes
      .filter((item) => !item.dead && item.hp < item.stats.maxHp * 0.82)
      .sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0];

    if (!target) {
      return;
    }

    const heal = hero.stats.healPower + Math.round((hero.stats.magic ?? 0) * 0.45);
    target.hp = Math.min(target.stats.maxHp, target.hp + heal);
    this.addFloatingText(target.x, target.y - 34, `+${heal}`, "#3a8f52");
    this.playHeroCastAction(hero);
    hero.nextHealAt = time + 2400;
  }

  findHeroTarget(hero) {
    return this.scene.enemies
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
    const s = this.scene;
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

    this.scene.enemySystem.damageEnemy(target, damage, source);
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
    const s = this.scene;
    const line = s.add.line(0, 0, hero.x, hero.y - 4, target.sprite.x, target.sprite.y, critical ? 0xfff1a8 : hero.accent, 0.86)
      .setLineWidth(critical ? 4 : 2)
      .setDepth(24);
    s.heroEffects.push({ object: line, ttl: 110 });
  }

  updateEnemyAttacks(time) {
    const s = this.scene;
    s.enemies.forEach((enemy) => {
      if (!enemy.alive || time < enemy.nextAttackAt) {
        return;
      }

      const target = enemy.lockedTarget;
      if (!target) {
        return;
      }

      const targetX = typeof target.x === "number" ? target.x : target.sprite?.x;
      const targetY = typeof target.y === "number" ? target.y : target.sprite?.y;
      if (typeof targetX !== "number" || typeof targetY !== "number") {
        this.scene.enemySystem.clearEnemyLock(enemy);
        return;
      }
      if (Phaser.Math.Distance.Between(targetX, targetY, enemy.sprite.x, enemy.sprite.y) > 18) {
        return;
      }
      if ("dead" in target) {
        if (target.dead || target.hp <= 0) {
          this.scene.enemySystem.clearEnemyLock(enemy);
          return;
        }
        this.damageHero(target, enemy.attackDamage, enemy);
      } else {
        if (!target.alive || target.hp <= 0) {
          this.scene.enemySystem.clearEnemyLock(enemy);
          return;
        }
        target.hp -= enemy.attackDamage;
        this.addFloatingText(target.x, target.y - 26, `-${enemy.attackDamage}`, "#9c2b24");
        if (target.hp <= 0) {
          this.scene.towerSystem.destroySoldier(target);
        }
      }
      enemy.nextAttackAt = time + (enemy.rank === "boss" ? 760 : 1120);
    });
  }

  damageHero(hero, amount) {
    const s = this.scene;
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
      hero.defeatedAt = s.time.now;
      hero.respawnAt = s.time.now + HERO_RESPAWN_MS;
      hero.attackers?.forEach((enemy) => {
        if (enemy.lockedTarget === hero) {
          enemy.lockedTarget = null;
        }
      });
      hero.attackers?.clear();
      hero.group.setAlpha(0.42);
      if (s.selectedHero === hero) {
        s.selectedHero = null;
        this.updateHeroSelectionVisuals();
      }
      this.addFloatingText(hero.x, hero.y - 16, "倒下", "#9c2b24");
    }

    this.updateHeroSprite(hero);
    this.scene.hudSystem.updateUi();
  }

  tryClaimTiezhuBlockStreak(hero) {
    const s = this.scene;
    const egg = EASTER_EGGS.find((item) => item.id === "tiezhu-block-streak");

    if (!egg || s.claimedEasterEggs.has(egg.id) || hero.blockStreak < egg.threshold) {
      return;
    }

    s.gold += egg.reward;
    s.claimedEasterEggs.add(egg.id);
    this.scene.mapSystem.saveClaimedEasterEggs();
    this.scene.hudSystem.showNotice("彩蛋：铁壁连防 +50 金币", "#315c22");
    hero.blockStreak = 0;
    this.scene.hudSystem.updateUi();
  }

  recoverHeroes(ratio) {
    const s = this.scene;
    s.heroes.forEach((hero) => {
      hero.dead = false;
      hero.defeatedAt = 0;
      hero.respawnAt = 0;
      hero.group?.setAlpha(1);
      hero.hp = Math.min(hero.stats.maxHp, Math.max(hero.hp, hero.stats.maxHp * ratio));
      this.updateHeroSprite(hero);
    });
    this.updateHeroSelectionVisuals();
    this.updateHeroPortraits();
  }

  // ---------- 动画姿态 ----------

  updateHeroSprite(hero, time = this.scene.time?.now ?? 0, moving = false) {
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
    if (!hero.sprite) {
      return;
    }

    const actionActive = !hero.dead && (hero.actionUntil ?? 0) > time;
    const state = hero.dead
      ? "defeated"
      : actionActive
        ? hero.actionState
        : moving
          ? this.getHeroMovementState(hero)
          : "idle";

    this.setHeroActionFrame(hero, state, time);
    hero.sprite.setFlipX((hero.moveDirection ?? 1) < 0);
    hero.sprite.setAlpha(1);
    hero.actionAura?.setAlpha(0);
    hero.actionAura?.setScale(1);
    hero.actionAura?.setStrokeStyle(2, hero.accent, 0);
    hero.shadow?.setScale(1, 1);
    hero.sprite.setX(0);

    if (state === "idle" || state === "walk" || state === "run") {
      hero.sprite.setAngle(0);
      hero.sprite.setY(-8);
      this.setHeroSpritePoseScale(hero, 1, 1);
      hero.shadow?.setScale(1, 1);
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

    if (state === "cast") {
      const progress = Phaser.Math.Clamp(1 - (hero.actionUntil - time) / 360, 0, 1);
      hero.sprite.setAngle(Math.sin(progress * Math.PI * 2) * 3);
      hero.sprite.setY(-9 + Math.sin(progress * Math.PI) * -4);
      this.setHeroSpritePoseScale(hero, 1.08, 1.04);
      hero.actionAura?.setAlpha(0.48 * (1 - progress));
      hero.actionAura?.setScale(1.05 + progress * 0.85);
      hero.actionAura?.setStrokeStyle(4, hero.accent, 0.72 * (1 - progress));
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

    if (state === "defeated") {
      const progress = Phaser.Math.Clamp(1 - (hero.respawnAt - time) / HERO_RESPAWN_MS, 0, 1);
      hero.sprite.setAngle(0);
      hero.sprite.setY(-3 + Math.sin(progress * Math.PI * 6) * 0.3);
      this.setHeroSpritePoseScale(hero, 1, 1);
      hero.shadow?.setScale(1.18, 0.82);
      return;
    }

    hero.sprite.setY(-8);
    hero.sprite.setAngle(0);
    this.setHeroSpritePoseScale(hero, 1, 1);
  }

  getHeroMovementState(hero) {
    return (hero.lastMoveSpeed ?? HERO_MOVE_SPEED) >= HERO_RUN_SPEED_THRESHOLD ? "run" : "walk";
  }

  setHeroActionFrame(hero, state, time) {
    const s = this.scene;
    const action = state === "block" ? "cast" : state;
    if (action === "idle") {
      const idleKey = `hero-${hero.id}-walk-01`;
      if (hero.currentTextureKey !== idleKey && s.textures.exists(idleKey)) {
        hero.sprite.setTexture(idleKey);
        hero.currentTextureKey = idleKey;
      }
      return;
    }
    const frameCount = HERO_ACTION_FRAME_COUNTS[hero.id]?.[action] ?? 0;
    const textureKey = frameCount > 0
      ? this.getHeroActionFrameKey(hero, action, frameCount, time)
      : `hero-${hero.id}`;

    if (hero.currentTextureKey !== textureKey && s.textures.exists(textureKey)) {
      hero.sprite.setTexture(textureKey);
      hero.currentTextureKey = textureKey;
    }
  }

  getHeroActionFrameKey(hero, action, frameCount, time) {
    if (action === "walk" || action === "run") {
      const frame = Math.floor(time / HERO_ACTION_FRAME_MS) % frameCount;
      return `hero-${hero.id}-${action}-${String(frame + 1).padStart(2, "0")}`;
    }

    if (action === "defeated") {
      const elapsed = Math.max(0, time - (hero.defeatedAt ?? time));
      const frame = Math.min(frameCount - 1, Math.floor(elapsed / 180));
      return `hero-${hero.id}-defeated-${String(frame + 1).padStart(2, "0")}`;
    }

    const duration = Math.max(1, hero.actionDuration ?? HERO_ACTION_FRAME_MS * frameCount);
    const elapsed = Phaser.Math.Clamp(time - (hero.actionStartedAt ?? time), 0, duration - 1);
    const frame = Math.min(frameCount - 1, Math.floor((elapsed / duration) * frameCount));
    return `hero-${hero.id}-${action}-${String(frame + 1).padStart(2, "0")}`;
  }

  setHeroSpritePoseScale(hero, scaleX, scaleY = scaleX) {
    hero.sprite?.setScale(
      (hero.spriteBaseScaleX ?? 1) * scaleX,
      (hero.spriteBaseScaleY ?? 1) * scaleY,
    );
  }

  setHeroAction(hero, state, duration) {
    const now = this.scene.time.now;
    hero.actionState = state;
    hero.actionStartedAt = now;
    hero.actionDuration = duration;
    hero.actionUntil = now + duration;
  }

  // ---------- 技能动作 ----------

  playHeroAttackAction(hero, target) {
    hero.moveDirection = target.sprite.x >= hero.x ? 1 : -1;
    this.setHeroAction(hero, "attack", 360);
  }

  playHeroCastAction(hero) {
    this.setHeroAction(hero, "cast", 360);
  }

  playHeroBlockAction(hero) {
    const s = this.scene;
    this.setHeroAction(hero, "block", 360);
    const shield = s.add.circle(hero.x, hero.y - 12, 22, hero.accent, 0.14)
      .setStrokeStyle(4, hero.accent, 0.9)
      .setDepth(25);
    s.tweens.add({
      targets: shield,
      alpha: 0,
      scale: 1.75,
      duration: 300,
      onComplete: () => shield.destroy(),
    });
  }

  playHeroUltimateAction(hero, target) {
    const s = this.scene;
    this.setHeroAction(hero, "ultimate", 720);
    const color = hero.id === "tiezhu" ? 0x9fb8d6 : hero.id === "ergou" ? 0xffc34f : 0xdcc8ff;
    const burst = s.add.circle(hero.x, hero.y - 12, 16, color, 0.18)
      .setStrokeStyle(5, color, 0.86)
      .setDepth(23);

    s.tweens.add({
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
    const s = this.scene;
    [-18, 0, 18].forEach((offset, index) => {
      const spark = s.add.rectangle(hero.x + offset, hero.y + 6, 7, 24, color, 0.8)
        .setDepth(24)
        .setAngle(offset * 0.8);
      s.tweens.add({
        targets: spark,
        y: hero.y - 22,
        alpha: 0,
        duration: 260 + index * 70,
        onComplete: () => spark.destroy(),
      });
    });
  }

  addHeroBladeEffect(hero, target, color) {
    const s = this.scene;
    const slash = s.add.line(0, 0, hero.x - 22, hero.y + 8, target.sprite.x + 22, target.sprite.y - 22, color, 0.94)
      .setLineWidth(6)
      .setDepth(24);
    s.heroEffects.push({ object: slash, ttl: 180, initialTtl: 180 });
  }

  addHeroMoonEffect(hero, color) {
    const s = this.scene;
    const moon = s.add.arc(hero.x, hero.y - 18, 34, 210, 510, false, color, 0)
      .setStrokeStyle(5, color, 0.88)
      .setDepth(24);
    s.heroEffects.push({ object: moon, ttl: 420, initialTtl: 420 });
  }

  updateHeroEffects(delta) {
    const s = this.scene;
    s.heroEffects = s.heroEffects.filter((effect) => {
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
    const s = this.scene;
    const label = s.add.text(x, y, text, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      color,
      fontStyle: "700",
    }).setOrigin(0.5).setDepth(50);

    s.tweens.add({
      targets: label,
      y: y - 18,
      alpha: 0,
      duration: 720,
      onComplete: () => label.destroy(),
    });
  }
}
