export function createGameTextures(scene) {
  const graphics = scene.add.graphics();

  textureEnemyScout(graphics);
  textureEnemyBrute(graphics);
  textureTowerArrow(graphics);
  textureTowerMage(graphics);
  textureTowerBarracks(graphics);
  textureTowerArtillery(graphics);
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

function textureTowerArrow(graphics) {
    graphics.clear();
    graphics.fillStyle(0x6f4522, 1);
    graphics.fillRoundedRect(12, 22, 32, 28, 5);
    graphics.fillStyle(0xb66d31, 1);
    graphics.fillTriangle(8, 24, 28, 5, 48, 24);
    graphics.fillStyle(0xe3b05f, 1);
    graphics.fillRect(24, 20, 8, 28);
    graphics.lineStyle(3, 0x382515, 1);
    graphics.strokeTriangle(8, 24, 28, 5, 48, 24);
    graphics.lineStyle(3, 0xf4d28a, 1);
    graphics.lineBetween(18, 31, 38, 31);
    graphics.generateTexture("tower-arrow", 56, 56);
}

function textureTowerMage(graphics) {
    graphics.clear();
    graphics.fillStyle(0x6f6e86, 1);
    graphics.fillRoundedRect(13, 22, 30, 28, 6);
    graphics.fillStyle(0x4e4968, 1);
    graphics.fillRect(18, 28, 20, 22);
    graphics.fillStyle(0x8d5cff, 1);
    graphics.fillTriangle(28, 3, 14, 28, 42, 28);
    graphics.fillStyle(0xe7d7ff, 0.95);
    graphics.fillTriangle(28, 8, 22, 25, 34, 25);
    graphics.lineStyle(3, 0x302842, 1);
    graphics.strokeTriangle(28, 3, 14, 28, 42, 28);
    graphics.generateTexture("tower-mage", 56, 56);
}

function textureTowerBarracks(graphics) {
    graphics.clear();
    graphics.fillStyle(0x7b5634, 1);
    graphics.fillRoundedRect(8, 24, 42, 27, 5);
    graphics.fillStyle(0x4f8b3a, 1);
    graphics.fillTriangle(5, 26, 29, 6, 53, 26);
    graphics.fillStyle(0xd6a35a, 1);
    graphics.fillRect(25, 34, 9, 17);
    graphics.fillStyle(0xffdf82, 1);
    graphics.fillRect(14, 30, 9, 8);
    graphics.lineStyle(3, 0x3e2a1a, 1);
    graphics.strokeTriangle(5, 26, 29, 6, 53, 26);
    graphics.generateTexture("tower-barracks", 58, 58);
}

function textureTowerArtillery(graphics) {
    graphics.clear();
    graphics.fillStyle(0x5d5a52, 1);
    graphics.fillRoundedRect(13, 28, 32, 21, 6);
    graphics.fillStyle(0x373833, 1);
    graphics.fillEllipse(30, 26, 34, 20);
    graphics.fillStyle(0x242620, 1);
    graphics.fillEllipse(30, 25, 18, 10);
    graphics.fillStyle(0xffb74d, 1);
    graphics.fillCircle(39, 19, 5);
    graphics.lineStyle(3, 0x2a2925, 1);
    graphics.strokeRoundedRect(13, 28, 32, 21, 6);
    graphics.generateTexture("tower-artillery", 58, 56);
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
