# GPT5.5（低推理模式）执行任务清单

> 本文件给 GPT5.5 低推理模式（low reasoning）使用。要求：**严格按顺序、按步骤、按文件路径执行**，不要自行发挥创意，不要重命名或删除未指定的内容。
>
> 唯一权威设计文件：`doc/game-design.md`。本文件是把设计文档拆成可机械执行的小步任务。
>
> 主版本是 `src/` 下的 Phaser/Vite 项目。**不要碰 `project.godot`、`scenes/`（根目录的）、`scripts/`（根目录的）**。

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

---

## 1. 任务总览（按顺序执行）

| 编号 | 标题 | 依赖 |
|---:|---|---|
| T1 | 拆分场景：新增 BootScene、SplashScene、MenuScene、SettingsScene、ComicScene | 无 |
| T2 | 把现有 GameScene 改造为接收 `chapterIndex` 参数 | T1 |
| T3 | 引入 5 章地图与 18 波节奏数据（`src/data/chapters.js`） | T2 |
| T4 | 商人触发节点改为每章第 6 / 12 波后概率，第 18 波后必出精英商人 | T3 |
| T5 | 新增章节漫画数据 `src/data/comics.js` 与漫画播放场景 | T1 |
| T6 | 新增存档系统 `src/utils/save.js` 与 “读取进度” 流程 | T2 |
| T7 | 新增 “王铁柱连续格挡多次” 彩蛋；彩蛋按章节存档 | T3 |
| T8 | 占位资源接入：`assets/` 目录与缺图回退 | T5 |
| T9 | 在 `doc/ASSET_PROMPTS.md` 输出全部 GPT 图像生成提示词 | T5 |
| T10 | 烟雾测试：5 章流程可走通到结局漫画 | T1–T9 |

---

## 2. T1 — 拆分场景骨架

**目标**：把当前单一 `GameScene` 启动改成多场景，但 **不破坏现有战斗逻辑**。

### 2.1 新建文件

创建以下空骨架文件（每个文件都用 `write_to_file`，先确认不存在）：

- `src/scenes/BootScene.js`
- `src/scenes/SplashScene.js`
- `src/scenes/MenuScene.js`
- `src/scenes/SettingsScene.js`
- `src/scenes/ComicScene.js`

每个文件初始内容模板（替换 `XXXScene`）：

```js
import Phaser from "phaser";

export class XXXScene extends Phaser.Scene {
  constructor() {
    super("XXXScene");
  }

  create(data) {
    // TODO: implemented in later tasks
  }
}
```

### 2.2 修改 `src/main.js`

把 `scene: GameScene` 改为：

```js
scene: [BootScene, SplashScene, MenuScene, SettingsScene, ComicScene, GameScene],
```

并补齐 import。第一个场景必须是 `BootScene`。

### 2.3 BootScene 实现

`src/scenes/BootScene.js` 的 `create`：

- 不做任何资源加载（资源任务在 T8）。
- 立即 `this.scene.start("SplashScene");`。

### 2.4 SplashScene 实现（占位）

- 渲染纯色背景（参考 `doc/game-design.md` §2.1，先用渐变矩形 + 标题文字 “晨曦守望”）。
- 显示 “点击任意位置继续” 提示。
- 监听 `pointerdown` 与 `keydown`，跳转到 `MenuScene`。

### 2.5 MenuScene 实现（占位）

- 居中渲染 4 个按钮，纵向等距：
  1. **游戏开始** → `this.scene.start("ComicScene", { chapterIndex: 0, kind: "prologue", next: { scene: "GameScene", data: { chapterIndex: 0 } } });`
  2. **读取进度** → 占位，先 `console.log("load")`，T6 实现。
  3. **设置游戏** → `this.scene.start("SettingsScene");`
  4. **退出游戏** → `window.close()`（在浏览器中通常无效，先 `console.log("quit")`）。
- 按钮要求：等宽 240、高 56，间距 18 像素，居中。
- 键盘 ↑/↓ 切换、回车确认；鼠标悬停高亮。

### 2.6 SettingsScene 实现（占位）

- 显示标题 “设置”。
- 显示一个 “返回” 按钮回到 MenuScene。
- 真实设置项在后续任务，本任务只搭骨架。

### 2.7 验收

- `npm run build` 通过。
- `npm run dev` 后看到：开机画面 → 主菜单 4 选项 → 点击 “游戏开始” 进入空白漫画场景（T5 之前漫画场景显示占位文字 “Chapter 1 Prologue (TODO)” 后按键跳到 `GameScene`）。
- ComicScene 占位行为：显示标题 + “按任意键继续”，触发后调用 `this.scene.start(data.next.scene, data.next.data)`。

