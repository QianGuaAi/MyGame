import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, PANEL_X, buildPathSegments } from "../data/map.js";
import { STORAGE_KEYS } from "../utils/storage.js";
import { EASTER_EGGS } from "../data/easterEggs.js";

/**
 * 地图系统：路径 / 出生车道 / 地形 / 装饰 / 彩蛋 / 塔基座槽。
 * 状态依然存放在 scene 上（this.scene.spawnLanes / pathPoints / pathSegments / pathLength / slots / easterEggObjects / claimedEasterEggs ...）。
 */
export class MapSystem {
  constructor(scene) {
    this.scene = scene;
  }

  // ---------- 出生车道 / 路径采样 ----------

  buildSpawnLanes(layout) {
    const lanePoints = Array.isArray(layout.spawnLanes) && layout.spawnLanes.length > 0
      ? layout.spawnLanes
      : [layout.pathPoints];

    return lanePoints.map((points, index) => {
      const segments = buildPathSegments(points);
      const length = segments.length > 0 ? segments[segments.length - 1].end : 0;
      return { id: index, points, segments, length };
    });
  }

  getSpawnLane(laneId = 0) {
    const s = this.scene;
    if (!s.spawnLanes || s.spawnLanes.length === 0) {
      return {
        id: 0,
        points: s.pathPoints,
        segments: s.pathSegments,
        length: s.pathLength,
      };
    }
    return s.spawnLanes[laneId] ?? s.spawnLanes[0];
  }

  pointOnSegments(segments, distance) {
    if (!segments || segments.length === 0) {
      return { x: 0, y: 0, angle: 0 };
    }
    const total = segments[segments.length - 1].end;
    const clamped = Math.max(0, Math.min(distance, total));
    const segment = segments.find((item) => clamped <= item.end) || segments[segments.length - 1];
    const t = segment.length === 0 ? 0 : (clamped - segment.start) / segment.length;

    return {
      x: segment.from.x + (segment.to.x - segment.from.x) * t,
      y: segment.from.y + (segment.to.y - segment.from.y) * t,
      angle: segment.angle,
    };
  }

  pointOnSpawnLane(laneId, distance) {
    const lane = this.getSpawnLane(laneId);
    return this.pointOnSegments(lane.segments, distance);
  }

  nextSpawnLaneId() {
    const s = this.scene;
    if (!s.spawnLanes || s.spawnLanes.length <= 1) {
      return 0;
    }
    const laneId = s.spawnLaneCursor % s.spawnLanes.length;
    s.spawnLaneCursor += 1;
    return laneId;
  }

  // ---------- 地图绘制 ----------

