# GPT5.5（低推理模式）执行任务清单

> 本文件给 GPT5.5 低推理模式（low reasoning）使用。要求：**严格按顺序、按步骤、按文件路径执行**，不要自行发挥创意，不要重命名或删除未指定的内容。
>
> 唯一权威设计文件：`doc/game-design.md`。本文件是把设计文档拆成可机械执行的小步任务。
>
> 主版本是 `src/` 下的 Phaser/Vite 项目。**不要碰 `project.godot`、`scenes/`（仓库根目录）、`scripts/`（仓库根目录）、`docs/GODOT_MIGRATION.md`**。

---

## 0. 通用约定

### 0.1 仓库结构（只在以下范围内改动）

允许修改：

- `src/main.js`
- `src/scenes/`
- `src/data/`
- `src/render/`
- `src/utils/`
- `src/styles.css`
- `index.html`
- `doc/`（仅在被任务明确要求时）

禁止修改：

- 仓库根目录的 `project.godot`、`scenes/`、`scripts/`、`docs/GODOT_MIGRATION.md`。
- `node_modules/`、`dist/`、`.godot/`。

### 0.2 编码与换行

- 所有文件使用 **UTF-8**（无 BOM），换行用 LF 或保持文件原样。
- **绝对不要** 使用 PowerShell 的 `Get-Content | Set-Content`，会破坏中文。需要替换文件就用编辑器工具或 `write_to_file`（先确认文件不存在）。

### 0.3 完成每个任务后必须做的事

每个任务结束都执行一次：

```powershell
npm run build
```

构建必须通过；如果失败，回滚本任务的修改并报告错误信息。**不要** 把测试或构建警告无视掉。

可选的人工检查：

```powershell
npm run dev -- --port 5173
```

### 0.4 提交粒度

- 每个 “任务” 一个独立提交（commit message 用任务编号 + 简短中文描述）。
- 不要把多个任务合并成一个大提交。

### 0.5 设计文档更新原则

- 任何会改变玩法规则的代码改动，必须同步更新 `doc/game-design.md` 对应章节。
- 优先改设计文档中的描述与「当前已确认的关键修改」清单，再写代码。

---

## 1. 现状摘要（截至本任务清单生成时）

### 1.1 已实现

- 场景：`IntroComicScene`（开场漫画 4 格）→ `GameScene`（战斗）→ `CampaignScene`（章节地图）。
- `src/data/map.js`：`TOTAL_WAVES = 10`，单局战斗 10 波。
- `src/data/heroes.js`：3 英雄（王铁柱、王二狗、白月光）含基础属性、力量值、被动字段。
- `src/data/equipment.js`：10 件装备（基础法杖、矛、锤、剑、弓、布甲、锁甲、藤甲、铁甲、盾），4 品质（普通/稀有/史诗/传说）。
- `src/data/easterEggs.js`：3 个彩蛋（角落旧罐、隐藏草丛、月光石）。
- `src/data/towers.js`：弓箭塔含三级 + 四级分支（爆裂箭塔 / 鹰眼弩塔），其它特殊塔由图纸解锁。
- 王铁柱被动格挡：在 `recalculateHeroStats()` + `getTiezhuBlockStage()` 中按波数分 3 段（1–3 波 15%/40%、4–6 波 20%/45%、7+ 波 25%/50%）。
- 野生商人：`wave % 3 === 0` 的非最终波结束后弹出（即第 3、6、9 波）。
- 精英商人：第 10 波（最终波）结束后必出，限购 2 件，必出特殊塔图纸。
- 准备阶段：游戏开始 60 秒，波间 30 秒；可点 "立即开始" 提前出发，每剩余 1 秒奖励 1 金币。
- `CampaignScene`：第 1 章地图含 4 个节点（1-1 王冠前哨、1-2 北桥林道、1-3 旧王城门、Boss 黑石要塞），通关 1-1 后只解锁 1-2，其余仍为 `locked` / `next` 占位。
- 英雄沿路移动、左下角头像血量、倒下变灰复活倒计时、特殊塔图纸碎片（3 碎片合 1 张）。