---

## 3. T2 — GameScene 接收 `chapterIndex`

**目标**：让 `GameScene` 知道自己是第几章，但暂不改地图视觉。

### 3.1 修改 `src/scenes/GameScene.js`

- `init(data)`：读取 `data?.chapterIndex ?? 0`，存为 `this.chapterIndex`。
- 顶部 HUD 增加文字 `第 N 章` （N = `chapterIndex + 1`）。
- 不要修改其它字段。

### 3.2 修改 `src/data/map.js`

把 `TOTAL_WAVES` 从 `10` 改为 `18`。

> ⚠️ 这会改变现有节奏，下一任务 T3 会同步调整商人 / Boss 触发逻辑。如本任务后立即 `npm run dev` 走完 18 波会出现精英商人，是预期行为。

### 3.3 验收

- `npm run build` 通过。
- HUD 上能看到 “第 1 章” 字样。
- 一局战斗共 18 波。

---

## 4. T3 — 5 章数据与节奏

**目标**：抽出每章数据，按设计文档 §5 提供章节切换。

### 4.1 新建 `src/data/chapters.js`

```js
export const CHAPTERS = [
  {
    id: 0,
    name: "边境平原",
    bgColor: 0x87b866,
    panelColor: 0x9bcf73,
    enemyTintBoss: 0xffcf70,
    waves: 18,
  },
  {
    id: 1,
    name: "幽暗森林",
    bgColor: 0x3f6b48,
    panelColor: 0x4f8458,
    enemyTintBoss: 0x9be29a,
    waves: 18,
  },
  {
    id: 2,
    name: "烈焰火山",
    bgColor: 0x6b2a1f,
    panelColor: 0x8a3a26,
    enemyTintBoss: 0xff7a3a,
    waves: 18,
  },
  {
    id: 3,
    name: "极北雪山",
    bgColor: 0x6c8aa6,
    panelColor: 0x88a9c4,
    enemyTintBoss: 0xc8e6ff,
    waves: 18,
  },
  {
    id: 4,
    name: "回响之渊",
    bgColor: 0x2a1f3a,
    panelColor: 0x3c2c52,
    enemyTintBoss: 0xb887ff,
    waves: 18,
  },
];

export const TOTAL_CHAPTERS = CHAPTERS.length;
```

### 4.2 GameScene 使用章节

- `createMap()` 中：把硬编码的 `0x87b866`、`0x9bcf73` 替换为 `CHAPTERS[this.chapterIndex].bgColor / panelColor`。
- HUD “第 N 章” 后追加章节名，例如 “第 1 章 · 边境平原”。
- 章节 Boss 颜色用 `enemyTintBoss` 替换原来的 `0xffcf70`（仅在 `rank === "boss"` 时）。

### 4.3 不要改

- 路径点 `PATH_POINTS`、塔位、装饰物在本任务保持不变（资源完善留给 T8）。

### 4.4 验收

- 用 `MenuScene` 暂时增加一个调试按钮（或在 init 接受 `chapterIndex` 参数）能看到 5 章的不同背景色。
- `npm run build` 通过。

---

## 5. T4 — 商人触发节点

**目标**：把每 3 关一次的野生商人改为按 §5.3 的章内节奏。

### 5.1 修改 `GameScene.checkWaveComplete` 中的商人触发逻辑

定位现有片段（约 1070–1080 行）：

```js
if (this.wave >= TOTAL_WAVES) {
  this.openMerchant("elite", true);
  return;
}

if (this.wave % 3 === 0) {
  this.openMerchant("wild", false);
  return;
}
```

替换为：

```js
if (this.wave >= TOTAL_WAVES) {
  this.openMerchant("elite", true);
  return;
}

if (this.wave === 6 || this.wave === 12) {
  // 设计文档 §5.3：第 6 / 12 波后概率出现野生商人
  if (Math.random() < 0.7) {
    this.openMerchant("wild", false);
    return;
  }
}
```

### 5.2 第 18 波 Boss 行为

确认：`wave === 18` 时 `getCurrentRank` 返回 `"boss"`。如果不是，就在 `getCurrentRank` 里追加：

```js
if (this.wave === TOTAL_WAVES && isLast) {
  return "boss";
}
```

放在现有规则之前。

### 5.3 章节切换

完成精英商人关闭后（搜索 `finalAfterClose` 处），在原结束逻辑之后增加：

