import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, TEXT_STYLE } from "../data/map.js";
import { STORAGE_KEYS } from "../utils/storage.js";

export class SplashScene extends Phaser.Scene {
  constructor() {
    super("SplashScene");
  }

  preload() {
    this.load.on("loaderror", () => {});
    if (!this.textures.exists("splash-main")) {
      this.load.image("splash-main", new URL("../assets/splash/splash-main.png", import.meta.url).href);
    }
  }

  create() {
    const hasSplash = this.textures.exists("splash-main");

    if (hasSplash) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "splash-main")
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(0);
      this.tweens.add({ targets: bg, alpha: 1, duration: 600, ease: "Sine.easeIn" });
    } else {
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a120a).setOrigin(0);
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "王冠前哨", {
        ...TEXT_STYLE,
        fontSize: "56px",
        color: "#f5d98a",
      }).setOrigin(0.5);
    }

    const prompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 72, "按任意键 / 点击开始", {
      ...TEXT_STYLE,
      fontSize: "18px",
      color: "#f0d8a8",
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: prompt,
      alpha: 1,
      duration: 400,
      delay: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const advance = () => this.startNext();
    this.input.once("pointerdown", advance);
    this.input.keyboard?.once("keydown", advance);
  }

  startNext() {
    const introSeen = localStorage.getItem(STORAGE_KEYS.introComicSeen) === "true";
    this.scene.start(introSeen ? "CampaignScene" : "IntroComicScene");
  }
}
