import Phaser from "phaser";
import { TOWER_TYPES, TOWER_BUTTON_ORDER } from "../data/towers.js";
import { GAME_WIDTH } from "../data/map.js";

const TOWER_TEXTURE_KEYS = {
  arrow: "tower-arrow",
  mage: "tower-mage",
  barracks: "tower-barracks",
  artillery: "tower-artillery",
  frost: "tower-frost",
  flame: "tower-flame",
  altar: "tower-altar",
};

const TOWER_DISPLAY_SIZE_BY_LEVEL = [62, 66, 69, 72];

/**
 * 塔系统：建造、升级、分支、属性、查找目标、攻击动画、altar / barracks 行为、士兵生命周期。
 *
 * 状态依然存放在 scene 上（this.scene.towers / selectedTower / gold / ...）。
 */
export class TowerSystem {
  constructor(scene) {
    this.scene = scene;
  }

  getBuildableTowerKeys() {
    return TOWER_BUTTON_ORDER.filter((key) => this.isTowerUnlocked(key) && TOWER_TYPES[key]);
  }

  getPendingBuildType() {
    const s = this.scene;
    const typeKey = s.pendingBuildType || s.selectedBuildType || "arrow";
    return TOWER_TYPES[typeKey] ? typeKey : "arrow";
  }

  getTowerTextureKey(typeKey, level = 1, branch = null, state = "base") {
    const s = this.scene;
    if (state === "attack" && s.textures.exists(`tower-${typeKey}-attack`)) {
      return `tower-${typeKey}-attack`;
    }

    if (branch && s.textures.exists(`tower-${typeKey}-branch-${branch}`)) {
      return `tower-${typeKey}-branch-${branch}`;
    }

    const levelKey = `tower-${typeKey}-l${Phaser.Math.Clamp(level, 1, 3)}`;
    if (s.textures.exists(levelKey)) {
      return levelKey;
    }

    return TOWER_TEXTURE_KEYS[typeKey] ?? TOWER_TYPES[typeKey]?.texture ?? TOWER_TEXTURE_KEYS.arrow;
  }

