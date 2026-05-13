import { STORAGE_KEYS } from "../utils/storage.js";
import { pickWaveMonsterTypes } from "../data/monsters.js";

/**
 * 波次 / 准备期 / 刷怪节奏系统。
 *
 * 状态仍然存放在 GameScene 上（this.scene.wave / waveActive / spawnedThisWave 等），
 * 这里只搬移方法，避免外部 ~50 个读取点全部修改。后续可以再把状态迁过来。
 */
export class WaveSystem {
  constructor(scene) {
    this.scene = scene;
  }

  startPrepPhase(duration) {
    const s = this.scene;
    s.prepPhase = true;
    s.prepCountdown = duration;
    s.prepInitialDuration = duration;
    this.scene.hudSystem.updateUi();
    this.updatePrepDisplay();
  }

  endPrepPhase(early) {
    const s = this.scene;
    if (!s.prepPhase || s.paused) {
      return;
    }
    const bonus = early ? Math.floor(s.prepCountdown) : 0;
    s.prepPhase = false;
    s.prepCountdown = 0;
    this.updatePrepDisplay();
    if (bonus > 0) {
      s.gold += bonus;
      this.scene.hudSystem.showNotice(`提前开始奖励 +${bonus} 金币`, "#315c22");
    }
    this.startWave();
  }

  handleStartButton() {
    const s = this.scene;
    if (s.paused) {
      this.scene.hudSystem.showNotice("游戏已暂停", "#7a3d12");
      return;
    }

    if (s.prepPhase) {
      this.endPrepPhase(true);
    } else {
      this.startWave();
    }
  }

  updatePrepDisplay() {
    const s = this.scene;
    if (!s.prepBox) {
      return;
    }
    const visible = s.prepPhase;
    s.prepBox.setVisible(visible);
    s.prepText.setVisible(visible);
    if (visible) {
      const secs = Math.ceil(s.prepCountdown);
      const label = s.prepInitialDuration === 60 ? "游戏准备" : "下波准备";
      const bonus = Math.floor(s.prepCountdown);
      s.prepText.setText(`${label}  ${secs} 秒  提前开始可奖励 ${bonus} 金币`);
    }
  }

  startWave() {
    const s = this.scene;
    if (s.prepPhase || s.waveActive || s.gameEnded || s.modalOpen || s.paused || s.wave >= s.totalWaves) {
      return;
    }

    s.wave += 1;
    this.scene.heroSystem.recalculateAllHeroes();
    this.scene.heroSystem.recoverHeroes(0.22);
    s.waveActive = true;
    s.spawnedThisWave = 0;
    s.enemiesThisWave = this.getWaveEnemyTotal(s.wave);
    s.spawnEvery = Math.max(410, 860 - s.wave * 32);
    s.spawnPlan = this.buildSpawnPlan();
    s.waveStartedAt = s.time.now;
    s.waveMonsterPool = this.buildWaveMonsterPool(s.wave);
    this.scene.hudSystem.showNotice(`第 ${s.wave}/${s.totalWaves} 波来袭`, "#7a3d12");
    this.scene.hudSystem.updateUi();
  }

  buildSpawnPlan() {
    const s = this.scene;
    const total = s.enemiesThisWave;
    const plan = [];
    let elapsed = 0;
    let clusterSize = 1;
    let remaining = total;
    const intraGap = 280;
    const interGap = 1700;
    const maxCluster = 5;
    while (remaining > 0) {
      const size = Math.min(clusterSize, remaining);
      for (let i = 0; i < size; i += 1) {
        plan.push(elapsed + i * intraGap);
      }
      elapsed = plan[plan.length - 1] + interGap;
      clusterSize = Math.min(clusterSize + 1, maxCluster);
      remaining -= size;
    }
    return plan;
  }

  buildWaveMonsterPool(wave) {
    const s = this.scene;
    const types = pickWaveMonsterTypes(wave);
    return types
      .map((monster) => {
        const frameKey = this.scene.enemySystem.ensureMonsterFrame(monster);
        return frameKey ? { ...monster, frameKey } : null;
      })
      .filter(Boolean);
  }

  pickWaveMonster(rank) {
    const pool = this.scene.waveMonsterPool;
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

  getWaveEnemyTotal(wave) {
    return 9 + wave * 3;
  }

  updateSpawning(time) {
    const s = this.scene;
    if (!s.waveActive || s.spawnedThisWave >= s.enemiesThisWave) {
      return;
    }
    const dueAt = s.waveStartedAt + s.spawnPlan[s.spawnedThisWave];
    if (time < dueAt) {
      return;
    }
    const rank = this.getCurrentRank(s.spawnedThisWave + 1, s.enemiesThisWave);
    this.scene.enemySystem.spawnEnemy(rank);
    s.spawnedThisWave += 1;
  }

  getCurrentRank(spawnIndex, totalEnemies) {
    const s = this.scene;
    const isLast = spawnIndex === totalEnemies;

    if ((s.levelConfig.enemyMix === "boss" || s.wave === s.totalWaves) && s.wave === s.totalWaves && isLast) {
      return "boss";
    }

    if (s.levelConfig.enemyMix === "rare-mix" && s.wave >= 3 && Math.random() < 0.3) {
      return "rare";
    }

    if (s.wave >= 4 && isLast && s.wave % 2 === 0) {
      return "elite";
    }

    if (s.wave >= 2 && Math.random() < 0.1) {
      return "rare";
    }

    if (s.wave >= 2 && ((spawnIndex - 1) % 6 === 5 || isLast)) {
      return "heavy";
    }

    return "normal";
  }

  checkWaveComplete() {
    const s = this.scene;
    if (!s.waveActive || s.spawnedThisWave < s.enemiesThisWave || s.enemies.length > 0) {
      return;
    }

    const bonus = 24 + s.wave * 5;
    s.waveActive = false;
    s.defeatedWaves = Math.max(s.defeatedWaves, s.wave);
    s.gold += bonus;
    s.bestWave = Math.max(s.bestWave, s.wave);
    localStorage.setItem(STORAGE_KEYS.bestWave, String(s.bestWave));
    this.scene.heroSystem.recoverHeroes(0.38);

    if (s.wave >= s.totalWaves) {
      this.scene.hudSystem.finishVictorySequence();
      return;
    }

    this.scene.hudSystem.showNotice(`守住第 ${s.wave} 波 +${bonus}`, "#315c22");
    this.startPrepPhase(30);
  }
}