```js
if (this.chapterIndex < TOTAL_CHAPTERS - 1) {
  this.scene.start("ComicScene", {
    chapterIndex: this.chapterIndex,
    kind: "epilogue",
    next: {
      scene: "ComicScene",
      data: {
        chapterIndex: this.chapterIndex + 1,
        kind: "prologue",
        next: { scene: "GameScene", data: { chapterIndex: this.chapterIndex + 1 } },
      },
    },
  });
} else {
  this.scene.start("ComicScene", {
    chapterIndex: 4,
    kind: "epilogue",
    next: { scene: "MenuScene" },
  });
}
```

不要保留原先的 “通关大结局” 提示框，但保留分数 / bestWave 的存储。

### 5.4 验收

- 通关 1 章后会进入章末漫画 → 章首漫画 → 下一章战斗。
- 通关第 5 章后回主菜单。

---

## 6. T5 — 漫画数据与场景

### 6.1 新建 `src/data/comics.js`

每章包含 `prologue` 与 `epilogue`，每段 4 格。每格字段：

```js
{ image: "ch1_prologue_1", caption: "王都广场，女王宣誓出征。", dialog: "女王：勇者，请！" }
```

按 `doc/game-design.md` §4.3 给出的 5 章 × 2 段 × 4 格 = 40 格 **逐字** 抄写描述作为 `caption`，`dialog` 自行从描述里提炼一句即可（如无明显对白用 `""`）。`image` 字段对应 T8 的资源命名 `ch{n}_{kind}_{i}`，n 从 1 起、i 从 1 起。

### 6.2 实现 `src/scenes/ComicScene.js`

`create(data)`：

- 读取 `data.chapterIndex`（0–4）、`data.kind`（"prologue" | "epilogue"）、`data.next`。
- 从 `comics.js` 取出 4 格数组。
- 黑底，画面顶部显示 “第 N 章 · 序章/终章 · 第 i / 4 格”。
- 中央显示当前格的图片（若纹理不存在，画灰底矩形 + 字幕作为回退）。
- 底部显示 `caption` + `dialog`。
- 监听 `pointerdown` / `keydown`：
  - 当前格 < 4：前进到下一格。
  - 当前格 = 4：调用 `this.scene.start(data.next.scene, data.next.data)`。

### 6.3 验收

- 5 章前后共 10 段漫画都能完整翻完。
- 即使没有图片资源也不报错（用回退渲染）。

---

## 7. T6 — 存档系统

### 7.1 新建 `src/utils/save.js`

```js
const KEY = "crown-outpost-save-v1";

export function loadSave() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); }
  catch { return null; }
}

export function writeSave(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearSave() {
  localStorage.removeItem(KEY);
}
```

### 7.2 在 GameScene 写存档

- `init()` 末尾：尝试 `loadSave()`，如果 `data?.chapterIndex === this.chapterIndex` 且包含金币、装备、解锁图纸，则恢复（只恢复跨关持久数据：`gold`, `inventory`, `unlockedBlueprints`, `bestWave`，**不恢复战斗中状态**）。
- 在每章 Boss 通关后（精英商人关闭后、跳漫画前），调用 `writeSave({ chapterIndex: this.chapterIndex + 1, gold, inventory, unlockedBlueprints: [...this.unlockedBlueprints], bestWave: this.bestWave })`。

### 7.3 MenuScene “读取进度” 实现

- 点击时读取 `loadSave()`：
  - 没有存档：弹出文本提示 “暂无存档”。
  - 有存档：跳转到 `ComicScene` 序章，章节为存档的 `chapterIndex`（若 `>= 5`，则提示 “已通关”，回菜单）。

### 7.4 SettingsScene 增加 “重置存档”

- 二次确认（点两次按钮）后调用 `clearSave()`，提示 “已重置”。

### 7.5 验收

- 关掉浏览器再打开，“读取进度” 能从上次完成的章节继续。

---

## 8. T7 — 彩蛋扩展

### 8.1 修改 `src/data/easterEggs.js`

新增条目：

```js
{ id: "tiezhu-block-streak", virtual: true, reward: 50, label: "铁壁连防" }
```

### 8.2 GameScene 监听王铁柱连续格挡

- 在英雄格挡触发处（搜索 `blockChance` 命中分支），给 `tiezhu` 维护 `hero.blockStreak`：成功格挡 +1，受到伤害但未格挡时清零。
- 当 `blockStreak === 5` 且 `tiezhu-block-streak` 未领取：发金币 50、记入 `claimedEasterEggs`、`localStorage` 存档，弹通知 “彩蛋：铁壁连防 +50 金”。

### 8.3 彩蛋存档按章节

把 localStorage key 从 `crown-outpost-easter-eggs` 改为 `crown-outpost-easter-eggs-v2`，存为 `{ [chapterIndex]: [ids...] }`，按章节维度独立。`createEasterEggs` 用当前 `chapterIndex` 的子集判断是否已领。

### 8.4 验收