### 1.2 与设计文档的待对齐项

- 彩蛋：缺设计文档 §彩蛋 列出的 "王铁柱连续格挡多次 → 金币 +50"。
- `CampaignScene`：1-2、1-3、Boss 节点未实现实际玩法，仅为视觉占位。
- 章节切换：通关 Boss 之后没有 "进入第 2 章" 流程；目前设计文档没要求第 2 章玩法，但需要明确 "第一章通关后" 的处理。
- 英雄主动技能（重击 / 铁骨 / 破甲锤、王二狗对空、白月光治疗 / 减速 / 强化）：设计文档列为 "可选技能方向"，不属于本任务清单的 P1 内容，留作后续。

---

## 2. 任务总览（按顺序执行）

| 编号 | 标题 | 依赖 |
|---:|---|---|
| T1 | 彩蛋扩充：王铁柱连续格挡 | 无 |
| T2 | 彩蛋数据按章节存档（兼容现有键名） | T1 |
| T3 | 章节地图 1-2 解锁与跳转骨架 | 无 |
| T4 | 第 1 章 1-2、1-3 战斗参数差异 | T3 |
| T5 | 第 1 章 Boss 关：必掉稀有以上装备或图纸碎片 | T4 |
| T6 | 商人触发节奏与设计文档对齐 | T5 |
| T7 | 关卡推进存档 | T3 |
| T8 | 烟雾测试（手测 + 构建） | T1–T7 |

> 每个任务都假设 `doc/game-design.md` 是最终权威。如果在执行中发现冲突，先停下，修正设计文档或反馈给用户，不要默默改代码。

---

## 3. T1 — 彩蛋扩充：王铁柱连续格挡

**目标**：补齐设计文档 §彩蛋 中列出的第 4 条彩蛋 "王铁柱连续格挡多次：金币 +50"。

### 3.1 修改 `src/data/easterEggs.js`

在数组末尾新增条目：

```js
{
  id: "tiezhu-block-streak",
  virtual: true,
  reward: 50,
  label: "铁壁连防",
  threshold: 5,
}
```

字段说明：

- `virtual: true` 表示没有地图坐标，不参与 `createEasterEggs` 渲染。
- `threshold: 5` 表示 "连续格挡 5 次" 触发，未来阈值调整只改这里。

### 3.2 修改 `src/scenes/GameScene.js`

#### 3.2.1 维护 `tiezhu` 的连续格挡计数

定位英雄受伤分支（`takeHeroDamage` 或类似函数，约 2110 行附近的 `if (hero.stats.blockChance > 0 && Math.random() < hero.stats.blockChance) {` 命中分支）：

- 当 `blocked === true` 且 `hero.id === "tiezhu"`：`hero.blockStreak = (hero.blockStreak ?? 0) + 1`。
- 当 `blocked === false` 且 `hero.id === "tiezhu"`：`hero.blockStreak = 0`。
- 王铁柱倒下时（死亡分支）：`hero.blockStreak = 0`。

#### 3.2.2 触发彩蛋

- 在 `hero.blockStreak` 自增后，若 `hero.blockStreak >= EASTER_EGG.threshold`（取 `id === "tiezhu-block-streak"` 的彩蛋），且该彩蛋未在 `claimedEasterEggs` 中：
  - `this.gold += egg.reward;`
  - `this.claimedEasterEggs.add(egg.id);`
  - 复用现有 `localStorage` 持久化逻辑（保持现有 key `crown-outpost-easter-eggs`）。
  - `this.showNotice("彩蛋：铁壁连防 +50 金", "#315c22");`
  - `hero.blockStreak = 0;`
  - `this.updateUi();`

#### 3.2.3 重启清空

`init()` 末尾确保 `hero.blockStreak` 不会残留：在 `createHeroState()` 里给所有英雄字段初始化 `blockStreak: 0`。