  buildTower(slot, typeKey) {
    const s = this.scene;
    const safeTypeKey = TOWER_TYPES[typeKey] ? typeKey : "arrow";
    const type = TOWER_TYPES[safeTypeKey];

    if (!this.isTowerUnlocked(safeTypeKey)) {
      this.scene.hudSystem.showNotice(`${type.name} 需要特殊塔图纸`, "#9c2b24");
      return;
    }

    if (s.gold < type.price) {
      this.scene.hudSystem.showNotice("金币不足", "#9c2b24");
      s.cameras.main.shake(120, 0.004);
      return;
    }

    s.gold -= type.price;
    const shadow = s.add.ellipse(slot.x, slot.y + 19, 48, 14, 0x2f2415, 0.22).setDepth(7);
    const textureKey = this.getTowerTextureKey(safeTypeKey, 1);
    const sprite = s.add.image(slot.x, slot.y - 14, textureKey)
      .setDisplaySize(TOWER_DISPLAY_SIZE_BY_LEVEL[0], TOWER_DISPLAY_SIZE_BY_LEVEL[0])
      .setDepth(9)
      .setInteractive({ useHandCursor: true });
    const levelText = s.add.text(slot.x + 22, slot.y + 20, "I", {
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
      tower.rallyPoint = { x: tower.x, y: tower.y + 24 };
      tower.soldiers = [];
      tower.nextSoldierAt = 0;
    }

    this.scene.hudSystem.closeBuildMenu();
    slot.tower = tower;
    slot.platform.setAlpha(0);
    slot.inner.setAlpha(0);
    slot.rim.setAlpha(0);
    sprite.on("pointerdown", () => this.selectTower(tower));
    s.towers.push(tower);
    this.selectTower(tower);
    this.scene.hudSystem.showNotice(`${type.name} 已部署`, "#315c22");
    this.scene.hudSystem.updateUi();
  }

  createTowerGuards(tower) {
    const s = this.scene;
    return [-18, 18].map((offset) => {
      const guard = s.add.image(tower.x + offset, tower.y + 18, "guard")
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
    const s = this.scene;
    this.scene.hudSystem.closeBuildMenu();
    s.selectedTower = tower;
    s.rallySettingTower = null;
    s.selectedHero = null;
    this.scene.heroSystem.updateHeroSelectionVisuals();
    this.clearSelectedRange();
    s.selectedRange = s.add.circle(tower.x, tower.y, tower.range, 0xffffff, 0)
      .setStrokeStyle(3, TOWER_TYPES[tower.typeKey].color, 0.42)
      .setDepth(6);
    this.scene.hudSystem.updateUi();
  }

  startRallySetting() {
    const s = this.scene;
    const tower = s.selectedTower;
    if (!tower || tower.typeKey !== "barracks") {
      return;
    }
    s.rallySettingTower = tower;
    this.scene.hudSystem.showNotice("点击地图设置集结点", "#2f4972");
  }

  clearSelectedRange() {
    const s = this.scene;
    s.selectedRange?.destroy();
    s.selectedRange = null;
  }

  drawSelectedRallyMarker() {
    const s = this.scene;
    s.rallyMarker?.destroy();
    s.rallyMarker = null;
    const tower = s.selectedTower;
    if (!tower || tower.typeKey !== "barracks" || !tower.rallyPoint) {
      return;
    }
    s.rallyMarker = s.add.circle(tower.rallyPoint.x, tower.rallyPoint.y, 5, 0x8bd4ff, 0.85)
      .setStrokeStyle(2, 0x2f4972, 0.95)
      .setDepth(22);
  }

  previewBuildRange(slot) {
    const s = this.scene;
    if (slot.tower || s.gameEnded || s.modalOpen || s.paused) {
      return;
    }

    const type = TOWER_TYPES[this.getPendingBuildType()];
    slot.platform.setStrokeStyle(4, type.color, 0.78);
    s.hoverRange?.destroy();
    s.hoverRange = s.add.circle(slot.x, slot.y, type.range, 0xffffff, 0)
      .setStrokeStyle(2, type.color, 0.24)
      .setDepth(4);
  }

  clearHoverRange(slot) {
    const s = this.scene;
    if (!slot.tower) {
      slot.platform.setStrokeStyle(4, 0x2f2415, 0);
    }

    s.hoverRange?.destroy();
    s.hoverRange = null;
  }

  updateTowers(time) {
    const s = this.scene;
    s.towers.forEach((tower) => {
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
        this.scene.projectileSystem.fireTower(tower, target, time);
        this.playTowerAttackAction(tower, target);
      }
    });
  }

  updateAltarTower(tower, time) {
    const s = this.scene;
    if (time < tower.nextFireAt) {
      return;
    }

    s.tweens.killTweensOf(tower.sprite);
    tower.sprite.setPosition(tower.x, tower.y - 14);
    s.tweens.add({
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

    const aura = s.add.circle(tower.x, tower.y, tower.range, TOWER_TYPES.altar.color, 0.08)
      .setStrokeStyle(2, TOWER_TYPES.altar.accent, 0.25)
      .setDepth(5);
    s.tweens.add({
      targets: aura,
      alpha: 0,
      scale: 1.06,
      duration: 480,
      onComplete: () => aura.destroy(),
    });
    tower.nextFireAt = time + 1800;
  }

  updateBarracksTower(tower, _target, time) {
    const def = TOWER_TYPES.barracks;
    tower.soldiers = (tower.soldiers ?? []).filter((soldier) => soldier.alive);
    if (tower.soldiers.length < def.soldierMax && time >= (tower.nextSoldierAt ?? 0)) {
      const soldier = this.spawnSoldier(tower);
      tower.soldiers.push(soldier);
      tower.nextSoldierAt = time + def.soldierProduceMs;
    }
    tower.soldiers.forEach((soldier) => this.updateSoldier(soldier, time));
  }

  spawnSoldier(tower) {
    const s = this.scene;
    const def = TOWER_TYPES.barracks;
    const textureKey = s.textures.exists("guard") ? "guard" : "enemy-scout";
    const sprite = s.add.image(tower.x, tower.y, textureKey)
      .setScale(textureKey === "guard" ? 0.82 : 0.78)
      .setDepth(20);
    return {
      sprite,
      ownerTower: tower,
      x: tower.x,
      y: tower.y,
      hp: def.soldierHp,
      maxHp: def.soldierHp,
      damage: def.soldierDamage,
      attackRate: def.soldierAttackRate,
      attackRange: def.soldierAttackRange,
      speed: def.soldierSpeed,
      nextAttackAt: 0,
      alive: true,
      attackers: new Set(),
    };
  }

  updateSoldier(soldier, time) {
    const s = this.scene;
    if (!soldier.alive) {
      return;
    }
    soldier.attackers.forEach((enemy) => {
      if (!enemy.alive || enemy.lockedTarget !== soldier) {
        soldier.attackers.delete(enemy);
      }
    });
    const rally = soldier.ownerTower.rallyPoint;
    let target = null;
    let bestDistance = Infinity;
    soldier.attackers.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      const distance = Phaser.Math.Distance.Between(soldier.x, soldier.y, enemy.sprite.x, enemy.sprite.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        target = enemy;
      }
    });
    if (target) {
      if (bestDistance > soldier.attackRange) {
        this.moveTowards(soldier, target.sprite.x, target.sprite.y, soldier.speed);
      } else if (time >= soldier.nextAttackAt) {
        this.scene.enemySystem.damageEnemy(target, soldier.damage, {});
        soldier.nextAttackAt = time + soldier.attackRate;
      }
    } else {
      const distanceToRally = Phaser.Math.Distance.Between(soldier.x, soldier.y, rally.x, rally.y);
      if (distanceToRally > 4) {
        this.moveTowards(soldier, rally.x, rally.y, soldier.speed);
      }
    }
    if (target) {
      soldier.sprite.setFlipX(target.sprite.x < soldier.x);
    }
    soldier.sprite.x = soldier.x;
    soldier.sprite.y = soldier.y;
  }

  moveTowards(obj, targetX, targetY, speed) {
    const dt = this.scene.game.loop.delta / 1000;
    const dx = targetX - obj.x;
    const dy = targetY - obj.y;
    const distance = Math.hypot(dx, dy) || 1;
    const step = Math.min(distance, speed * dt);
    obj.x += (dx / distance) * step;
    obj.y += (dy / distance) * step;
  }

  destroySoldier(soldier) {
    if (!soldier || !soldier.alive) {
      return;
    }
    soldier.alive = false;
    soldier.attackers?.forEach((enemy) => {
      if (enemy.lockedTarget === soldier) {
        enemy.lockedTarget = null;
      }
    });
    soldier.attackers?.clear();
    soldier.sprite?.destroy();
  }

  findTargetForTower(tower) {
    return this.scene.enemies
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
    const altar = this.scene.towers
      .filter((item) => item.typeKey === "altar" && item !== tower
        && Phaser.Math.Distance.Between(item.x, item.y, tower.x, tower.y) <= item.range)
      .sort((a, b) => (b.damageBuff + b.rateBuff) - (a.damageBuff + a.rateBuff))[0];
    return altar ? { damageBuff: altar.damageBuff ?? 0, rateBuff: altar.rateBuff ?? 0 } : { damageBuff: 0, rateBuff: 0 };
  }

  playTowerAttackAction(tower, target) {
    const s = this.scene;
    const type = TOWER_TYPES[tower.typeKey];
    const angle = Phaser.Math.Angle.Between(tower.x, tower.y, target.sprite.x, target.sprite.y);
    const recoil = tower.typeKey === "artillery" ? 8 : 4;
    const flashX = tower.x + Math.cos(angle) * 18;
    const flashY = tower.y - 16 + Math.sin(angle) * 18;
    const baseTextureKey = this.getTowerTextureKey(tower.typeKey, tower.level, tower.branch);
    const attackTextureKey = this.getTowerTextureKey(tower.typeKey, tower.level, tower.branch, "attack");

    s.tweens.killTweensOf(tower.sprite);
    tower.sprite.setPosition(tower.x, tower.y - 14);
    tower.sprite.setAngle(0);
    if (attackTextureKey !== baseTextureKey) {
      tower.sprite.setTexture(attackTextureKey);
    }
    s.tweens.add({
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
      this.scene.projectileSystem.addTowerFlash(flashX, flashY, 0xfff0a8, 12, 110);
    } else if (tower.typeKey === "mage") {
      this.scene.projectileSystem.addTowerRing(tower.x, tower.y - 14, type.color, type.accent, 20, 160);
    } else if (tower.typeKey === "artillery") {
      this.scene.projectileSystem.addTowerFlash(flashX, flashY, 0xffb74d, 20, 140);
      s.cameras.main.shake(55, 0.0015);
    } else if (tower.typeKey === "frost") {
      this.scene.projectileSystem.addTowerRing(tower.x, tower.y - 14, 0x9bdcff, 0xdbf7ff, 24, 190);
    } else if (tower.typeKey === "flame") {
      this.scene.projectileSystem.addTowerFlash(flashX, flashY, 0xff7a35, 18, 130);
    }
  }

  playBarracksAttackAction(tower, target) {
    const s = this.scene;
    tower.guards.forEach((guard, index) => {
      const direction = guard.sprite.x > target.sprite.x ? -1 : 1;
      s.tweens.killTweensOf(guard.sprite);
      s.tweens.add({
        targets: guard.sprite,
        x: guard.sprite.x + direction * 8,
        angle: direction * (index === 0 ? -10 : 10),
        yoyo: true,
        duration: 80,
        onComplete: () => guard.sprite.setAngle(0),
      });
    });

    const slash = s.add.arc(target.sprite.x, target.sprite.y - 8, 18, 210, 330, false, 0xffdf82, 0)
      .setStrokeStyle(4, 0xffdf82, 0.82)
      .setDepth(23);
    s.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.25,
      duration: 130,
      onComplete: () => slash.destroy(),
    });
  }

  upgradeSelectedTower() {
    const s = this.scene;
    const tower = s.selectedTower;

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

    if (s.gold < cost) {
      this.scene.hudSystem.showNotice("金币不足", "#9c2b24");
      s.cameras.main.shake(120, 0.004);
      return;
    }

    s.gold -= cost;
    tower.level += 1;
    tower.totalCost += cost;
    Object.assign(tower, this.getTowerStats(tower.typeKey, tower.level, tower.branch));
    this.applyTowerVisual(tower);
    this.selectTower(tower);
    this.scene.hudSystem.showNotice(`${this.getTowerDisplayName(tower)} Lv.${tower.level}`, "#7a3d12");
    this.scene.hudSystem.updateUi();
  }

  openTowerBranchModal(tower) {
    const s = this.scene;
    const type = TOWER_TYPES[tower.typeKey];
    this.scene.hudSystem.createModalBase(`${type.name}四级分支`, "选择一条升级路线。");
    const branches = Object.entries(type.branches ?? {});

    branches.forEach(([key, branch], index) => {
      const x = 310 + index * 300;
      this.scene.hudSystem.addModalText(x - 105, 190, `${branch.name}\n${branch.description}\n升级费用 ${this.getUpgradeCost(tower)}`, 15, "#3a2816", 220);
      const button = this.scene.hudSystem.createButton(x, 292, 180, 38, `选择${branch.name}`, () => this.applyTowerBranch(tower, key), {
        fill: index === 0 ? 0xd95f32 : 0x6f8dbd,
        stroke: 0x70451f,
        color: "#fff6d8",
        hoverFill: index === 0 ? 0xec7448 : 0x84a7dc,
      }).setDepth(93);
      s.modalObjects.push(button);
      this.scene.hudSystem.setButtonEnabled(button, s.gold >= this.getUpgradeCost(tower));
    });

    const close = this.scene.hudSystem.createButton(GAME_WIDTH / 2, 392, 150, 36, "稍后再说", () => this.scene.hudSystem.closeModal(), {
      fill: 0xe7c980,
      stroke: 0x8a5a26,
    }).setDepth(93);
    s.modalObjects.push(close);
  }

  applyTowerBranch(tower, branchKey) {
    const s = this.scene;
    const cost = this.getUpgradeCost(tower);

    if (s.gold < cost) {
      this.scene.hudSystem.showNotice("金币不足", "#9c2b24");
      return;
    }

    s.gold -= cost;
    tower.level = 4;
    tower.branch = branchKey;
    tower.totalCost += cost;
    Object.assign(tower, this.getTowerStats(tower.typeKey, 4, branchKey));
    this.applyTowerVisual(tower);
    this.scene.hudSystem.closeModal();
    this.selectTower(tower);
    this.scene.hudSystem.showNotice(`升级为 ${this.getTowerDisplayName(tower)}`, "#7a3d12");
    this.scene.hudSystem.updateUi();
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
    const s = this.scene;
    const tower = s.selectedTower;

    if (!tower) {
      return;
    }

    const refund = Math.floor(tower.totalCost * 0.55);
    tower.slot.tower = null;
    tower.slot.platform.setAlpha(0);
    tower.slot.inner.setAlpha(0);
    tower.slot.rim.setAlpha(0);
    tower.shadow.destroy();
    tower.sprite.destroy();
    tower.levelText.destroy();
    tower.soldiers?.forEach((soldier) => this.destroySoldier(soldier));
    tower.guards?.forEach((guard) => guard.sprite.destroy());
    s.towers = s.towers.filter((item) => item !== tower);
    if (s.rallySettingTower === tower) {
      s.rallySettingTower = null;
    }
    s.selectedTower = null;
    this.clearSelectedRange();
    s.gold += refund;
    this.scene.hudSystem.showNotice(`回收 +${refund}`, "#315c22");
    this.scene.hudSystem.updateUi();
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
    return !type.blueprintKey || this.scene.unlockedBlueprints.has(key);
  }
}
