import Phaser from "phaser";
import { TOWER_TYPES } from "../data/towers.js";
import { BASIC_SHOP_ITEMS, RARITY_CONFIG } from "../data/equipment.js";
import { isChapterFinalLevel } from "../data/levels.js";
import { pickRandom } from "../utils/random.js";

/**
 * 敌人生命周期系统：sheet 帧补齐 / spawn / 每帧更新 / 减血 / 逃出 / 销毁 / 掉落。
 *
 * 状态依然存放在 scene 上（this.scene.enemies / lives / gold / score / pathLength 等），
 * 这里只搬移方法。
 */
export class EnemySystem {
  constructor(scene) {
    this.scene = scene;
  }

  ensureMonsterFrame(monster) {
    if (monster?.useFrames) {
      return this.scene.textures.exists(monster.walkKey(1)) ? monster.walkKey(1) : null;
    }

    const tex = this.scene.textures.get(monster.sheetKey);
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

  spawnEnemy(rank) {
    const s = this.scene;
    const layout = s.layout;
    let bossKey = "enemy-golem-walk";
    if (rank === "boss" && layout.bossTexture && s.textures.exists(layout.bossTexture)) {
      bossKey = layout.bossTexture;
    }
    const waveScale = s.wave - 1;
    const rankStats = {
      normal: { hp: 50, hpGrowth: 23, reward: 8, rewardGrowth: 1.5, speed: 62, texture: "enemy-scout", tint: 0xffffff, scale: 1, damage: 7 },
      heavy: { hp: 145, hpGrowth: 50, reward: 28, rewardGrowth: 4, speed: 43, texture: "enemy-brute", tint: 0xffffff, scale: 1, damage: 12 },
      rare: { hp: 92, hpGrowth: 34, reward: 16, rewardGrowth: 3, speed: 66, texture: "enemy-scout", tint: 0xb8deff, scale: 1.08, damage: 9 },
      elite: { hp: 225, hpGrowth: 62, reward: 42, rewardGrowth: 6, speed: 45, texture: "enemy-brute", tint: 0xd6bbff, scale: 1.12, damage: 15 },
      boss: { hp: 620, hpGrowth: 88, reward: 120, rewardGrowth: 10, speed: 34, texture: "enemy-brute", tint: 0xffcf70, scale: 1.35, damage: 22 },
    };
    const stats = rankStats[rank];
    const hpMultiplier = s.levelConfig.enemyMix === "tougher" ? 1.2 : s.levelConfig.enemyMix === "boss" ? 1.1 : 1;
    const monster = this.scene.waveSystem.pickWaveMonster(rank);
    const tierScale = monster ? 1 + (monster.tier - 1) * 0.06 : 1;
    const maxHp = Math.round((stats.hp + waveScale * stats.hpGrowth) * hpMultiplier * tierScale);
    const reward = Math.round((stats.reward + s.wave * stats.rewardGrowth) * (monster ? 1 + (monster.tier - 1) * 0.05 : 1));
    const laneId = this.scene.mapSystem.nextSpawnLaneId();
    const lane = this.scene.mapSystem.getSpawnLane(laneId);
    const point = this.scene.mapSystem.pointOnSpawnLane(laneId, 0);
    // Boss 帧动画：若章节配置了 bossFrameId 且对应资源已加载，覆盖 monster 引用
    let frameMonster = monster?.useFrames ? monster : null;
    if (rank === "boss" && layout.bossFrameId) {
      const id = layout.bossFrameId;
      if (s.textures.exists(`enemy-${id}-walk-01`)) {
        frameMonster = {
          id,
          tier: 10,
          useFrames: true,
          walkFrames: 4,
          attackFrames: 4,
          deathFrames: 4,
          walkKey: (n) => `enemy-${id}-walk-${String(n).padStart(2, "0")}`,
          attackKey: (n) => `enemy-${id}-attack-${String(n).padStart(2, "0")}`,
          deathKey: (n) => `enemy-${id}-death-${String(n).padStart(2, "0")}`,
        };
      }
    }
    const useFrames = frameMonster?.useFrames && s.textures.exists(frameMonster.walkKey(1));
    const useBossStatic = !useFrames && rank === "boss" && s.textures.exists(bossKey) && !bossKey.startsWith("enemy-");
    const useSheet = !useFrames && !useBossStatic && monster && s.textures.exists(monster.sheetKey) && s.textures.get(monster.sheetKey).has(monster.frameKey);
    const textureKey = useFrames ? frameMonster.walkKey(1) : (useBossStatic ? bossKey : (useSheet ? monster.sheetKey : stats.texture));
    const frameKey = useSheet ? monster.frameKey : undefined;
    // §21.4: 怪物素材默认面向左，代码不翻转。仅程序化贴图按路径角度旋转。
    const sprite = s.add.image(point.x, point.y, textureKey)
      .setRotation(useFrames || useSheet ? 0 : point.angle)
      .setDepth(18);
    const targetSize = (rank === "boss" ? 56 : rank === "elite" ? 46 : rank === "heavy" ? 42 : 36) * stats.scale;
    if (useFrames) {
      sprite.setScale(targetSize / 96);
    } else if (useSheet) {
      const maxDim = Math.max(monster.frame.w, monster.frame.h);
      sprite.setScale(targetSize / maxDim);
    } else {
      sprite.setScale(stats.scale).setTint(stats.tint);
    }
    const barWidth = rank === "boss" ? 58 : rank === "elite" ? 48 : rank === "heavy" ? 40 : 32;
    const barBack = s.add.rectangle(point.x - barWidth / 2, point.y - 28, barWidth, 5, 0x3b2415, 0.9)
      .setOrigin(0, 0.5)
      .setDepth(19);
    const barFill = s.add.rectangle(point.x - barWidth / 2, point.y - 28, barWidth, 5, rank === "boss" ? 0xf6c453 : 0xd6422a, 1)
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
      laneId,
      pathLength: lane.length,
      speed: (stats.speed + (rank === "normal" || rank === "rare" ? Math.min(28, s.wave * 3) : Math.min(18, s.wave * 2)))
        * (s.levelConfig.enemyMix === "tougher" ? 0.96 : 1),
      alive: true,
      isHeavy: rank === "heavy" || rank === "elite" || rank === "boss",
      rank,
      attackDamage: stats.damage + Math.floor(s.wave * 0.8),
      nextAttackAt: 0,
      slowUntil: 0,
      slowFactor: 1,
      burnUntil: 0,
      burnDps: 0,
      baseTint: (useFrames || useSheet) ? 0xffffff : stats.tint,
      usesSheet: useSheet,
      useFrames,
      frameDef: useFrames ? frameMonster : null,
      animFrame: 1,
      animNextAt: 0,
      animState: "walk",
      bobPhase: Math.random() * Math.PI * 2,
      bobAmp: (useFrames || useSheet) ? (rank === "boss" ? 3.5 : rank === "elite" ? 3 : 2.2) : 0,
      lockedTarget: null,
      savedProgress: 0,
      barWidth,
    };

    s.enemies.push(enemy);
  }