  createMap() {
    const s = this.scene;
    const key = s.layout.backgroundKey;
    if (s.textures.exists(key)) {
      const bg = s.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setDepth(0);
      s.mapBackground = bg;
    } else {
      s.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x2c2118).setOrigin(0).setDepth(0);
    }
    s.mapObstacles = [];
  }

  drawTerrainPatches() {
    const s = this.scene;
    const graphics = s.add.graphics();

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
    const s = this.scene;
    const graphics = s.add.graphics();

    this.strokePath(graphics, 70, 0x5f4a2f, 0.28);
    this.strokePath(graphics, 58, 0x7d633b, 0.62);
    this.drawDirtRoadTexture(44);
    this.drawRaggedRoadEdges(graphics, 44);

    graphics.lineStyle(4, 0x6f4b2d, 0.28);
    s.pathSegments.forEach((segment) => {
      const offset = segment.angle === 0 || Math.abs(segment.angle) === Math.PI ? 12 : 0;
      const sideOffset = segment.angle === Math.PI / 2 || segment.angle === -Math.PI / 2 ? 12 : 0;
      graphics.lineBetween(segment.from.x + sideOffset, segment.from.y + offset, segment.to.x + sideOffset, segment.to.y + offset);
      graphics.lineBetween(segment.from.x - sideOffset, segment.from.y - offset, segment.to.x - sideOffset, segment.to.y - offset);
    });

    graphics.fillStyle(0x5f4329, 0.24);
    s.pathSegments.forEach((segment) => {
      const count = Math.max(2, Math.floor(segment.length / 70));

      for (let i = 0; i < count; i += 1) {
        const t = (i + 0.45) / count;
        const x = Phaser.Math.Linear(segment.from.x, segment.to.x, t);
        const y = Phaser.Math.Linear(segment.from.y, segment.to.y, t);
        graphics.fillEllipse(x, y, 18, 7);
      }
    });

    graphics.fillStyle(0x6f9d4f, 0.32);
    s.pathSegments.forEach((segment) => {
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
    const s = this.scene;
    s.pathSegments.forEach((segment, segmentIndex) => {
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

    s.pathPoints.forEach(([x, y], index) => {
      if (index === 0 || index === s.pathPoints.length - 1) {
        return;
      }

      graphics.fillStyle(0xb1824d, 0.42);
      graphics.fillEllipse(x + Phaser.Math.Between(-12, 12), y + Phaser.Math.Between(-12, 12), 32, 18);
      graphics.fillStyle(0x7fab5a, 0.28);
      graphics.fillEllipse(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-20, 20), 42, 14);
    });
  }

  drawDirtRoadTexture(width) {
    const s = this.scene;
    s.pathSegments.forEach((segment) => {
      const horizontal = Math.abs(segment.to.y - segment.from.y) < 1;
      const x = (segment.from.x + segment.to.x) / 2;
      const y = (segment.from.y + segment.to.y) / 2;
      const roadWidth = horizontal ? segment.length + width : width;
      const roadHeight = horizontal ? width : segment.length + width;
      s.add.tileSprite(x, y, roadWidth, roadHeight, "dirt-road")
        .setDepth(1.5);
    });

    s.pathPoints.forEach(([x, y]) => {
      s.add.tileSprite(x, y, width, width, "dirt-road")
        .setDepth(1.5)
        .setMask(this.createCircleMask(x, y, width / 2));
    });
  }

  createCircleMask(x, y, radius) {
    const shape = this.scene.make.graphics({ x: 0, y: 0, add: false });
    shape.fillStyle(0xffffff, 1);
    shape.fillCircle(x, y, radius);
    return shape.createGeometryMask();
  }

  strokePath(graphics, width, color, alpha) {
    const s = this.scene;
    graphics.lineStyle(width, color, alpha);
    graphics.beginPath();
    graphics.moveTo(s.pathPoints[0][0], s.pathPoints[0][1]);
    s.pathPoints.slice(1).forEach(([x, y]) => graphics.lineTo(x, y));
    graphics.strokePath();
    graphics.fillStyle(color, alpha);
    s.pathPoints.forEach(([x, y]) => graphics.fillCircle(x, y, width / 2));
  }

  placeDecorations() {
    this.scene.mapObstacles = [];
  }

  // ---------- 彩蛋 ----------

  createEasterEggs() {
    const s = this.scene;
    s.easterEggObjects = [];

    EASTER_EGGS.forEach((egg) => {
      if (egg.virtual) {
        return;
      }

      if (s.claimedEasterEggs.has(egg.id)) {
        return;
      }

      const marker = s.add.circle(egg.x, egg.y, 8, egg.fragment ? 0xdedcff : 0xf6c453, 0.9)
        .setStrokeStyle(2, 0x6b4a22, 0.8)
        .setDepth(8)
        .setInteractive({ useHandCursor: true });
      const sparkle = s.add.star(egg.x + 10, egg.y - 9, 5, 3, 6, 0xfff3bd, 0.85)
        .setDepth(8)
        .setInteractive({ useHandCursor: true });
      const claim = () => this.claimEasterEgg(egg, [marker, sparkle]);

      marker.on("pointerdown", claim);
      sparkle.on("pointerdown", claim);
      s.tweens.add({
        targets: sparkle,
        angle: 360,
        duration: 1800,
        repeat: -1,
      });
      s.easterEggObjects.push(marker, sparkle);
    });
  }

  claimEasterEgg(egg, objects) {
    const s = this.scene;
    if (s.claimedEasterEggs.has(egg.id)) {
      return;
    }

    s.claimedEasterEggs.add(egg.id);
    this.saveClaimedEasterEggs();
    objects.forEach((item) => item.destroy());

    if (egg.fragment) {
      this.scene.economySystem.addBlueprintFragment();
      this.scene.hudSystem.showNotice(`${egg.label}：图纸碎片 +1`, "#5a4ba6");
    } else {
      s.gold += egg.reward;
      this.scene.hudSystem.showNotice(`${egg.label}：金币 +${egg.reward}`, "#315c22");
    }

    this.scene.hudSystem.updateUi();
  }

  loadClaimedEasterEggs() {
    const oldKey = STORAGE_KEYS.easterEggsLegacy;
    const newKey = STORAGE_KEYS.easterEggsV2;
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
    const s = this.scene;
    const oldKey = STORAGE_KEYS.easterEggsLegacy;
    const newKey = STORAGE_KEYS.easterEggsV2;
    const claimed = [...s.claimedEasterEggs];

    localStorage.setItem(newKey, JSON.stringify({ 0: claimed }));
    localStorage.setItem(oldKey, JSON.stringify(claimed));
  }

  // ---------- 塔基座 ----------

  createSlots() {
    const s = this.scene;
    s.slots = s.layout.towerSlots.map(([x, y], index) => {
      const platform = s.add.ellipse(x, y, 54, 36, 0x5a4028, 0)
        .setStrokeStyle(4, 0x2f2415, 0)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });
      const inner = s.add.ellipse(x, y + 1, 38, 22, 0x2d261d, 0)
        .setStrokeStyle(2, 0x9d7a4c, 0)
        .setDepth(6)
        .setInteractive({ useHandCursor: true });
      const rim = s.add.ellipse(x - 5, y - 7, 34, 9, 0xc7a36d, 0.24)
        .setFillStyle(0xc7a36d, 0)
        .setDepth(6.1)
        .setInteractive({ useHandCursor: true });
      const slot = { index, x, y, platform, inner, rim, tower: null };
      const click = () => this.scene.hudSystem.handleSlotClick(slot);

      [platform, inner, rim].forEach((item) => {
        item.on("pointerover", () => this.scene.towerSystem.previewBuildRange(slot));
        item.on("pointerout", () => this.scene.towerSystem.clearHoverRange(slot));
        item.on("pointerdown", click);
      });

      return slot;
    });
  }
}