### 3.3 验收

- 用王铁柱面对单一目标，连续被砍 5 次都格挡（多刷几次或临时把 `blockChance` 调到 1 验证）→ 出现一次彩蛋通知与金币奖励。
- 彩蛋只能领取一次，刷新页面不重置（沿用现有 `localStorage`）。
- `npm run build` 通过。

### 3.4 设计文档同步

- `doc/game-design.md` 的彩蛋表已经写入 "王铁柱连续格挡多次"，本任务无需再修改文档。

---

## 4. T2 — 彩蛋数据按章节存档

**目标**：当后续多章节实现后，每章彩蛋应独立判定 "已领取"。本任务做存档结构升级，但向后兼容现有数据。

> 仅在 T1 完成且需求明确推进多章节时启动。如本阶段仍为单章节，可标记为 "推迟" 并跳到 T3。

### 4.1 新存储格式

key：`crown-outpost-easter-eggs-v2`，值为 `{ [chapterIndex]: ["egg-id", ...] }`。

### 4.2 迁移脚本

`init()` 阶段读取旧 key（`crown-outpost-easter-eggs`），若 v2 不存在则把旧值放入 v2 的 `0` 章节键，再持久化。

### 4.3 校验

- 用户已领过 `old-pot` 后再次启动游戏，旧的 v1 仍能转换并阻止重复领取。
- `npm run build` 通过。

> 如未启动多章节，本任务可仅完成迁移代码并保留单章节判定。

---

## 5. T3 — 章节地图 1-2 解锁与跳转骨架

**目标**：让 `CampaignScene` 中 1-2 节点可点击进入，复用现有 `GameScene`，不影响其它节点。

### 5.1 修改 `src/scenes/CampaignScene.js`

#### 5.1.1 节点点击

- 给 `status === "next"` 节点绑定 `pointerdown`，跳转：

  ```js
  this.scene.start("GameScene", { levelId: "chapter-1-level-2" });
  ```

- 1-3、Boss 仍为 `locked`，点击只显示提示 "需先通关上一关"。

#### 5.1.2 完成后回章节地图

- 现有 `GameScene.finishVictory()` 已使用 `completedLevelId` 跳回 `CampaignScene`。让该字段透传 `this.levelId`。

### 5.2 修改 `src/scenes/GameScene.js`

#### 5.2.1 接收 `levelId`

- `init(data)`：读取 `this.levelId = data?.levelId ?? "chapter-1-level-1"`。
- `finishVictory()` 中 `localStorage.setItem` 改为按 `levelId` 写键（如 `crown-outpost-${levelId}-complete`）。
- `scene.start("CampaignScene", { completedLevelId: this.levelId, ... })`。

#### 5.2.2 状态推进

- `CampaignScene.init` 根据 `localStorage` 中已完成的 levelId 更新 `LEVELS[i].status`：完成的 → `completed`，紧随其后的 → `next`，再后的 → `locked`。

### 5.3 验收

- 通关 1-1 后回到章节地图，1-2 显示为 `next` 可点击。
- 点击 1-2 进入战斗（暂时与 1-1 数值相同，T4 再做差异）。
- 点击 1-3 / Boss 显示提示并不进入战斗。
- `npm run build` 通过。

---

## 6. T4 — 第 1 章 1-2、1-3 战斗参数差异

**目标**：参考设计文档 §关卡节奏建议，让 1-2、1-3 与 1-1 在敌人组成上有可感知差别。

### 6.1 数据落点

新建（如不存在）`src/data/levels.js`：

