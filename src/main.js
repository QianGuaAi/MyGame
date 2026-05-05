import Phaser from "phaser";
import "./styles.css";
import { GAME_HEIGHT, GAME_WIDTH } from "./data/map.js";
import { GameScene } from "./scenes/GameScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#87b866",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: GameScene,
};

new Phaser.Game(config);
