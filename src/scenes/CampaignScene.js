import Phaser from "phaser";
import { CHAPTERS, getChapterById } from "../data/chapters.js";
import {
  CHAPTER_LEVEL_ORDERS,
  DEFAULT_LEVEL_ID,
  LEVELS,
  getChapterIndexOfLevel,
  getChapterLevelOrder,
  getLevelCompleteKey,
  isLevelCompleted,
} from "../data/levels.js";
import { GAME_HEIGHT, GAME_WIDTH, TEXT_STYLE } from "../data/map.js";
import { STORAGE_KEYS } from "../utils/storage.js";

// 每章 4 个节点的屏幕坐标（保持第 1 章原有布局）。
const NODE_POSITIONS = [
  { x: 178, y: 360 },
  { x: 392, y: 292 },
  { x: 620, y: 214 },
  { x: 794, y: 312 },
];

const NODE_LABELS = ["1", "2", "3", "BOSS"];

export class CampaignScene extends Phaser.Scene {
  constructor() {
    super("CampaignScene");
  }

  init(data = {}) {
    if (data.completedLevelId) {
      localStorage.setItem(getLevelCompleteKey(data.completedLevelId), "true");
    }

    // 兼容旧存档
    if (localStorage.getItem(STORAGE_KEYS.legacyChapter1Level1) === "true") {
      localStorage.setItem(getLevelCompleteKey(DEFAULT_LEVEL_ID), "true");
    }

    this.chapterIndex = this.resolveChapterIndex(data);
    this.chapter = getChapterById(this.chapterIndex);
    this.levels = this.buildLevelStates(this.chapterIndex);
    this.result = {
      score: data.score ?? Number(localStorage.getItem(STORAGE_KEYS.lastScore) || 0),
      gold: data.gold ?? 0,
      completedLevelId: data.completedLevelId ?? DEFAULT_LEVEL_ID,
    };
  }

  resolveChapterIndex(data) {
    if (typeof data.chapterIndex === "number") {
      return data.chapterIndex;
    }
    if (data.completedLevelId) {
      const finished = getChapterIndexOfLevel(data.completedLevelId);
      const order = getChapterLevelOrder(finished);
      const isChapterDone = order.every((id) => isLevelCompleted(id));
      return isChapterDone ? Math.min(finished + 1, CHAPTERS.length) : finished;
    }
    // 取最靠前的未通关章节
    for (let i = 1; i <= CHAPTERS.length; i += 1) {
      const order = getChapterLevelOrder(i);
      if (!order.every((id) => isLevelCompleted(id))) {
        return i;
      }
    }
    return CHAPTERS.length;
  }

  buildLevelStates(chapterIndex) {
    const order = getChapterLevelOrder(chapterIndex);
    const completedIds = new Set(order.filter((id) => isLevelCompleted(id)));
    const nextIndex = order.findIndex((id) => !completedIds.has(id));
    return order.map((id, index) => {
      const config = LEVELS[id] ?? {};
      const pos = NODE_POSITIONS[index] ?? NODE_POSITIONS[NODE_POSITIONS.length - 1];
      const isBoss = index === order.length - 1;
      return {
        id,
        label: isBoss ? "BOSS" : `${chapterIndex}-${NODE_LABELS[index]}`,
        name: config.name ?? id,
        x: pos.x,
        y: pos.y,
        status: completedIds.has(id) ? "completed" : index === nextIndex ? "next" : "locked",
      };
    });
  }

  preload() {
    CHAPTERS.forEach((chapter) => {
      if (!this.textures.exists(chapter.mapKey)) {
        this.load.image(chapter.mapKey, chapter.mapUrl);
      }
    });
  }

  create() {
    this.drawBackground();
    this.drawMapBoard();
    this.drawRoute();
    this.drawLevelNodes();
    this.drawHeader();
    this.drawFooter();
    this.createNotice();
  }