  updateEnemies(time, delta) {
    const s = this.scene;
    const dt = delta / 1000;
    const aggroRadius = TOWER_TYPES.barracks.soldierAggroRadius;

    [...s.enemies].forEach((enemy) => {
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

      if (enemy.lockedTarget) {
        const target = enemy.lockedTarget;
        const targetX = typeof target.x === "number" ? target.x : target.sprite?.x;
        const targetY = typeof target.y === "number" ? target.y : target.sprite?.y;
        const targetAlive = target.alive !== false && !target.dead && (typeof target.hp !== "number" || target.hp > 0);
        const distance = (typeof targetX === "number" && typeof targetY === "number")
          ? Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, targetX, targetY)
          : Infinity;
        if (!targetAlive || distance > aggroRadius * 1.5) {
          this.clearEnemyLock(enemy);
        }
      }

      if (!enemy.lockedTarget) {
        const candidates = this.collectAggroCandidates();
        let best = null;
        let bestDistance = Infinity;
        candidates.forEach((candidate) => {
          if (candidate.attackers.size >= 5) {
            return;
          }
          const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, candidate.x, candidate.y);
          if (distance <= aggroRadius && distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
          }
        });
        if (best && best.attackers.size < 5) {
          enemy.savedProgress = enemy.progress;
          enemy.lockedTarget = best.ref;
          best.attackers.add(enemy);
          this.setEnemyAnimState(enemy, "attack");
        }
      }

      const slowed = time < enemy.slowUntil;
      const burning = time < enemy.burnUntil;
      const speed = enemy.speed * (slowed ? enemy.slowFactor : 1);
      if (enemy.lockedTarget) {
        const target = enemy.lockedTarget;
        const targetX = typeof target.x === "number" ? target.x : target.sprite?.x;
        const targetY = typeof target.y === "number" ? target.y : target.sprite?.y;
        if (typeof targetX !== "number" || typeof targetY !== "number") {
          this.clearEnemyLock(enemy);
        } else {
          const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, targetX, targetY);
          const attackRange = 18;
          if (distance > attackRange) {
            const step = Math.min(distance, speed * dt);
            enemy.sprite.x += ((targetX - enemy.sprite.x) / distance) * step;
            enemy.sprite.y += ((targetY - enemy.sprite.y) / distance) * step;
          }
          if (!enemy.usesSheet && !enemy.useFrames) {
            enemy.sprite.setRotation(Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, targetX, targetY));
          }
        }
      } else {
        enemy.progress += speed * dt;

        if (enemy.progress >= (enemy.pathLength ?? s.pathLength)) {
          this.enemyEscaped(enemy);
          return;
        }

        const point = this.scene.mapSystem.pointOnSpawnLane(enemy.laneId ?? 0, enemy.progress);
        const bob = enemy.bobAmp ? Math.sin(time * 0.008 + enemy.bobPhase) * enemy.bobAmp : 0;
        enemy.sprite.setPosition(point.x, point.y + bob);
        if (!enemy.usesSheet && !enemy.useFrames) {
          enemy.sprite.setRotation(point.angle);
        }
      }

      enemy.sprite.setTint(slowed ? 0xb8d9ff : burning ? 0xff9b55 : enemy.baseTint);
      enemy.barBack.setPosition(enemy.sprite.x - enemy.barWidth / 2, enemy.sprite.y - 28);
      enemy.barFill.setPosition(enemy.sprite.x - enemy.barWidth / 2, enemy.sprite.y - 28);
      enemy.barFill.setDisplaySize(enemy.barWidth * Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1), 5);

      if (enemy.useFrames && enemy.frameDef && time >= enemy.animNextAt) {
        this.advanceEnemyAnim(enemy, time);
      }
    });
  }

  advanceEnemyAnim(enemy, time) {
    const def = enemy.frameDef;
    const isAttacking = enemy.animState === "attack";
    const frameCount = isAttacking ? def.attackFrames : def.walkFrames;
    const msPerFrame = isAttacking ? 160 : 140;
    enemy.animFrame = (enemy.animFrame % frameCount) + 1;
    enemy.animNextAt = time + msPerFrame;
    const texKey = isAttacking ? def.attackKey(enemy.animFrame) : def.walkKey(enemy.animFrame);
    if (this.scene.textures.exists(texKey)) {
      enemy.sprite.setTexture(texKey);
    }
  }

  setEnemyAnimState(enemy, state) {
    if (!enemy.useFrames || enemy.animState === state) return;
    enemy.animState = state;
    enemy.animFrame = 0;
    enemy.animNextAt = 0;
  }

  clearEnemyLock(enemy) {
    enemy.lockedTarget?.attackers?.delete(enemy);
    if (typeof enemy.savedProgress === "number") {
      enemy.progress = Math.max(enemy.progress, enemy.savedProgress);
    }
    enemy.lockedTarget = null;
    this.setEnemyAnimState(enemy, "walk");
  }

  collectAggroCandidates() {
    const s = this.scene;
    const list = [];
    s.towers.forEach((tower) => {
      if (tower.typeKey !== "barracks") {
        return;
      }
      (tower.soldiers ?? []).forEach((soldier) => {
        if (soldier.alive) {
          list.push({ x: soldier.x, y: soldier.y, ref: soldier, attackers: soldier.attackers });
        }
      });
    });
    s.heroes.forEach((hero) => {
      if (hero.hp > 0 && !hero.dead) {
        if (!hero.attackers) {
          hero.attackers = new Set();
        }
        list.push({ x: hero.x, y: hero.y, ref: hero, attackers: hero.attackers });
      }
    });
    return list;
  }

  damageEnemy(enemy, amount, source = {}) {
    const s = this.scene;
    if (!enemy.alive) {
      return;
    }

    enemy.hp -= amount;

    if (source.slowMs > 0) {
      enemy.slowUntil = Math.max(enemy.slowUntil, s.time.now + source.slowMs);
      enemy.slowFactor = Math.min(enemy.slowFactor, source.slowFactor ?? 1);
    }

    if (source.stunMs > 0) {
      enemy.slowUntil = Math.max(enemy.slowUntil, s.time.now + source.stunMs);
      enemy.slowFactor = Math.min(enemy.slowFactor, 0.08);
    }

    if (source.burnMs > 0) {
      enemy.burnUntil = Math.max(enemy.burnUntil, s.time.now + source.burnMs);
      enemy.burnDps = Math.max(enemy.burnDps, source.burnDps ?? 0);
    }

    if (enemy.hp <= 0) {
      this.destroyEnemy(enemy, true);
    }
  }

  enemyEscaped(enemy) {
    const s = this.scene;
    this.destroyEnemy(enemy, false);
    s.lives -= enemy.isHeavy ? 2 : 1;
    s.cameras.main.shake(160, 0.006);

    if (s.lives <= 0) {
      this.scene.hudSystem.finishGame();
      return;
    }

    this.scene.hudSystem.updateUi();
  }

  destroyEnemy(enemy, rewarded) {
    const s = this.scene;
    if (!enemy.alive) {
      return;
    }

    this.clearEnemyLock(enemy);
    enemy.alive = false;
    s.enemies = s.enemies.filter((item) => item !== enemy);
    enemy.sprite.destroy();
    enemy.barBack.destroy();
    enemy.barFill.destroy();

    if (rewarded) {
      s.gold += enemy.reward;
      s.score += enemy.reward * 5;
      this.tryDropLoot(enemy);
      this.scene.hudSystem.updateUi();
    }
  }

  tryDropLoot(enemy) {
    const s = this.scene;
    const rates = {
      normal: 0.02,
      heavy: 0.035,
      rare: s.levelConfig.enemyMix === "rare-mix" ? 0.18 : 0.12,
      elite: s.levelConfig.enemyMix === "rare-mix" ? 0.24 : 0.2,
      boss: 1,
    };

    if (isChapterFinalLevel(s.levelId) && enemy.rank === "boss") {
      if (Math.random() < 0.5) {
        const rarity = Math.random() < 0.6 ? "稀有" : "史诗";
        const item = this.scene.economySystem.createEquipment(pickRandom(BASIC_SHOP_ITEMS), rarity);
        s.inventory.push(item);
        this.scene.hudSystem.showNotice(`Boss 必掉：${item.name} 已进背包`, RARITY_CONFIG[rarity].color);
      } else {
        this.scene.economySystem.addBlueprintFragment();
        this.scene.hudSystem.showNotice("Boss 必掉：图纸碎片 +1", "#5a4ba6");
      }
      return;
    }

    if (Math.random() > (rates[enemy.rank] ?? 0.02)) {
      return;
    }

    if (enemy.rank === "boss" && this.scene.economySystem.chooseLockedBlueprint()) {
      const key = this.scene.economySystem.chooseLockedBlueprint();
      this.scene.economySystem.unlockBlueprint(key);
      this.scene.hudSystem.showNotice(`Boss 掉落图纸：${TOWER_TYPES[key].name}`, "#5a4ba6");
      return;
    }

    const rarity = enemy.rank === "boss" ? "传说" : enemy.rank === "elite" ? "史诗" : enemy.rank === "rare" ? "稀有" : "普通";
    const item = this.scene.economySystem.createEquipment(pickRandom(BASIC_SHOP_ITEMS), rarity);
    s.inventory.push(item);
    this.scene.hudSystem.showNotice(`敌人掉落：${item.name} 已进背包`, RARITY_CONFIG[rarity].color);
  }
}