- 王铁柱连续格挡 5 次能拿到一次 50 金奖励，再多次不会重复给。

---

## 9. T8 — 美术资源接入

### 9.1 目录结构

新建 `assets/` 目录及其子目录（按 `doc/game-design.md` §17.4）。`assets/` 放在仓库根（与 `src/` 同级）。`vite` 默认会把 `public/` 当静态目录，因此实际放在 `public/assets/` 下。

### 9.2 `BootScene` 加载

在 `BootScene.preload()` 加载（如果文件存在则加载，否则跳过）：

- `splash_main` ← `assets/splash/splash_main.png`
- `menu_bg` ← `assets/menu/menu_bg.png`
- `ch{1..5}_prologue_{1..4}` 与 `ch{1..5}_epilogue_{1..4}` ← `assets/comics/...`
- `ch{1..5}_map` ← `assets/maps/...`

加载失败用 `this.load.on("loaderror", ...)` 静默忽略。

### 9.3 回退渲染

- SplashScene、MenuScene、ComicScene、GameScene 在使用图片前都先用 `this.textures.exists(key)` 判断；不存在时使用纯色 / 渐变占位（已在前面任务里写过）。

### 9.4 验收

- `assets/` 为空时游戏仍能正常运行（占位画面）。
- 把任意一张 png 放进对应路径并刷新，对应位置自动出现该图。

---

## 10. T9 — 输出 GPT 图像提示词文件

### 10.1 新建 `doc/ASSET_PROMPTS.md`

文件结构：

```
# GPT 图像生成提示词

## 通用风格
（从 game-design.md §17.1 / §17.2 复制，保留为统一前缀）

## 开机画面
- 文件：assets/splash/splash_main.png
- 比例：16:9 / 1920×1080
- 提示词：<风格前缀> + <splash 内容描述>

## 主菜单背景
...

## 章节漫画
### 第 1 章 · 序章
- ch1_prologue_1.png：<风格前缀> + 第 1 章序章第 1 格描述
...
（5 章 × 2 段 × 4 格 = 40 项，逐项列出）

## 章节地图
- ch1_map.png：<风格前缀> + “边境平原 横版俯视，留出怪兽路径与建塔点”
...

## 角色立绘
- tiezhu.png / ergou.png / yueguang.png：<对应描述>
- queen.png：<女王描述>
- nightmaw.png：<夜噬描述>
```

内容必须从 `doc/game-design.md` §3、§4.3、§5.2、§17 中机械抽取，**不要新增情节**。

### 10.2 验收

- `doc/ASSET_PROMPTS.md` 存在，包含至少 40 段漫画提示词、5 段地图提示词、5 段角色立绘提示词、1 段 splash、1 段 menu。

---

## 11. T10 — 烟雾测试

### 11.1 手动流程（用 `npm run dev`）

按顺序确认：

1. 启动 → 开机画面 → 主菜单 4 选项可见。
2. 点击 “游戏开始” → 第 1 章序章漫画 4 格 → 第 1 章战斗（背景为草绿）。
3. 在第 6 / 12 波后偶尔出现野生商人；第 18 波 Boss 后必出精英商人。
4. 关闭精英商人 → 第 1 章终章漫画 → 第 2 章序章漫画 → 第 2 章战斗（背景为森林深绿）。
5. 重复直至第 5 章通关 → 终章漫画 → 回主菜单。
6. 关闭浏览器后重启 → “读取进度” 能从最近未通关的章节序章重新开始。
7. “设置 → 重置存档” 后 “读取进度” 显示 “暂无存档”。

### 11.2 自动化检查

```powershell
npm run build
```

必须无错误、无类型告警。

---

## 12. 严格禁止事项

- 不要修改 `doc/game-design.md`（除非任务明确要求）。
- 不要把战斗参数 / 装备数值 “顺便平衡”。这些数据已在设计文档中定稿。
- 不要把 PowerShell `Get-Content`/`Set-Content` 用于含中文的源码或 md 文件。
- 不要为了通过构建去注释 / 删除测试或现有功能。
- 不要引入新的第三方依赖（除 Phaser 已有依赖以外）。除非任务列表明确允许。
- 不要把 `assets/` 真实图片提交到仓库（图片由用户后续提供），只提交目录占位 `.gitkeep`。

---

## 13. 任务状态自检模板

每完成一个任务，在 PR / commit 描述里贴以下表格：

```
- [x] T1 拆分场景骨架
- [ ] T2 GameScene 接收 chapterIndex
- ...
构建：npm run build 通过 / 失败
手测：T1–TN 流程通过 / 失败
```

完成全部 T1–T10 后，本文件可保留作为变更记录依据，**不要删除**。
