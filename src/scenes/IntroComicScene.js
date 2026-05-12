import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, TEXT_STYLE } from "../data/map.js";
import { STORAGE_KEYS } from "../utils/storage.js";

const INTRO_SEEN_KEY = STORAGE_KEYS.introComicSeen;

const PANELS = [
  {
    title: "发现小岛",
    caption: "有一天，我们发现了一座非常大的小岛。",
    narration: "远处的海雾散开，一片陌生土地露了出来。大家决定登岛看看。",
  },
  {
    title: "登岛相遇",
    caption: "刚上岛，我们就遇到了岛上的生物。",
    narration: "它们守着林地和道路，看起来并不欢迎外来者。",
  },
  {
    title: "买地发展",
    caption: "我们想买一片地发展，于是去问它们的首领。",
    narration: "首领收下金币，答应把前哨旁的土地卖给我们。",
  },
  {
    title: "突袭爆发",
    caption: "没想到刚交完钱，大量敌军就袭击了我们。",
    narration: "我们不仅大亏一笔，还死了十几个人。自此，一场大战一触即发。",
  },
];

export class IntroComicScene extends Phaser.Scene {
  constructor() {
    super("IntroComicScene");
  }

  create() {
    if (localStorage.getItem(INTRO_SEEN_KEY) === "true") {
      this.scene.start("GameScene");
      return;
    }

    this.panelIndex = 0;
    this.drawBase();
    this.drawPanel();
  }

