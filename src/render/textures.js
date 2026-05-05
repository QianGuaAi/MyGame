export function createGameTextures(scene) {
  const graphics = scene.add.graphics();

  textureEnemyScout(graphics);
  textureEnemyBrute(graphics);
  textureGuard(graphics);
  textureArrow(graphics);
  textureTree(graphics);
  textureRock(graphics);
  textureShrub(graphics);

  graphics.destroy();
}

function textureEnemyScout(graphics) {
    graphics.clear();
    graphics.fillStyle(0x39582d, 1);
    graphics.fillRoundedRect(3, 8, 34, 22, 8);
    graphics.fillStyle(0x78a948, 1);
    graphics.fillCircle(29, 13, 10);
    graphics.fillStyle(0xf3d49b, 1);
    graphics.fillCircle(32, 13, 3);
    graphics.fillStyle(0x2a281d, 1);
    graphics.fillCircle(35, 11, 2);
    graphics.lineStyle(3, 0x4d3422, 1);
    graphics.lineBetween(9, 28, 6, 36);
    graphics.lineBetween(26, 29, 24, 37);
    graphics.generateTexture("enemy-scout", 42, 40);
}

function textureEnemyBrute(graphics) {
    graphics.clear();
    graphics.fillStyle(0x6a4a34, 1);
    graphics.fillRoundedRect(2, 9, 44, 28, 9);
    graphics.fillStyle(0x9c7852, 1);
    graphics.fillCircle(35, 16, 12);
    graphics.fillStyle(0xd7c0a3, 1);
    graphics.fillCircle(39, 15, 3);
    graphics.fillStyle(0x2b2118, 1);
    graphics.fillCircle(42, 13, 2);
    graphics.lineStyle(5, 0x4b3629, 1);
    graphics.lineBetween(12, 36, 10, 45);
    graphics.lineBetween(32, 37, 31, 46);
    graphics.generateTexture("enemy-brute", 52, 48);
}

function textureGuard(graphics) {
    graphics.clear();
    graphics.fillStyle(0x244972, 1);
    graphics.fillRoundedRect(9, 14, 14, 18, 5);
    graphics.fillStyle(0xf1c27d, 1);
    graphics.fillCircle(16, 10, 7);
    graphics.fillStyle(0xc8d3da, 1);
    graphics.fillRect(7, 16, 5, 12);
    graphics.lineStyle(3, 0x5f3c20, 1);
    graphics.lineBetween(24, 15, 30, 6);
    graphics.generateTexture("guard", 34, 36);
}

function textureArrow(graphics) {
    graphics.clear();
    graphics.fillStyle(0xf1d08a, 1);
    graphics.fillRect(2, 5, 28, 3);
    graphics.fillTriangle(30, 2, 38, 7, 30, 12);
    graphics.fillStyle(0x7a4a21, 1);
    graphics.fillTriangle(2, 0, 8, 6, 2, 12);
    graphics.generateTexture("arrow-shot", 40, 14);
}

function textureTree(graphics) {
    graphics.clear();
    graphics.fillStyle(0x795032, 1);
    graphics.fillRoundedRect(20, 30, 9, 20, 4);
    graphics.fillStyle(0x2f6b34, 1);
    graphics.fillCircle(16, 28, 16);
    graphics.fillCircle(32, 26, 18);
    graphics.fillCircle(25, 15, 17);
    graphics.fillStyle(0x4f8b3a, 0.82);
    graphics.fillCircle(20, 20, 9);
    graphics.generateTexture("tree", 54, 56);
}

function textureRock(graphics) {
    graphics.clear();
    graphics.fillStyle(0x8c8a7e, 1);
    graphics.fillEllipse(24, 24, 38, 24);
    graphics.fillStyle(0xb9b5a6, 0.75);
    graphics.fillEllipse(17, 19, 15, 9);
    graphics.lineStyle(2, 0x656257, 1);
    graphics.strokeEllipse(24, 24, 38, 24);
    graphics.generateTexture("rock", 48, 42);
}

function textureShrub(graphics) {
    graphics.clear();
    graphics.fillStyle(0x5f9b48, 1);
    graphics.fillCircle(12, 18, 10);
    graphics.fillCircle(24, 14, 12);
    graphics.fillCircle(34, 20, 10);
    graphics.fillStyle(0xffd166, 0.95);
    graphics.fillCircle(26, 12, 2);
    graphics.generateTexture("shrub", 46, 34);
}
