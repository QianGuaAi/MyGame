import Phaser from "phaser";
import { TOWER_TYPES, TOWER_BUTTON_ORDER } from "../data/towers.js";
import { GAME_HEIGHT, GAME_WIDTH, PANEL_X, TEXT_STYLE } from "../data/map.js";
import { STORAGE_KEYS } from "../utils/storage.js";
import { getLevelCompleteKey, isChapterFinalLevel, isWildMerchantLevel } from "../data/levels.js";

/**
 * HUD 系统：顶部 HUD / 准备期提示 / 建造菜单 / 通用按钮 / 模态框 / 通知 / 结束界面。
 * 状态依然存放在 scene 上（this.scene.hudText / buildMenu / modalObjects / endOverlay ...）。
 */
export class HudSystem {
  constructor(scene) {
    this.scene = scene;
  }

  // ---------- 构建 HUD ----------

  createUi() {
    const s = this.scene;
    s.hudBox = s.add.rectangle(20, 14, GAME_WIDTH - 40, 42, 0xf6e2a9, 0.93)
      .setOrigin(0)
      .setStrokeStyle(3, 0x7a4b25, 0.92)
      .setDepth(30);
    s.hudText = s.add.text(34, 24, "", {
      ...TEXT_STYLE,
      fontSize: "13px",
      color: "#352415",
      lineSpacing: 2,
    }).setDepth(31);

    s.noticeText = s.add.text(GAME_WIDTH / 2, 516, "", {
      ...TEXT_STYLE,
      fontSize: "18px",
      color: "#6d2e18",
      align: "center",
    }).setOrigin(0.5).setDepth(30).setAlpha(0);

    s.prepBox = s.add.rectangle(GAME_WIDTH / 2, 76, 360, 40, 0xf6e2a9, 0.94)
      .setStrokeStyle(2, 0x7a4b25, 0.92)
      .setDepth(30)
      .setVisible(false);
    s.prepText = s.add.text(GAME_WIDTH / 2, 76, "", {
      ...TEXT_STYLE,
      fontSize: "14px",
      color: "#4a2d17",
      align: "center",
    }).setOrigin(0.5).setDepth(31).setVisible(false);

    this.scene.heroSystem.createHeroPortraits();

    s.add.text(PANEL_X + 24, 24, "王冠前哨", {
      ...TEXT_STYLE,
      fontSize: "24px",
      color: "#4a2d17",
    }).setDepth(30).setVisible(false);

    s.pauseButton = this.createButton(GAME_WIDTH - 44, 30, 54, 26, "", () => this.togglePause(), {
      fill: 0xe7c980,
      stroke: 0x8a5a26,
      color: "#3a2816",
      hoverFill: 0xf0d894,
    });

    s.startButton = this.createButton(GAME_WIDTH - 170, 30, 112, 34, "", () => this.scene.waveSystem.handleStartButton(), {
      fill: 0xc64c35,
      stroke: 0x74301f,
      color: "#fff6d8",
      hoverFill: 0xd95f42,
    });

    s.equipmentButton = this.createButton(GAME_WIDTH - 340, 30, 74, 30, "装备", () => this.scene.economySystem.openEquipmentShop(), {
      fill: 0x6f8dbd,
      stroke: 0x2d4978,
      color: "#fff6d8",
      hoverFill: 0x7fa0d2,
    });

    s.inventoryButton = this.createButton(GAME_WIDTH - 260, 30, 74, 30, "背包", () => this.scene.economySystem.openInventory(), {
      fill: 0x8fb76b,
      stroke: 0x4c7135,
      color: "#183111",
      hoverFill: 0xa0c77e,
    });

    s.add.text(PANEL_X + 24, 136, "建造", {
      ...TEXT_STYLE,
      fontSize: "15px",
      color: "#70451f",
    }).setDepth(30).setVisible(false);

    s.towerButtons = TOWER_BUTTON_ORDER.map((key, index) => {
      const tower = TOWER_TYPES[key];
      const y = 164 + index * 34;
      const button = this.createButton(PANEL_X + 101, y, 154, 28, `${tower.name}  ${tower.price}`, () => this.selectBuildType(key), {
        fill: 0xe7c980,
        stroke: 0x8a5a26,
        color: "#3a2816",
        hoverFill: 0xf0d894,
      });
      const icon = s.add.circle(PANEL_X + 36, y, 7, tower.color, 1)
        .setStrokeStyle(2, 0x5c3218, 0.68)
        .setDepth(32);

      return { key, button, icon };
    });

    s.codexButton = this.createButton(GAME_WIDTH - 340, 68, 74, 24, "塔图鉴", () => this.openTowerCodexList(), {
      fill: 0x9bc06a,
      hoverFill: 0xb1d585,
      stroke: 0x3e6a26,
      color: "#1f3013",
    });
    s.enemyCodexButton = this.createButton(GAME_WIDTH - 260, 68, 74, 24, "敌人图鉴", () => this.openEnemyCodex(), {
      fill: 0xc9756d,
      hoverFill: 0xdd8d85,
      stroke: 0x5c2a25,
      color: "#fff6d8",
    });
    s.bossCodexButton = this.createButton(GAME_WIDTH - 130, 68, 116, 24, "Boss 图鉴", () => this.openBossCodex(), {
      fill: 0x6c4ea3,
      hoverFill: 0x8865c0,
      stroke: 0x2f1f4d,
      color: "#fff6d8",
    });

    s.selectionText = s.add.text(PANEL_X + 25, 402, "", {
      ...TEXT_STYLE,
      fontSize: "13px",
      color: "#3c2814",
      lineSpacing: 2,
      wordWrap: { width: 154, useAdvancedWrap: true },
    }).setDepth(30);

    s.upgradeButton = this.createButton(PANEL_X + 101, 466, 154, 34, "", () => this.scene.towerSystem.upgradeSelectedTower(), {
      fill: 0xf5b83c,
      stroke: 0x89501f,
      color: "#3b250f",
      hoverFill: 0xffca55,
    });

    s.sellButton = this.createButton(PANEL_X + 101, 506, 154, 30, "", () => this.scene.towerSystem.sellSelectedTower(), {
      fill: 0x8fb76b,
      stroke: 0x4c7135,
      color: "#183111",
      hoverFill: 0xa0c77e,
    });
    s.rallyButton = this.createButton(PANEL_X + 101, 436, 154, 24, "设置集结点", () => this.scene.towerSystem.startRallySetting(), {
      fill: 0x6f8dbd,
      stroke: 0x2d4978,
      color: "#fff6d8",
      hoverFill: 0x7fa0d2,
    });
    s.rallyButton.setVisible(false);
    s.selectionText.setVisible(false);
    s.upgradeButton.setVisible(false);
    s.sellButton.setVisible(false);
    s.towerButtons.forEach(({ button, icon }) => {
      button.setVisible(false);
      button.disableInteractive();
      icon.setVisible(false);
    });

    s.endOverlay = s.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x20150d, 0.62)
      .setDepth(80)
      .setVisible(false);
    s.centerText = s.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "36px",
      color: "#fff6d8",
      align: "center",
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(81).setVisible(false);
    s.restartButton = this.createButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 72, 154, 42, "重新开始", () => s.scene.restart(), {
      fill: 0xf5b83c,
      stroke: 0x89501f,
      color: "#3b250f",
      hoverFill: 0xffca55,
    });
    s.restartButton.setDepth(82).setVisible(false);
  }

  // ---------- 通用按钮 ----------

  createButton(x, y, width, height, label, onClick, options = {}) {
    const s = this.scene;
    const fill = options.fill ?? 0xe7c980;
    const hoverFill = options.hoverFill ?? 0xf0d894;
    const stroke = options.stroke ?? 0x8a5a26;
    const color = options.color ?? "#3a2816";
    const bg = s.add.rectangle(0, 0, width, height, fill, 1)
      .setStrokeStyle(3, stroke, 1)
      .setDepth(30);
    const highlight = s.add.rectangle(0, -height / 2 + 5, width - 12, 4, 0xfff1bb, 0.35)
      .setDepth(31);
    const text = s.add.text(0, 0, label, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: height <= 30 ? "13px" : "15px",
      color,
      align: "center",
    }).setOrigin(0.5).setDepth(32);
    const button = s.add.container(x, y, [bg, highlight, text]).setDepth(30);

    button.setSize(width, height);
    button.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
    button.bg = bg;
    button.label = text;
    button.defaultFill = fill;
    button.hoverFill = hoverFill;
    button.enabled = true;
    button.on("pointerover", () => {
      if (button.enabled) {
        bg.setFillStyle(hoverFill, 1);
      }
    });
    button.on("pointerout", () => {
      bg.setFillStyle(button.selected ? 0xf5b83c : fill, 1);
    });
    button.on("pointerdown", () => {
      if (button.enabled) {
        onClick();
      }
    });

    return button;
  }

  setButtonEnabled(button, enabled) {
    button.enabled = enabled;
    button.setAlpha(enabled ? 1 : 0.48);
    if (!enabled) {
      button.bg.setFillStyle(button.defaultFill, 1);
    }
  }

  setButtonLabel(button, label) {
    button.label.setText(label);
  }

  // ---------- 暂停 / 选择建造类型 ----------

  togglePause(force = null) {
    const s = this.scene;
    if (s.gameEnded) {
      return;
    }

    s.paused = force ?? !s.paused;
    this.showNotice(s.paused ? "暂停" : "继续", s.paused ? "#7a3d12" : "#315c22");
    this.updateUi();
  }

  selectBuildType(key) {
    const s = this.scene;
    if (s.paused) {
      this.showNotice("游戏已暂停", "#7a3d12");
      return;
    }

    if (!this.scene.towerSystem.isTowerUnlocked(key)) {
      this.showNotice(`${TOWER_TYPES[key].name} 需要图纸`, "#9c2b24");
      return;
    }

    s.selectedBuildType = key;
    s.pendingBuildType = key;
    s.selectedTower = null;
    s.selectedHero = null;
    this.scene.heroSystem.updateHeroSelectionVisuals();
    this.scene.towerSystem.clearSelectedRange();
    this.updateUi();
  }

  handleSlotClick(slot) {
    const s = this.scene;
    if (s.gameEnded || s.modalOpen || s.paused) {
      return;
    }

    if (slot.tower) {
      this.closeBuildMenu();
      this.scene.towerSystem.selectTower(slot.tower);
      return;
    }

    if (s.buildMenu?.slot === slot) {
      this.closeBuildMenu();
      return;
    }
    this.openBuildMenu(slot);
  }

  openBuildMenu(slot) {
    const s = this.scene;
    this.closeBuildMenu();
    const keys = this.scene.towerSystem.getBuildableTowerKeys();
    if (keys.length === 0) {
      this.showNotice("暂无可建塔（需要图纸）", "#9c2b24");
      return;
    }
    const objects = [];
    const radius = keys.length <= 4 ? 56 : 72;
    const startAngle = -Math.PI / 2;
    const step = (Math.PI * 2) / keys.length;
    const hub = s.add.circle(slot.x, slot.y, 16, 0x2f2415, 0.56)
      .setStrokeStyle(2, 0xfff1bb, 0.85)
      .setDepth(41);
    const ring = s.add.circle(slot.x, slot.y, radius + 34, 0xffffff, 0)
      .setStrokeStyle(1, 0xfff1bb, 0.4)
      .setDepth(40);
    objects.push(hub, ring);

    keys.forEach((key, index) => {
      const tower = TOWER_TYPES[key];
      const angle = startAngle + step * index;
      const x = slot.x + Math.cos(angle) * radius;
      const y = slot.y + Math.sin(angle) * radius;
      const bg = s.add.circle(0, 0, 25, 0xf6e2a9, 0.96)
        .setStrokeStyle(3, tower.color, 0.95);
      const icon = s.add.image(0, -4, this.scene.towerSystem.getTowerTextureKey(key, 1, null, "base"))
        .setDisplaySize(28, 28);
      const priceBg = s.add.rectangle(0, 17, 36, 12, 0x2f2415, 0.95)
        .setStrokeStyle(1, 0x8a5a26, 0.9);
      const canAfford = s.gold >= tower.price;
      const price = s.add.text(0, 17, String(tower.price), {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "10px",
        color: canAfford ? "#fff6d8" : "#f2a1a1",
      }).setOrigin(0.5);
      const option = s.add.container(x, y, [bg, icon, priceBg, price])
        .setDepth(42)
        .setSize(52, 52)
        .setInteractive(new Phaser.Geom.Circle(0, 0, 25), Phaser.Geom.Circle.Contains);
      option.isBuildMenuOption = true;
      option.on("pointerover", () => option.setScale(1.08));
      option.on("pointerout", () => option.setScale(1));
      option.on("pointerdown", (_pointer, _localX, _localY, event) => {
        event?.stopPropagation();
        this.scene.towerSystem.buildTower(slot, key);
      });
      objects.push(option);
    });

    s.buildMenu = { slot, objects };
  }

  closeBuildMenu() {
    const s = this.scene;
    if (!s.buildMenu) {
      return;
    }
    s.buildMenu.objects.forEach((object) => object.destroy());
    s.buildMenu = null;
  }

  // ---------- 图鉴 ----------

  openTowerCodexList() {
    const s = this.scene;
    this.createModalBase("塔图鉴", "选择一座塔查看完整设定图。");
    const order = ["barracks", "flame", "treasure", "mage", "artillery"];
    order.forEach((key, index) => {
      const type = TOWER_TYPES[key];
      if (!type) {
        return;
      }

      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 240 + col * 170;
      const y = 210 + row * 64;
      const button = this.createButton(x, y, 150, 40, type.name, () => {
        this.closeModal();
        this.openTowerCodex(key);
      }, {
        fill: 0xe7c980,
        hoverFill: 0xf0d894,
        stroke: 0x8a5a26,
        color: "#3a2816",
      });
      button.setDepth(93);
      s.modalObjects.push(button);
    });
    this.addModalCloseButton("关闭", () => this.closeModal());
  }

  openTowerCodex(typeKey) {
    const s = this.scene;
    const type = TOWER_TYPES[typeKey];
    if (!type || !type.codexImage || !s.textures.exists(type.codexImage)) {
      this.showNotice(`暂无 ${type?.name ?? typeKey} 图鉴`, "#7a4b25");
      return;
    }

    this.createModalBase(`${type.name} · 图鉴`, "点击关闭返回。");
    const image = s.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, type.codexImage).setDepth(91);
    const maxWidth = GAME_WIDTH - 80;
    const maxHeight = GAME_HEIGHT - 140;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    image.setScale(scale);
    s.modalObjects.push(image);
    this.addModalCloseButton("关闭", () => this.closeModal());
  }

  openEnemyCodex() {
    const s = this.scene;
    this.createModalBase("敌人图鉴", "选择一类查看完整设定图。");
    const normalButton = this.createButton(280, 200, 200, 44, "普通小怪", () => {
      this.closeModal();
      this.showCodexImage("enemy-codex", "敌人图鉴 · 普通小怪");
    }, {
      fill: 0xc9756d,
      hoverFill: 0xdd8d85,
      stroke: 0x5c2a25,
      color: "#fff6d8",
    }).setDepth(93);
    const eliteButton = this.createButton(280, 260, 200, 44, "精英小怪", () => {
      this.closeModal();
      this.showCodexImage("enemy-elite-codex", "敌人图鉴 · 精英小怪");
    }, {
      fill: 0x9c5cc4,
      hoverFill: 0xb074d8,
      stroke: 0x4a285c,
      color: "#fff6d8",
    }).setDepth(93);
    s.modalObjects.push(normalButton, eliteButton);
    this.addModalCloseButton("关闭", () => this.closeModal());
  }

  showCodexImage(textureKey, title) {
    const s = this.scene;
    if (!s.textures.exists(textureKey)) {
      this.showNotice(`暂无图鉴：${title}`, "#7a4b25");
      return;
    }
    this.createModalBase(title, "点击关闭返回。");
    const image = s.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, textureKey).setDepth(91);
    const maxWidth = GAME_WIDTH - 80;
    const maxHeight = GAME_HEIGHT - 140;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    image.setScale(scale);
    s.modalObjects.push(image);
    this.addModalCloseButton("关闭", () => this.closeModal());
  }

  openBossCodex(selectedKey = "boss-wraith-sheet") {
    const s = this.scene;
    const entries = [
      { key: "boss-wraith-sheet", label: "奥术幽灵" },
      { key: "boss-warlock-sheet", label: "暗月术士" },
    ].filter((item) => s.textures.exists(item.key));
    if (entries.length === 0) {
      this.showNotice("暂无 Boss 图鉴", "#7a4b25");
      return;
    }
    const activeKey = entries.some((item) => item.key === selectedKey) ? selectedKey : entries[0].key;
    this.createModalBase("Boss 图鉴", "选择 Boss 查看整图。");
    entries.forEach((item, index) => {
      const button = this.createButton(250 + index * 190, 170, 170, 36, item.label, () => this.openBossCodex(item.key), {
        fill: item.key === activeKey ? 0x7f62ba : 0x6c4ea3,
        hoverFill: 0x9475cf,
        stroke: 0x2f1f4d,
        color: "#fff6d8",
      }).setDepth(93);
      s.modalObjects.push(button);
    });
    const image = s.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, activeKey).setDepth(91);
    const maxWidth = GAME_WIDTH - 120;
    const maxHeight = GAME_HEIGHT - 250;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    image.setScale(scale);
    s.modalObjects.push(image);
    this.addModalCloseButton("关闭", () => this.closeModal());
  }

  // ---------- 模态框 ----------

  createModalBase(title, subtitle) {
    const s = this.scene;
    this.closeModal(true);
    s.modalOpen = true;
    s.modalKind = title === "背包" ? "inventory" : title === "装备商店" ? "shop" : "modal";
    const addObject = (object) => {
      s.modalObjects.push(object);
      return object;
    };

    addObject(s.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x20150d, 0.58)
      .setDepth(88)
      .setInteractive());
    addObject(s.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 456, 0xf6e2a9, 1)
      .setStrokeStyle(4, 0x7a4b25, 1)
      .setDepth(89));
    addObject(s.add.text(146, 62, title, {
      ...TEXT_STYLE,
      fontSize: "28px",
      color: "#4a2d17",
    }).setDepth(90));
    addObject(s.add.text(148, 100, subtitle, {
      ...TEXT_STYLE,
      fontSize: "15px",
      color: "#70451f",
      wordWrap: { width: 650, useAdvancedWrap: true },
    }).setDepth(90));
  }

  addModalText(x, y, text, size, color, width) {
    const s = this.scene;
    const label = s.add.text(x, y, text, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: `${size}px`,
      color,
      lineSpacing: 4,
      wordWrap: { width, useAdvancedWrap: true },
    }).setDepth(92);
    s.modalObjects.push(label);
    return label;
  }

  addModalCloseButton(label, onClick) {
    const s = this.scene;
    const button = this.createButton(GAME_WIDTH / 2, 470, 154, 36, label, onClick, {
      fill: 0x8fb76b,
      stroke: 0x4c7135,
      color: "#183111",
      hoverFill: 0xa0c77e,
    }).setDepth(93);
    s.modalObjects.push(button);
  }

  closeModal(silent = false) {
    const s = this.scene;
    this.closeBuildMenu();
    s.modalObjects.forEach((object) => object.destroy());
    s.modalObjects = [];
    s.modalOpen = false;
    s.modalKind = null;
    if (!silent) {
      s.updateUi?.();
    }
  }

  // ---------- 结束界面 ----------

  finishGame() {
    const s = this.scene;
    s.gameEnded = true;
    s.waveActive = false;
    s.bestWave = Math.max(s.bestWave, s.wave);
    localStorage.setItem(STORAGE_KEYS.bestWave, String(s.bestWave));
    s.endOverlay.setVisible(true);
    s.centerText.setText(`前哨失守\n坚持到第 ${s.wave} 波\n得分 ${s.score}`);
    s.centerText.setVisible(true);
    s.restartButton.setVisible(true);
    this.updateUi();
  }

  finishVictory() {
    const s = this.scene;
    s.gameEnded = true;
    s.bestWave = s.totalWaves;
    localStorage.setItem(STORAGE_KEYS.bestWave, String(s.bestWave));
    localStorage.setItem(STORAGE_KEYS.lastScore, String(s.score));
    localStorage.setItem(getLevelCompleteKey(s.levelId), "true");
    s.waveActive = false;
    this.showNotice(`${s.levelConfig.name} 完成，返回章节地图`, "#315c22");
    this.updateUi();
    this.returnToCampaign();
  }

  finishVictorySequence() {
    const s = this.scene;
    if (isChapterFinalLevel(s.levelId)) {
      this.scene.economySystem.openMerchant("elite", true);
      return;
    }

    if (isWildMerchantLevel(s.levelId)) {
      s.pendingCampaignReturn = true;
      this.scene.economySystem.openMerchant("wild", false);
      return;
    }

    this.finishVictory();
  }

  returnToCampaign() {
    const s = this.scene;
    s.pendingCampaignReturn = false;
    s.cameras.main.fadeOut(420, 32, 21, 13);
    s.time.delayedCall(440, () => {
      s.scene.start("CampaignScene", {
        completedLevelId: s.levelId,
        gold: s.gold,
        score: s.score,
      });
    });
  }

  // ---------- 通知 / HUD 刷新 ----------

  showNotice(message, color) {
    const s = this.scene;
    s.tweens.killTweensOf(s.noticeText);
    s.noticeText.setText(message).setColor(color).setAlpha(1);
    s.tweens.add({
      targets: s.noticeText,
      alpha: 0,
      delay: 950,
      duration: 450,
    });
  }

  updateUi() {
    const s = this.scene;
    if (!s.hudText) {
      return;
    }

    const remainingEnemies = this.getRemainingEnemiesInWave();
    const waveLabel = s.wave > 0 ? `${s.wave}/${s.totalWaves}` : `0/${s.totalWaves}`;
    const heroHp = s.heroes.map((hero) => `${hero.name.slice(1)} ${Math.ceil(hero.hp)}/${hero.stats.maxHp}`).join("  ");
    s.hudText.setText(
      `金币 ${s.gold}  生命 ${Math.max(s.lives, 0)}  第 ${waveLabel} 波  敌人 ${remainingEnemies}  背包 ${s.inventory.length}  碎片 ${s.blueprintFragments}/3  得分 ${s.score}\n${heroHp}`,
    );

    if (s.wave >= s.totalWaves && !s.waveActive) {
      this.setButtonLabel(s.startButton, "波次已完成");
    } else if (s.prepPhase) {
      this.setButtonLabel(s.startButton, `立即开始 +${Math.floor(s.prepCountdown)}`);
    } else {
      this.setButtonLabel(s.startButton, s.waveActive ? `第 ${s.wave}/${s.totalWaves} 波中` : `开始第 ${s.wave + 1}/${s.totalWaves} 波`);
    }

    this.setButtonLabel(s.pauseButton, s.paused ? "继续" : "暂停");
    this.setButtonEnabled(s.pauseButton, !s.gameEnded && !s.modalOpen);
    this.setButtonEnabled(s.startButton, (s.prepPhase || (!s.waveActive && s.wave < s.totalWaves)) && !s.gameEnded && !s.modalOpen && !s.paused);
    this.setButtonLabel(s.inventoryButton, `背包 ${s.inventory.length}`);
    this.scene.heroSystem.updateHeroPortraits();
    this.updateTowerButtons();
    this.updateSelectionPanel();
  }

  getRemainingEnemiesInWave() {
    const s = this.scene;
    if (!s.waveActive) {
      return 0;
    }

    return s.enemies.length + Math.max(s.enemiesThisWave - s.spawnedThisWave, 0);
  }

  updateTowerButtons() {
    const s = this.scene;
    if (s.useSlotBuildMenu) {
      return;
    }
    s.towerButtons.forEach(({ key, button, icon }) => {
      const selected = key === this.scene.towerSystem.getPendingBuildType() && !s.selectedTower;
      const unlocked = this.scene.towerSystem.isTowerUnlocked(key);
      const tower = TOWER_TYPES[key];
      button.selected = selected;
      button.bg.setStrokeStyle(3, selected ? 0xc64c35 : 0x8a5a26, 1);
      button.bg.setFillStyle(selected ? 0xf5b83c : button.defaultFill, 1);
      this.setButtonLabel(button, unlocked ? `${tower.name} ${tower.price}` : `${tower.name} 图纸`);
      this.setButtonEnabled(button, unlocked && !s.gameEnded && !s.paused);
      icon.setAlpha(unlocked ? 1 : 0.38);
    });
  }

  updateSelectionPanel() {
    const s = this.scene;
    if (s.useSlotBuildMenu) {
      s.selectionText?.setVisible(false);
      s.rallyButton?.setVisible(false);
      s.upgradeButton?.setVisible(false);
      s.sellButton?.setVisible(false);
      return;
    }
    if (!s.selectedTower) {
      const typeKey = this.scene.towerSystem.getPendingBuildType();
      const type = TOWER_TYPES[typeKey];
      const unlocked = this.scene.towerSystem.isTowerUnlocked(typeKey);
      const previewStats = this.scene.towerSystem.getTowerStats(typeKey, 1, null);
      const statLine = typeKey === "altar"
        ? `伤害加成 +${Math.round(previewStats.damageBuff * 100)}%\n攻速加成 +${Math.round(previewStats.rateBuff * 100)}%`
        : `伤害 ${previewStats.damage}\n射程 ${previewStats.range}\n攻速 ${(1000 / previewStats.rate).toFixed(1)}/秒`;
      s.selectionText.setText(
        `${type.name}\n${unlocked ? type.description : "需要特殊塔图纸"}\n花费 ${type.price}\n${statLine}`,
      );
      s.rallyButton.setVisible(false);
      s.upgradeButton.setVisible(false);
      s.sellButton.setVisible(false);
      return;
    }

    const tower = s.selectedTower;
    const upgradeCost = this.scene.towerSystem.getUpgradeCost(tower);
    const atMax = tower.level >= this.scene.towerSystem.getTowerMaxLevel(tower);
    const branchReady = this.scene.towerSystem.canChooseTowerBranch(tower);

    const towerType = TOWER_TYPES[tower.typeKey];
    const towerDescription = tower.branch ? towerType.branches?.[tower.branch]?.description : towerType.description;
    const towerStatLine = tower.typeKey === "altar"
      ? `伤害加成 +${Math.round((tower.damageBuff ?? 0) * 100)}%\n攻速加成 +${Math.round((tower.rateBuff ?? 0) * 100)}%`
      : `伤害 ${tower.damage}\n射程 ${tower.range}\n攻速 ${(1000 / tower.rate).toFixed(1)}/秒`;
    s.selectionText.setText(
      `${this.scene.towerSystem.getTowerDisplayName(tower)} Lv.${tower.level}\n${towerDescription}\n${towerStatLine}`,
    );
    s.rallyButton.setVisible(tower.typeKey === "barracks");
    this.setButtonEnabled(s.rallyButton, tower.typeKey === "barracks");
    s.upgradeButton.setVisible(true);
    s.sellButton.setVisible(true);
    this.setButtonLabel(s.upgradeButton, atMax ? "已满级" : branchReady ? `四级分支 ${upgradeCost}` : `升级 ${upgradeCost}`);
    this.setButtonLabel(s.sellButton, `出售 +${Math.floor(tower.totalCost * 0.55)}`);
    this.setButtonEnabled(s.upgradeButton, !atMax);
    this.setButtonEnabled(s.sellButton, true);
  }
}