  drawBackground() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x2a3626).setOrigin(0);

    const mapKey = this.chapter?.mapKey;
    if (mapKey && this.textures.exists(mapKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, mapKey)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0.72);
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x241a0c, 0.28).setOrigin(0);
      return;
    }

    // Fallback：旧的程序化背景
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x527a50).setOrigin(0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xd1b56f, 0.18).setOrigin(0);
    const sky = this.add.graphics();
    sky.fillStyle(0x80a8bd, 1);
    sky.fillRect(0, 0, GAME_WIDTH, 72);
    sky.fillStyle(0xf4e1a6, 1);
    sky.fillRect(0, 56, GAME_WIDTH, 20);
    const sea = this.add.graphics();
    sea.fillStyle(0x4f8ca1, 1);
    sea.fillEllipse(880, 95, 240, 130);
    sea.fillEllipse(922, 440, 230, 190);
    this.drawMountains();
    this.drawForests();
    this.drawSettlements();
  }

  drawMapBoard() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 12, 888, 438, 0xf0d69a, 0.94)
      .setStrokeStyle(5, 0x70451f, 1);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 12, 860, 410, 0xcfa65f, 0.2)
      .setStrokeStyle(2, 0x9a6831, 0.38);

    const grain = this.add.graphics();
    grain.lineStyle(1, 0x8a5a26, 0.13);
    for (let y = 112; y < 470; y += 28) {
      grain.beginPath();
      grain.moveTo(58, y);
      grain.lineTo(902, y + Phaser.Math.Between(-7, 7));
      grain.strokePath();
    }
  }

  drawMountains() {
    const graphics = this.add.graphics();
    const mountains = [
      [88, 126, 58],
      [146, 114, 76],
      [216, 128, 54],
      [706, 116, 66],
      [770, 102, 82],
      [846, 124, 56],
    ];

    mountains.forEach(([x, y, size]) => {
      graphics.fillStyle(0x6b705d, 1);
      graphics.fillTriangle(x - size, y + size, x, y - size, x + size, y + size);
      graphics.fillStyle(0xf7efd3, 0.9);
      graphics.fillTriangle(x - size * 0.28, y - size * 0.4, x, y - size, x + size * 0.28, y - size * 0.4);
    });
  }

  drawForests() {
    const graphics = this.add.graphics();
    const groves = [
      [86, 404, 13],
      [250, 244, 17],
      [306, 406, 15],
      [486, 356, 18],
      [662, 388, 16],
      [812, 218, 12],
    ];

    groves.forEach(([x, y, count]) => {
      for (let i = 0; i < count; i += 1) {
        const treeX = x + Phaser.Math.Between(-50, 50);
        const treeY = y + Phaser.Math.Between(-34, 34);
        graphics.fillStyle(0x2f6639, 1);
        graphics.fillTriangle(treeX - 11, treeY + 10, treeX, treeY - 18, treeX + 11, treeY + 10);
        graphics.fillStyle(0x785225, 1);
        graphics.fillRect(treeX - 3, treeY + 8, 6, 14);
      }
    });
  }

  drawSettlements() {
    this.drawCastle(130, 172, 0.75, 0x8f6a43);
    this.drawCastle(770, 306, 1, 0x6d5542);
    this.drawCamp(342, 210);
    this.drawCamp(574, 392);
  }

  drawCastle(x, y, scale, color) {
    const parts = this.add.graphics();
    parts.fillStyle(color, 1);
    parts.fillRect(x - 34 * scale, y - 18 * scale, 68 * scale, 56 * scale);
    parts.fillRect(x - 48 * scale, y - 2 * scale, 26 * scale, 52 * scale);
    parts.fillRect(x + 22 * scale, y - 2 * scale, 26 * scale, 52 * scale);
    parts.fillStyle(0x4a2d17, 1);
    parts.fillTriangle(x - 48 * scale, y - 2 * scale, x - 35 * scale, y - 30 * scale, x - 22 * scale, y - 2 * scale);
    parts.fillTriangle(x + 22 * scale, y - 2 * scale, x + 35 * scale, y - 30 * scale, x + 48 * scale, y - 2 * scale);
    parts.fillRect(x - 9 * scale, y + 10 * scale, 18 * scale, 28 * scale);
  }

  drawCamp(x, y) {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xb63f2d, 1);
    graphics.fillTriangle(x - 26, y + 20, x, y - 22, x + 26, y + 20);
    graphics.fillStyle(0xf4d28a, 1);
    graphics.fillTriangle(x - 14, y + 20, x, y - 8, x + 14, y + 20);
    graphics.lineStyle(3, 0x5a361a, 1);
    graphics.lineBetween(x - 34, y + 22, x + 34, y + 22);
  }

  drawRoute() {
    const graphics = this.add.graphics();
    graphics.lineStyle(22, 0x5b391c, 0.34);
    this.strokeRoute(graphics);
    graphics.lineStyle(13, 0xb97831, 1);
    this.strokeRoute(graphics);
    graphics.lineStyle(4, 0xf5cf73, 0.82);
    this.strokeRoute(graphics);
  }

  strokeRoute(graphics) {
    graphics.beginPath();
    graphics.moveTo(this.levels[0].x, this.levels[0].y);
    this.levels.slice(1).forEach((level) => graphics.lineTo(level.x, level.y));
    graphics.strokePath();
  }

  drawLevelNodes() {
    this.levels.forEach((level) => {
      const isCompleted = level.status === "completed";
      const isNext = level.status === "next";
      const fill = isCompleted ? 0xf4c542 : isNext ? 0xe46c3b : 0x8a8a72;
      const stroke = isCompleted ? 0x7a4b25 : isNext ? 0x74321d : 0x565643;
      const node = this.add.container(level.x, level.y).setDepth(12);
      const shadow = this.add.ellipse(0, 24, 78, 20, 0x352414, 0.24);
      const circle = this.add.circle(0, 0, 32, fill, 1).setStrokeStyle(5, stroke, 1);
      const inner = this.add.circle(0, 0, 22, 0xffe6a1, isCompleted ? 0.9 : 0.28);
      const label = this.add.text(0, -1, level.label, {
        ...TEXT_STYLE,
        fontSize: level.label === "BOSS" ? "13px" : "18px",
        color: isCompleted || isNext ? "#3b250f" : "#e6dcc5",
        align: "center",
      }).setOrigin(0.5);
      const name = this.add.text(0, 48, level.name, {
        ...TEXT_STYLE,
        fontSize: "14px",
        color: "#3b250f",
        align: "center",
      }).setOrigin(0.5);

      node.add([shadow, circle, inner, label, name]);

      if (isCompleted) {
        node.add(this.createStars(0, -42));
      } else if (!isNext) {
        node.add(this.add.text(0, -42, "锁定", {
          ...TEXT_STYLE,
          fontSize: "12px",
          color: "#4c3a25",
        }).setOrigin(0.5));
      }

      node.setSize(100, 108);
      node.setInteractive(new Phaser.Geom.Rectangle(-50, -54, 100, 108), Phaser.Geom.Rectangle.Contains);
      node.on("pointerover", () => circle.setScale(1.08));
      node.on("pointerout", () => circle.setScale(1));
      node.on("pointerdown", () => this.handleLevelClick(level));
    });
  }

  createStars(x, y) {
    const stars = this.add.container(x, y);
    [-18, 0, 18].forEach((offset) => {
      stars.add(this.add.star(offset, 0, 5, 5, 10, 0xfff1a6, 1)
        .setStrokeStyle(2, 0x8a5a26, 1));
    });

    return stars;
  }

  drawHeader() {
    this.add.rectangle(GAME_WIDTH / 2, 48, 728, 62, 0x58361b, 0.92)
      .setStrokeStyle(4, 0xf2ca73, 1);
    const chapterName = this.chapter?.name ?? "未命名章节";
    this.add.text(GAME_WIDTH / 2, 33, `第${this.chapterIndex}章 ${chapterName}`, {
      ...TEXT_STYLE,
      fontSize: "27px",
      color: "#fff1bd",
      align: "center",
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 62, "完成当前节点后解锁下一关", {
      ...TEXT_STYLE,
      fontSize: "14px",
      color: "#f2d994",
      align: "center",
    }).setOrigin(0.5);

    // 章节切换按钮
    if (this.chapterIndex > 1) {
      this.createButton(88, 48, 110, 32, "← 上一章", () => this.switchChapter(this.chapterIndex - 1), {
        fill: 0x8d6b3c,
        stroke: 0x4b3415,
        color: "#fff1bd",
        hoverFill: 0xa58453,
      });
    }
    if (this.chapterIndex < CHAPTERS.length && this.isChapterUnlocked(this.chapterIndex + 1)) {
      this.createButton(872, 48, 110, 32, "下一章 →", () => this.switchChapter(this.chapterIndex + 1), {
        fill: 0x5a8645,
        stroke: 0x2f4a26,
        color: "#fff7d6",
        hoverFill: 0x6f9a58,
      });
    }
  }

  isChapterUnlocked(chapterIndex) {
    if (chapterIndex <= 1) return true;
    const prevOrder = getChapterLevelOrder(chapterIndex - 1);
    return prevOrder.every((id) => isLevelCompleted(id));
  }

  switchChapter(chapterIndex) {
    if (!this.isChapterUnlocked(chapterIndex)) {
      this.showNotice("该章节尚未解锁");
      return;
    }
    this.scene.restart({ chapterIndex });
  }

  drawFooter() {
    this.add.rectangle(GAME_WIDTH / 2, 504, 760, 52, 0x3c2814, 0.88)
      .setStrokeStyle(3, 0xc9964b, 1);
    this.add.text(126, 504, `战果  得分 ${this.result.score}`, {
      ...TEXT_STYLE,
      fontSize: "16px",
      color: "#fff1bd",
    }).setOrigin(0, 0.5);

    const order = getChapterLevelOrder(this.chapterIndex);
    const firstId = order[0];
    this.createButton(650, 504, 138, 34, `重玩 ${this.chapterIndex}-1`, () => this.scene.start("GameScene", { levelId: firstId }), {
      fill: 0xf5b83c,
      stroke: 0x89501f,
      color: "#3b250f",
      hoverFill: 0xffca55,
    });
    this.createButton(790, 504, 118, 34, "继续", () => this.startNextLevel(), {
      fill: 0x8fb76b,
      stroke: 0x4c7135,
      color: "#183111",
      hoverFill: 0xa0c77e,
    });
  }

  createButton(x, y, width, height, label, onClick, options = {}) {
    const fill = options.fill ?? 0xe7c980;
    const hoverFill = options.hoverFill ?? 0xf0d894;
    const stroke = options.stroke ?? 0x8a5a26;
    const color = options.color ?? "#3a2816";
    const bg = this.add.rectangle(0, 0, width, height, fill, 1)
      .setStrokeStyle(3, stroke, 1);
    const highlight = this.add.rectangle(0, -height / 2 + 5, width - 12, 4, 0xfff1bb, 0.35);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: height <= 30 ? "13px" : "15px",
      color,
      align: "center",
    }).setOrigin(0.5);
    const button = this.add.container(x, y, [bg, highlight, text]).setDepth(20);

    button.setSize(width, height);
    button.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
    button.on("pointerover", () => bg.setFillStyle(hoverFill, 1));
    button.on("pointerout", () => bg.setFillStyle(fill, 1));
    button.on("pointerdown", onClick);

    return button;
  }

  createNotice() {
    this.noticeText = this.add.text(GAME_WIDTH / 2, 454, "", {
      ...TEXT_STYLE,
      fontSize: "17px",
      color: "#fff1bd",
      align: "center",
      backgroundColor: "#3c2814",
      padding: { x: 12, y: 7 },
    }).setOrigin(0.5).setDepth(30).setAlpha(0);
  }

  handleLevelClick(level) {
    if (level.status === "completed" || level.status === "next") {
      this.scene.start("GameScene", { levelId: level.id });
      return;
    }

    this.showNotice("需先通关上一关");
  }

  startNextLevel() {
    const next = this.levels.find((level) => level.status === "next");
    if (next) {
      this.scene.start("GameScene", { levelId: next.id });
      return;
    }

    // 当前章节已全部完成；若有下一章且已解锁，则切换
    if (this.chapterIndex < CHAPTERS.length && this.isChapterUnlocked(this.chapterIndex + 1)) {
      this.switchChapter(this.chapterIndex + 1);
      return;
    }

    this.showNotice(`第${this.chapterIndex}章已全部完成`);
  }

  showNotice(message) {
    this.tweens.killTweensOf(this.noticeText);
    this.noticeText.setText(message).setAlpha(1);
    this.tweens.add({
      targets: this.noticeText,
      alpha: 0,
      delay: 900,
      duration: 450,
    });
  }
}
