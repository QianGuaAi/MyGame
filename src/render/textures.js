export function createGameTextures(scene) {
  const graphics = scene.add.graphics();

  textureEnemyScout(graphics);
  textureEnemyBrute(graphics);
  textureGuard(graphics);
  textureArrow(graphics);
  textureTree(graphics);
  textureRock(graphics);
  textureShrub(graphics);
  textureDirtRoad(graphics);

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

function textureDirtRoad(graphics) {
    graphics.clear();
    graphics.fillStyle(0xa87542, 1);
    graphics.fillRect(0, 0, 64, 64);

    graphics.fillStyle(0xc0925d, 0.58);
    graphics.fillEllipse(15, 9, 24, 8);
    graphics.fillEllipse(48, 27, 28, 10);
    graphics.fillEllipse(22, 51, 30, 10);
    graphics.fillEllipse(56, 7, 16, 5);

    graphics.fillStyle(0x76512f, 0.38);
    graphics.fillEllipse(6, 34, 20, 7);
    graphics.fillEllipse(38, 6, 16, 5);
    graphics.fillEllipse(58, 54, 22, 7);
    graphics.fillEllipse(28, 32, 12, 4);

    graphics.fillStyle(0x57402a, 0.28);
    graphics.fillCircle(10, 16, 2);
    graphics.fillCircle(32, 22, 1.5);
    graphics.fillCircle(50, 43, 2);
    graphics.fillCircle(18, 58, 1.5);
    graphics.fillCircle(60, 18, 1.5);

    graphics.lineStyle(3, 0x6e4c2e, 0.24);
    graphics.lineBetween(0, 18, 18, 15);
    graphics.lineBetween(26, 17, 46, 14);
    graphics.lineBetween(52, 15, 64, 17);
    graphics.lineBetween(0, 45, 14, 47);
    graphics.lineBetween(22, 48, 44, 50);
    graphics.lineBetween(50, 49, 64, 47);

    graphics.lineStyle(1, 0xd4ad78, 0.22);
    graphics.lineBetween(2, 25, 20, 23);
    graphics.lineBetween(31, 22, 55, 24);
    graphics.lineBetween(3, 39, 17, 41);
    graphics.lineBetween(27, 40, 62, 39);

    graphics.generateTexture("dirt-road", 64, 64);
}
