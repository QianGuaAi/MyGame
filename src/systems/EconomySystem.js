import { BASIC_SHOP_ITEMS, EQUIPMENT_CATALOG, RARITY_CONFIG } from "../data/equipment.js";
import { SPECIAL_TOWER_KEYS, TOWER_TYPES } from "../data/towers.js";
import { cloneStats, pickRandom } from "../utils/random.js";

/**
 * 经济系统：装备工厂、装备商店、背包、商人、图纸碎片 / 解锁。
 * 状态依然存放在 scene 上（this.scene.gold / inventory / selectedShopHeroId / unlockedBlueprints / blueprintFragments / currentMerchant ...）。
 */
export class EconomySystem {
  constructor(scene) {
    this.scene = scene;
  }

  // ---------- 装备工厂 ----------

  createEquipment(id, rarity = "普通") {
    const base = EQUIPMENT_CATALOG[id];
    const rarityConfig = RARITY_CONFIG[rarity];
    const multiplier = rarityConfig.multiplier;
    const suffix = rarity === "普通" ? "" : `·${rarity}`;

    return {
      uid: `${id}-${rarity}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      catalogId: id,
      rarity,
      name: `${rarityConfig.prefix}${base.name}${suffix}`,
      baseName: base.name,
      price: Math.max(1, Math.round(base.price * multiplier)),
      slot: base.slot,
      strengthReq: base.strengthReq ?? 0,
      allowedHeroes: base.allowedHeroes ?? null,
      stats: cloneStats(base.stats, multiplier),
      desc: base.desc,
    };
  }

  // ---------- 装备规则 ----------

  getSelectedShopHero() {
    const s = this.scene;
    return s.heroes.find((hero) => hero.id === s.selectedShopHeroId) ?? s.heroes[0];
  }

  canEquip(hero, item) {
    if (item.strengthReq && hero.strength < item.strengthReq) {
      return false;
    }

    if (item.allowedHeroes && !item.allowedHeroes.includes(hero.id)) {
      return false;
    }

    return true;
  }

  equipHero(hero, item) {
    const s = this.scene;
    if (!this.canEquip(hero, item)) {
      this.scene.hudSystem.showNotice(`${hero.name} 无法装备 ${item.name}`, "#9c2b24");
      return false;
    }

    const oldItem = hero.equipment[item.slot];
    if (oldItem) {
      s.inventory.push(oldItem);
    }

    hero.equipment[item.slot] = item;
    this.scene.heroSystem.recalculateHeroStats(hero);
    hero.hp = Math.min(hero.hp + Math.round(hero.stats.maxHp * 0.12), hero.stats.maxHp);
    this.scene.heroSystem.updateHeroSprite(hero);
    this.scene.hudSystem.showNotice(`${hero.name} 装备了 ${item.name}`, RARITY_CONFIG[item.rarity].color);
    return true;
  }

  // ---------- 商店 / 背包模态 ----------

  openEquipmentShop() {
    const s = this.scene;
    this.scene.hudSystem.createModalBase("装备商店", "选择英雄后购买装备。力量不足或职业不合时不能装备。");
    const hero = this.getSelectedShopHero();

    this.renderHeroPicker(128);
    this.scene.hudSystem.addModalText(164, 156, `当前：${hero.name}  力量 ${hero.strength}\n${this.getHeroEquipmentSummary(hero)}`, 14, "#3a2816", 620);

    BASIC_SHOP_ITEMS.forEach((id, index) => {
      const item = this.createEquipment(id);
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 174 + col * 326;
      const y = 220 + row * 48;
      const canBuy = s.gold >= item.price && this.canEquip(hero, item);
      const req = item.strengthReq ? ` 力量${item.strengthReq}` : "";

      this.scene.hudSystem.addModalText(x, y - 18, `${item.name} ${item.price}金${req}\n${item.desc}`, 13, RARITY_CONFIG[item.rarity].color, 238);
      const button = this.scene.hudSystem.createButton(x + 230, y - 2, 80, 28, "购买", () => {
        this.buyAndEquipShopItem(id);
      }, {
        fill: 0xe7c980,
        stroke: 0x8a5a26,
      }).setDepth(93);
      s.modalObjects.push(button);
      this.scene.hudSystem.setButtonEnabled(button, canBuy);
    });

    this.scene.hudSystem.addModalCloseButton("关闭", () => this.scene.hudSystem.closeModal());
  }

  buyAndEquipShopItem(id) {
    const s = this.scene;
    const hero = this.getSelectedShopHero();
    const item = this.createEquipment(id);

    if (s.gold < item.price) {
      this.scene.hudSystem.showNotice("金币不足", "#9c2b24");
      return;
    }

    if (!this.canEquip(hero, item)) {
      this.scene.hudSystem.showNotice(`${hero.name} 无法装备 ${item.name}`, "#9c2b24");
      return;
    }

    s.gold -= item.price;
    this.equipHero(hero, item);
    this.openEquipmentShop();
    this.scene.hudSystem.updateUi();
  }

  openInventory() {
    const s = this.scene;
    this.scene.hudSystem.createModalBase("背包", "敌人掉落的装备会放在这里。选择英雄后点击装备。");
    const hero = this.getSelectedShopHero();

    this.renderHeroPicker(128);
    this.scene.hudSystem.addModalText(164, 156, `当前：${hero.name}  力量 ${hero.strength}\n${this.getHeroEquipmentSummary(hero)}`, 14, "#3a2816", 620);

    if (s.inventory.length === 0) {
      this.scene.hudSystem.addModalText(350, 256, "背包是空的。打稀有敌人、精英敌人或 Boss 可以掉装备。", 16, "#70451f", 310);
    } else {
      s.inventory.slice(0, 8).forEach((item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = 174 + col * 326;
        const y = 224 + row * 56;
        const canEquip = this.canEquip(hero, item);

        this.scene.hudSystem.addModalText(x, y - 20, `${item.name}\n${item.desc}${item.strengthReq ? ` 力量${item.strengthReq}` : ""}`, 13, RARITY_CONFIG[item.rarity].color, 238);
        const button = this.scene.hudSystem.createButton(x + 230, y - 2, 80, 28, "装备", () => this.equipInventoryItem(item.uid), {
          fill: 0x8fb76b,
          stroke: 0x4c7135,
          color: "#183111",
          hoverFill: 0xa0c77e,
        }).setDepth(93);
        s.modalObjects.push(button);
        this.scene.hudSystem.setButtonEnabled(button, canEquip);
      });
    }

    this.scene.hudSystem.addModalCloseButton("关闭", () => this.scene.hudSystem.closeModal());
  }

  equipInventoryItem(uid) {
    const s = this.scene;
    const hero = this.getSelectedShopHero();
    const index = s.inventory.findIndex((item) => item.uid === uid);

    if (index === -1) {
      return;
    }

    const [item] = s.inventory.splice(index, 1);
    if (!this.equipHero(hero, item)) {
      s.inventory.splice(index, 0, item);
    }

    this.openInventory();
    this.scene.hudSystem.updateUi();
  }

  renderHeroPicker(y) {
    const s = this.scene;
    s.heroes.forEach((hero, index) => {
      const selected = hero.id === s.selectedShopHeroId;
      const button = this.scene.hudSystem.createButton(260 + index * 170, y, 136, 32, hero.name, () => {
        s.selectedShopHeroId = hero.id;
        if (s.modalKind === "inventory") {
          this.openInventory();
        } else {
          this.openEquipmentShop();
        }
      }, {
        fill: selected ? 0xf5b83c : 0xe7c980,
        stroke: selected ? 0xc64c35 : 0x8a5a26,
      }).setDepth(93);
      button.selected = selected;
      s.modalObjects.push(button);
    });
  }

  getHeroEquipmentSummary(hero) {
    const slotNames = { weapon: "武器", armor: "防具", offhand: "副手" };
    return Object.entries(slotNames)
      .map(([slot, label]) => `${label}:${hero.equipment[slot]?.name ?? "无"}`)
      .join("  ");
  }

  // ---------- 商人 ----------

  openMerchant(kind, finalAfterClose) {
    const s = this.scene;
    s.currentMerchant = {
      kind,
      finalAfterClose,
      limit: kind === "elite" ? 2 : 99,
      purchases: 0,
      goods: kind === "elite" ? this.generateEliteGoods() : this.generateWildGoods(),
    };
    this.renderMerchant();
  }

  generateWildGoods() {
    const goods = [
      { kind: "heal", name: "行军药包", price: 22, desc: "所有英雄恢复 45% 生命" },
      { kind: "lives", name: "修补城门", price: 28, desc: "生命 +4" },
      { kind: "equipment", item: this.createEquipment(pickRandom(BASIC_SHOP_ITEMS), "稀有"), price: 34, desc: "随机稀有装备" },
    ];

    const blueprint = Math.random() < 0.25 ? this.chooseLockedBlueprint() : null;
    if (blueprint) {
      goods.push({ kind: "blueprint", towerKey: blueprint, name: `${TOWER_TYPES[blueprint].name}图纸`, price: 62, desc: "永久解锁特殊塔" });
    } else {
      goods.push({ kind: "fragment", name: "特殊塔图纸碎片", price: 26, desc: "集齐 3 个自动解锁一张图纸" });
    }

    goods.push({ kind: "equipment", item: this.createEquipment(pickRandom(BASIC_SHOP_ITEMS), Math.random() < 0.35 ? "史诗" : "稀有"), price: 48, desc: "野外带来的好货" });
    return goods;
  }

  generateEliteGoods() {
    const goods = [];
    const blueprint = this.chooseLockedBlueprint();

    if (blueprint) {
      goods.push({ kind: "blueprint", towerKey: blueprint, name: `${TOWER_TYPES[blueprint].name}图纸`, price: 70, desc: "章末必出特殊塔图纸" });
    } else {
      goods.push({ kind: "fragment", name: "图纸大师补偿", price: 0, desc: "所有特殊塔已解锁，获得 80 金币" });
    }

    ["hammer", "bow", "staff", "iron", "shield"].slice(0, 4).forEach((id) => {
      const item = this.createEquipment(id, "传说");
      goods.push({ kind: "equipment", item, price: Math.max(65, item.price * 3), desc: "传说级装备武器" });
    });

    return goods;
  }

  renderMerchant() {
    const s = this.scene;
    const merchant = s.currentMerchant;
    const title = merchant.kind === "elite" ? "精英商人" : "野生商人";
    const subtitle = merchant.kind === "elite"
      ? `章节最后出现。只能购买 2 个商品，必定有特殊塔图纸。已买 ${merchant.purchases}/${merchant.limit}`
      : "每三关出现。可能出售特殊塔图纸、稀有装备和补给。";

    this.scene.hudSystem.createModalBase(title, subtitle);
    merchant.goods.forEach((good, index) => {
      const y = 150 + index * 54;
      const name = good.item ? good.item.name : good.name;
      const price = good.price ?? good.item?.price ?? 0;
      const bought = good.bought;
      const limited = merchant.purchases >= merchant.limit;

      this.scene.hudSystem.addModalText(168, y - 18, `${name}  ${price}金\n${good.desc}`, 14, good.item ? RARITY_CONFIG[good.item.rarity].color : "#3a2816", 460);
      const button = this.scene.hudSystem.createButton(706, y, 120, 30, bought ? "已购买" : "购买", () => this.buyMerchantGood(index), {
        fill: merchant.kind === "elite" ? 0xf5b83c : 0xe7c980,
        stroke: 0x8a5a26,
      }).setDepth(93);
      s.modalObjects.push(button);
      this.scene.hudSystem.setButtonEnabled(button, !bought && !limited && s.gold >= price);
    });

    this.scene.hudSystem.addModalCloseButton(merchant.finalAfterClose ? "结束章节" : "离开", () => {
      const final = merchant.finalAfterClose;
      this.scene.hudSystem.closeModal();
      if (final) {
        this.scene.hudSystem.finishVictory();
      } else {
        if (s.pendingCampaignReturn) {
          this.scene.hudSystem.finishVictory();
        } else {
          this.scene.waveSystem.startPrepPhase(30);
        }
      }
    });
  }

  buyMerchantGood(index) {
    const s = this.scene;
    const merchant = s.currentMerchant;
    const good = merchant.goods[index];
    const price = good.price ?? good.item?.price ?? 0;

    if (good.bought || merchant.purchases >= merchant.limit || s.gold < price) {
      return;
    }

    s.gold -= price;
    good.bought = true;
    merchant.purchases += 1;

    if (good.kind === "equipment") {
      s.inventory.push(good.item);
      this.scene.hudSystem.showNotice(`${good.item.name} 已进背包`, RARITY_CONFIG[good.item.rarity].color);
    } else if (good.kind === "blueprint") {
      this.unlockBlueprint(good.towerKey);
    } else if (good.kind === "fragment") {
      if (this.chooseLockedBlueprint()) {
        this.addBlueprintFragment();
      } else {
        s.gold += 80;
        this.scene.hudSystem.showNotice("特殊塔已全解锁：金币 +80", "#315c22");
      }
    } else if (good.kind === "heal") {
      this.scene.heroSystem.recoverHeroes(0.45);
      this.scene.hudSystem.showNotice("所有英雄恢复生命", "#315c22");
    } else if (good.kind === "lives") {
      s.lives += 4;
      this.scene.hudSystem.showNotice("城门生命 +4", "#315c22");
    }

    this.renderMerchant();
    this.scene.hudSystem.updateUi();
  }

  // ---------- 图纸 ----------

  chooseLockedBlueprint() {
    const locked = SPECIAL_TOWER_KEYS.filter((key) => !this.scene.unlockedBlueprints.has(key));
    return locked.length ? pickRandom(locked) : null;
  }

  unlockBlueprint(key) {
    const s = this.scene;
    if (!key || s.unlockedBlueprints.has(key)) {
      return;
    }

    s.unlockedBlueprints.add(key);
    this.scene.hudSystem.showNotice(`解锁特殊塔：${TOWER_TYPES[key].name}`, "#5a4ba6");
    this.scene.hudSystem.updateUi();
  }

  addBlueprintFragment() {
    const s = this.scene;
    s.blueprintFragments += 1;

    if (s.blueprintFragments >= 3) {
      const key = this.chooseLockedBlueprint();
      s.blueprintFragments = 0;
      if (key) {
        this.unlockBlueprint(key);
      } else {
        s.gold += 60;
        this.scene.hudSystem.showNotice("图纸已全解锁：金币 +60", "#315c22");
      }
    }
  }
}
