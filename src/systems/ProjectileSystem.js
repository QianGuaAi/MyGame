import Phaser from "phaser";
import { TOWER_TYPES } from "../data/towers.js";

/**
 * 投射物 / 塔特效系统：开火、飞行、命中、销毁、塔射击闪光与光环。
 *
 * 状态留在 scene 上（this.scene.projectiles / enemies）。
 */
export class ProjectileSystem {
  constructor(scene) {
    this.scene = scene;
  }

  getProjectileTexture(tower) {
    const kind = tower.projectileKind ?? TOWER_TYPES[tower.typeKey]?.projectile;
    if (kind === "arrow") {
      if (tower.branch === "burst") return "proj-arrow-burst";
      if (tower.branch === "hawk") return "proj-arrow-hawk";
      return "proj-arrow-basic";
    }
    if (kind === "meteor") return "proj-meteor";
    if (kind === "bomb") {
      if (tower.branch === "shrapnel") return "proj-shrapnel";
      return "proj-bomb";
    }
    if (kind === "flame") return "proj-flame";
    if (kind === "orb") {
      if (tower.typeKey === "frost") return "proj-frost-shard";
      return "proj-magic-bolt";
    }
    return null;
  }

  fireTower(tower, target, time) {
    const s = this.scene;
    const type = TOWER_TYPES[tower.typeKey];
    const projectileKind = tower.projectileKind ?? type.projectile;
    const texKey = this.getProjectileTexture(tower);
    const hasTexture = texKey && s.textures.exists(texKey);

    if (projectileKind === "meteor") {
      const startX = target.sprite.x - 72;
      const startY = target.sprite.y - 130;
      const sprite = hasTexture
        ? s.add.image(startX, startY, texKey).setScale(0.55).setDepth(24)
        : s.add.circle(startX, startY, 14, 0xff6a2b, 1).setStrokeStyle(3, 0xffd18a, 0.9).setDepth(24);
      s.projectiles.push(this.createProjectileData(sprite, tower, target, {
        speed: tower.projectileSpeed || 760,
        targetX: target.sprite.x,
        targetY: target.sprite.y,
      }));
    } else if (projectileKind === "arrow") {
      const sprite = hasTexture
        ? s.add.image(tower.x, tower.y - 16, texKey).setScale(0.45).setDepth(22)
        : s.add.image(tower.x, tower.y - 16, "arrow-shot").setDepth(22);
      s.projectiles.push(this.createProjectileData(sprite, tower, target));
    } else {
      const sprite = hasTexture
        ? s.add.image(tower.x, tower.y - 16, texKey).setScale(0.4).setDepth(22)
        : s.add.circle(tower.x, tower.y - 16, tower.splash ? 7 : 6, type.color, 1).setStrokeStyle(2, type.accent, 0.8).setDepth(22);
      s.projectiles.push(this.createProjectileData(sprite, tower, target));
    }

    tower.nextFireAt = time + tower.rate * this.scene.towerSystem.getTowerRateMultiplier(tower);
  }

  createProjectileData(sprite, tower, target, overrides = {}) {
    return {
      sprite,
      target,
      damage: Math.round(tower.damage * this.scene.towerSystem.getTowerDamageMultiplier(tower)),
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

  addTowerFlash(x, y, color, radius, duration) {
    const s = this.scene;
    const flash = s.add.star(x, y, 6, radius * 0.28, radius, color, 0.85)
      .setDepth(23);
    s.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.35,
      angle: 35,
      duration,
      onComplete: () => flash.destroy(),
    });
  }

  addTowerRing(x, y, color, stroke, radius, duration) {
    const s = this.scene;
    const ring = s.add.circle(x, y, radius, color, 0.12)
      .setStrokeStyle(3, stroke, 0.72)
      .setDepth(23);
    s.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.45,
      duration,
      onComplete: () => ring.destroy(),
    });
  }

  updateProjectiles(delta) {
    const s = this.scene;
    const dt = delta / 1000;

    [...s.projectiles].forEach((projectile) => {
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
    const s = this.scene;
    if (projectile.splash > 0) {
      const blast = s.add.circle(x, y, projectile.splash, projectile.typeKey === "flame" ? 0xd95f32 : 0xf5b83c, 0.2)
        .setStrokeStyle(3, 0xffe2a2, 0.38)
        .setDepth(21);

      s.tweens.add({
        targets: blast,
        alpha: 0,
        scale: 1.24,
        duration: 220,
        onComplete: () => blast.destroy(),
      });

      [...s.enemies].forEach((enemy) => {
        const distance = Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y);

        if (enemy.alive && distance <= projectile.splash) {
          const falloff = Phaser.Math.Clamp(1 - distance / (projectile.splash * 1.6), 0.42, 1);
          this.scene.enemySystem.damageEnemy(enemy, Math.round(projectile.damage * falloff), projectile);
          if (projectile.shrapnelDamage > 0) {
            this.scene.enemySystem.damageEnemy(enemy, projectile.shrapnelDamage, {});
          }
        }
      });
      return;
    }

    this.scene.enemySystem.damageEnemy(projectile.target, projectile.damage, projectile);
  }

  destroyProjectile(projectile) {
    this.scene.projectiles = this.scene.projectiles.filter((item) => item !== projectile);
    projectile.sprite.destroy();
  }
}