```js
export const LEVELS = {
  "chapter-1-level-1": {
    name: "王冠前哨",
    waveCount: 10,
    enemyMix: "basic",
    description: "基础敌人，熟悉建塔。",
  },
  "chapter-1-level-2": {
    name: "北桥林道",
    waveCount: 10,
    enemyMix: "tougher",
    description: "出现较硬的敌人，提高单位生命。",
  },
  "chapter-1-level-3": {
    name: "旧王城门",
    waveCount: 10,
    enemyMix: "rare-mix",
    description: "出现稀有敌人，掉率提高。",
  },
  "chapter-1-boss": {
    name: "黑石要塞",
    waveCount: 12,
    enemyMix: "boss",
    description: "章节 Boss，必掉稀有以上装备或图纸碎片。",
  },
};
```

### 6.2 GameScene 接入

- `init` 阶段读取 `LEVELS[this.levelId]`，把 `waveCount` 写到 `this.totalWaves`，替换原来对 `TOTAL_WAVES` 常量的直接读取（`TOTAL_WAVES` 仍保留作为默认值）。
- `getEnemyStats(wave)`：根据 `enemyMix` 调整生命 / 速度 / 掉落概率。具体调整数值参考设计文档 §敌人掉落 与 §关卡节奏建议；`tougher` 提升 +20% 生命，`rare-mix` 增加稀有怪比例至 30%，`boss` 在最后一波强制 boss 怪。
- 不要让 1-2、1-3 提供新装备类型，沿用 `BASIC_SHOP_ITEMS`。

### 6.3 验收

- 1-2 关明显比 1-1 难（手测：用同样阵容更易掉血）。
- 1-3 关掉装备频率明显高于 1-1。
- `npm run build` 通过。

---

## 7. T5 — 第 1 章 Boss 关：必掉稀有以上装备或图纸碎片

**目标**：实现设计文档 §敌人掉落 中 "章节 Boss：必掉稀有以上装备或图纸碎片" 的规则。

### 7.1 GameScene 修改

- `chapter-1-boss` 关最后一波击杀 boss 时，在原掉落判定之前优先：
  - 50% 概率掉落一件随机稀有 / 史诗装备（沿用 `createEquipment(pickRandom(BASIC_SHOP_ITEMS), rarity)`，`rarity` 在 `稀有 / 史诗` 中按 0.6 / 0.4 选取）。
  - 50% 概率掉落 1 个图纸碎片。
- 章节 Boss 的精英商人逻辑保持原样，与该掉落叠加。

### 7.2 验收

- Boss 击杀后必出 1 个明显奖励（背包多 1 件稀有以上装备 或 图纸碎片 +1）。
- `npm run build` 通过。

---

## 8. T6 — 商人触发节奏与设计文档对齐

**目标**：消除 "wave 模 3" 与 "level 模 3" 的语义混淆，明确单局内商人 = 设计文档 §野生商人 的 "每三关"。

### 8.1 设计语义

- 设计文档把 "关" 当作章节地图上的一个节点（1-1、1-2、…）。一个节点内仍有多波敌人。
- 因此 "每三关一次野生商人" 对应：在章节地图节点 **结束后**（即 `finishVictory` 之前）触发，而不是单局战斗的 wave 3 / 6 / 9 弹商人。

### 8.2 修改方案

- 在 `GameScene.checkWaveComplete` 删除原 `if (this.wave % 3 === 0)` 触发野生商人的逻辑。
- 在 `finishVictory()` 内：
  - 若 `this.levelId` 形如 `chapter-1-level-3` / `chapter-1-level-6` / `chapter-1-level-9`，关结束后弹野生商人（仍复用 `openMerchant("wild", false)`），关闭后再 `scene.start("CampaignScene", ...)`。
  - 若 `this.levelId` 是 `chapter-1-boss`，弹精英商人，关闭后再回章节地图，并标记章节通关。
- 单局内的最终 boss 仍可掉装备 / 图纸（T5 已实现），与商人无冲突。

### 8.3 设计文档同步

- 在 `doc/game-design.md` §野生商人 末尾补一条："野生商人在关卡结束界面触发，与单局内的波次无关。"（这与现有 §野生商人 的 "出现规则" 一致，仅强调实现层面。）

### 8.4 验收