  drawBase() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xf2dfb1).setOrigin(0);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 42, GAME_HEIGHT - 38, 0xfff4cf, 1)
      .setStrokeStyle(5, 0x3c2814, 1);

    this.add.text(44, 26, "开篇剧情", {
      ...TEXT_STYLE,
      fontSize: "24px",
      color: "#2f2114",
    }).setDepth(5);

    this.panelLayer = this.add.container(0, 0);
    this.pageText = this.add.text(GAME_WIDTH - 44, 30, "", {
      ...TEXT_STYLE,
      fontSize: "15px",
      color: "#5d3c20",
    }).setOrigin(1, 0).setDepth(5);

    this.nextButton = this.createButton(GAME_WIDTH - 116, GAME_HEIGHT - 38, 126, 34, "下一格", () => this.nextPanel());
    this.skipButton = this.createButton(100, GAME_HEIGHT - 38, 112, 34, "跳过", () => this.finishIntro());

    this.input.keyboard?.on("keydown-SPACE", () => this.nextPanel());
    this.input.keyboard?.on("keydown-ENTER", () => this.nextPanel());
  }

  drawPanel() {
    this.panelLayer.removeAll(true);
    const panel = PANELS[this.panelIndex];
    this.pageText.setText(`${this.panelIndex + 1}/${PANELS.length}`);
    this.nextButton.label.setText(this.panelIndex === PANELS.length - 1 ? "开始战斗" : "下一格");

    const x = 64;
    const y = 70;
    const width = GAME_WIDTH - 128;
    const height = 334;
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRoundedRect(x, y, width, height, 8);
    graphics.lineStyle(5, 0x2e2116, 1);
    graphics.strokeRoundedRect(x, y, width, height, 8);
    this.panelLayer.add(graphics);

    this.drawComicArt(panel, x, y, width, height);

    const captionBox = this.add.rectangle(GAME_WIDTH / 2, 438, GAME_WIDTH - 128, 76, 0xfff9e4, 1)
      .setStrokeStyle(3, 0x7a4b25, 1);
    const title = this.add.text(82, 412, panel.title, {
      ...TEXT_STYLE,
      fontSize: "22px",
      color: "#3b250f",
    });
    const caption = this.add.text(82, 444, `${panel.caption}\n${panel.narration}`, {
      ...TEXT_STYLE,
      fontSize: "15px",
      color: "#3a2816",
      lineSpacing: 5,
      wordWrap: { width: GAME_WIDTH - 170, useAdvancedWrap: true },
    });

    this.panelLayer.add([captionBox, title, caption]);
  }

  drawComicArt(panel, x, y, width, height) {
    const art = this.add.graphics();
    this.panelLayer.add(art);

    art.fillStyle(0xaad7e8, 1);
    art.fillRect(x + 4, y + 4, width - 8, height * 0.45);
    art.fillStyle(0x4f8ca1, 1);
    art.fillRect(x + 4, y + height * 0.42, width - 8, height * 0.54);
    art.fillStyle(0x6fb76a, 1);
    art.fillEllipse(x + width * 0.62, y + height * 0.56, 310, 138);
    art.fillEllipse(x + width * 0.72, y + height * 0.5, 210, 96);
    art.fillStyle(0xc79a54, 1);
    art.fillEllipse(x + width * 0.65, y + height * 0.6, 270, 96);

    if (this.panelIndex === 0) {
      this.drawBoat(x + 118, y + 232);
      this.drawSpeech(x + 248, y + 88, "那是一座大岛！");
    } else if (this.panelIndex === 1) {
      this.drawHeroGroup(x + 168, y + 242);
      this.drawIslandCreatures(x + 540, y + 238);
      this.drawSpeech(x + 452, y + 84, "外来者，停下。");
    } else if (this.panelIndex === 2) {
      this.drawHeroGroup(x + 160, y + 246);
      this.drawChief(x + 570, y + 228);
      this.drawCoinStack(x + 348, y + 268);
      this.drawSpeech(x + 408, y + 88, "我们想买一片地。");
    } else {
      this.drawHeroGroup(x + 180, y + 252);
      this.drawEnemyWave(x + 520, y + 238);
      this.drawExplosion(x + 346, y + 212);
      this.drawSpeech(x + 398, y + 82, "敌军来了！");
    }
  }

  drawBoat(x, y) {
    const g = this.add.graphics();
    g.fillStyle(0x7a4b25, 1);
    g.fillTriangle(x - 82, y + 8, x + 82, y + 8, x + 48, y + 38);
    g.fillStyle(0xf3dfaa, 1);
    g.fillTriangle(x - 8, y - 100, x - 8, y + 6, x + 58, y - 24);
    g.lineStyle(4, 0x4a2d17, 1);
    g.lineBetween(x - 8, y - 102, x - 8, y + 12);
    this.panelLayer.add(g);
  }

  drawHeroGroup(x, y) {
    ["#355b82", "#784c22", "#7a63c8"].forEach((color, index) => {
      const cx = x + index * 38;
      const body = this.add.circle(cx, y, 16, Phaser.Display.Color.HexStringToColor(color).color, 1)
        .setStrokeStyle(3, 0x2f2114, 1);
      const head = this.add.circle(cx, y - 22, 11, 0xf1c27d, 1)
        .setStrokeStyle(2, 0x2f2114, 1);
      this.panelLayer.add([body, head]);
    });
  }

  drawIslandCreatures(x, y) {
    [0, 42, 84].forEach((offset) => {
      const body = this.add.ellipse(x + offset, y, 34, 24, 0x39582d, 1)
        .setStrokeStyle(3, 0x263d22, 1);
      const eye = this.add.circle(x + offset + 10, y - 5, 4, 0xf3d49b, 1);
      this.panelLayer.add([body, eye]);
    });
  }

  drawChief(x, y) {
    const body = this.add.ellipse(x, y, 58, 42, 0x6a4a34, 1).setStrokeStyle(4, 0x382619, 1);
    const crown = this.add.triangle(x, y - 36, -24, 12, 0, -18, 24, 12, 0xffcf45, 1)
      .setStrokeStyle(2, 0x7a4b25, 1);
    this.panelLayer.add([body, crown]);
  }

  drawCoinStack(x, y) {
    [0, 14, 28].forEach((offset) => {
      const coin = this.add.ellipse(x + offset, y - offset * 0.4, 22, 12, 0xffcf45, 1)
        .setStrokeStyle(2, 0x8a5a26, 1);
      this.panelLayer.add(coin);
    });
  }

  drawEnemyWave(x, y) {
    for (let i = 0; i < 8; i += 1) {
      const cx = x + (i % 4) * 42;
      const cy = y + Math.floor(i / 4) * 40;
      const enemy = this.add.ellipse(cx, cy, 36, 24, i % 3 === 0 ? 0x6a4a34 : 0x39582d, 1)
        .setStrokeStyle(3, 0x2d2118, 1);
      this.panelLayer.add(enemy);
    }
  }

  drawExplosion(x, y) {
    const blast = this.add.star(x, y, 9, 22, 58, 0xffc34f, 1)
      .setStrokeStyle(4, 0xb43b2f, 1);
    this.panelLayer.add(blast);
  }

  drawSpeech(x, y, text) {
    const bubble = this.add.rectangle(x, y, 190, 52, 0xffffff, 1)
      .setStrokeStyle(3, 0x2e2116, 1);
    const label = this.add.text(x, y, text, {
      ...TEXT_STYLE,
      fontSize: "16px",
      color: "#2e2116",
      align: "center",
    }).setOrigin(0.5);
    this.panelLayer.add([bubble, label]);
  }

  nextPanel() {
    if (this.panelIndex >= PANELS.length - 1) {
      this.finishIntro();
      return;
    }
    this.panelIndex += 1;
    this.drawPanel();
  }

  finishIntro() {
    localStorage.setItem(INTRO_SEEN_KEY, "true");
    this.scene.start("GameScene");
  }

  createButton(x, y, width, height, label, onClick) {
    const bg = this.add.rectangle(0, 0, width, height, 0xe7c980, 1)
      .setStrokeStyle(3, 0x8a5a26, 1);
    const text = this.add.text(0, 0, label, {
      ...TEXT_STYLE,
      fontSize: "15px",
      color: "#3a2816",
      align: "center",
    }).setOrigin(0.5);
    const button = this.add.container(x, y, [bg, text]).setDepth(10);
    button.label = text;
    button.setSize(width, height);
    button.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
    button.on("pointerover", () => bg.setFillStyle(0xf0d894, 1));
    button.on("pointerout", () => bg.setFillStyle(0xe7c980, 1));
    button.on("pointerdown", onClick);
    return button;
  }
}
