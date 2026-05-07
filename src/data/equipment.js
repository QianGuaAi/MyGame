export const EQUIPMENT_CATALOG = {
  staff: {
    name: "基础法杖",
    price: 7,
    slot: "weapon",
    allowedHeroes: ["yueguang"],
    stats: { damage: 4, magic: 6, cooldown: 0.05 },
    desc: "法伤+6 冷却-5%",
  },
  spear: {
    name: "矛",
    price: 8,
    slot: "weapon",
    stats: { damage: 8, range: 12 },
    desc: "攻击+8 距离+12",
  },
  hammer: {
    name: "锤",
    price: 15,
    slot: "weapon",
    strengthReq: 6,
    stats: { damage: 14, stunChance: 0.1 },
    desc: "攻击+14 眩晕10%",
  },
  sword: {
    name: "剑",
    price: 10,
    slot: "weapon",
    stats: { damage: 10, critChance: 0.08 },
    desc: "攻击+10 暴击+8%",
  },
  bow: {
    name: "弓",
    price: 6,
    slot: "weapon",
    stats: { damage: 6, range: 72, attackSpeed: 0.1, ranged: 1 },
    desc: "攻击+6 攻速+10%",
  },
  cloth: {
    name: "布甲",
    price: 5,
    slot: "armor",
    stats: { maxHp: 15, magicArmor: 2 },
    desc: "生命+15 法抗+2",
  },
  chain: {
    name: "锁甲",
    price: 12,
    slot: "armor",
    strengthReq: 5,
    stats: { maxHp: 25, armor: 4 },
    desc: "生命+25 护甲+4",
  },
  vine: {
    name: "藤甲",
    price: 9,
    slot: "armor",
    stats: { maxHp: 20, regen: 1 },
    desc: "生命+20 回血+1",
  },
  iron: {
    name: "铁甲",
    price: 18,
    slot: "armor",
    strengthReq: 7,
    stats: { maxHp: 40, armor: 7 },
    desc: "生命+40 护甲+7",
  },
  shield: {
    name: "盾",
    price: 14,
    slot: "offhand",
    strengthReq: 5,
    stats: { blockChance: 0.15, blockReduce: 0.35 },
    desc: "格挡率+15%",
  },
};

export const BASIC_SHOP_ITEMS = ["staff", "spear", "hammer", "sword", "bow", "cloth", "chain", "vine", "iron", "shield"];

export const RARITY_CONFIG = {
  普通: { multiplier: 1, prefix: "", color: "#3a2816", tint: 0xffffff },
  稀有: { multiplier: 1.35, prefix: "精制", color: "#286aa6", tint: 0xb8deff },
  史诗: { multiplier: 1.7, prefix: "英勇", color: "#7d4acb", tint: 0xd6bbff },
  传说: { multiplier: 2.15, prefix: "传说", color: "#a86610", tint: 0xffcf70 },
};