- 1-3 关通关后弹出野生商人；1-1、1-2 关通关不弹野生商人。
- Boss 关通关弹出精英商人。
- 单局战斗中不再有 wave 3 / wave 6 弹商人的行为。
- `npm run build` 通过。

---

## 9. T7 — 关卡推进存档

**目标**：刷新页面后保留章节地图进度，无需重新通关 1-1。

### 9.1 存储 key

- 完成关卡：复用 T3 的 `crown-outpost-${levelId}-complete`。
- 不再使用旧的 `crown-outpost-chapter-1-level-1-complete` 单独 key（保留作为兼容读取）。

### 9.2 兼容读取

- `CampaignScene.init` 读取所有 `chapter-1-*-complete` 键，并把旧 key 视为 `chapter-1-level-1` 已完成。
- 其它跨关数据（`gold`、`inventory`、`unlockedBlueprints`、`bestWave`）暂保持当前每局重置，不引入完整存档系统（留待未来任务）。

### 9.3 验收

- 通关 1-1、1-2 后刷新页面，`CampaignScene` 仍显示 1-1、1-2 已完成，1-3 为 `next`。
- `npm run build` 通过。

---

## 10. T8 — 烟雾测试

### 10.1 手动流程（用 `npm run dev`）

按顺序确认：

1. 首次启动 → 开场漫画 4 格 → 进入 1-1 战斗。
2. 1-1 战斗：
   - 开局有 60 秒准备阶段，"立即开始" 按钮显示剩余秒数；提前 1 秒开始 = 1 金币奖励。
   - 每波结束后 30 秒准备。
   - 单局内不弹野生商人（T6 后预期）。
3. 通关 1-1 → 章节地图，1-2 变 `next`。
4. 进入 1-2 战斗，敌人感知更硬（T4）。
5. 通关 1-3 → 章节地图前先弹野生商人。
6. 通关 Boss → 必掉稀有装备或图纸碎片 + 弹精英商人。
7. 章节通关后回章节地图，所有节点变 `completed`。
8. 王铁柱连续格挡 5 次 → 一次性 +50 金 提示（T1）。
9. 刷新页面：
   - `IntroComicScene` 因 `INTRO_SEEN_KEY` 已记 → 跳过漫画。
   - `CampaignScene` 进度仍保留（T7）。

### 10.2 自动化检查

```powershell
npm run build
```

必须无错误、无类型告警。

---

## 11. 严格禁止事项

- 不要修改 `doc/game-design.md` 的玩法规则（除非任务明确要求）。
- 不要把战斗参数 / 装备数值 "顺便平衡"，这些数据已在设计文档中定稿。
- 不要把 PowerShell `Get-Content`/`Set-Content` 用于含中文的源码或 md 文件。
- 不要为了通过构建去注释 / 删除测试或现有功能。
- 不要引入新的第三方依赖（除 Phaser 已有依赖以外），除非任务列表明确允许。
- 不要把美术资源真实图片提交到仓库（图片由用户后续提供），只提交目录占位 `.gitkeep`。

---

## 12. 任务状态自检模板

每完成一个任务，在 PR / commit 描述里贴以下表格：

```
- [x] T1 彩蛋扩充：王铁柱连续格挡
- [ ] T2 彩蛋数据按章节存档
- [ ] T3 章节地图 1-2 解锁与跳转骨架
- [ ] T4 第 1 章 1-2、1-3 战斗参数差异
- [ ] T5 第 1 章 Boss 关掉落
- [ ] T6 商人触发节奏对齐
- [ ] T7 关卡推进存档
- [ ] T8 烟雾测试
构建：npm run build 通过 / 失败
手测：T1–TN 流程通过 / 失败
```

完成全部 T1–T8 后，本文件可保留作为变更记录依据，**不要删除**。

---

## 13. 变更记录

- 2026-05：按当前 `doc/game-design.md`（含准备阶段规则）与现有代码状态重写本文件。原 "晨曦守望 5 章 + 18 波" 任务清单已废弃。
