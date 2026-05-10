# 任务执行说明书：两个 Boss 接入 + 非排队式出怪节奏 + 兵营产兵与集结点

## 【角色定义】

你是一个专门负责把美术 Boss 精灵图接入 Phaser/Vite 塔防游戏，并按设计需求改造出怪节奏与兵营机制的助手。你只做接入与机制改造，**不做美术再创作、不修改章节波次总数（仍为 18）、不修改塔的价格、不修改怪物 hp/速度/伤害基线**。

## 【任务目标】

本说明书包含 **3 个相对独立的子任务**，按 A → B → C 顺序执行；任一阶段构建失败，回滚该阶段全部修改并报告，但已通过的阶段保留。

- **A**：把 “奥术幽灵 BOSS”、“暗月术士” 两张精灵图作为指定章节的 boss 静态外观接入游戏。
- **B**：把当前固定间隔的出怪改成 “前少后多 + 簇内密集 + 簇间间歇” 的非排队式节奏。
- **C**：把 `barracks`（卫兵营）的两名固定 guards 改成会被周期性产出的 “兵”，玩家可设置兵的集结点；范围内敌人见兵会扑上去攻击兵 / 英雄，每个兵 / 英雄最多被 5 只小怪缠住，超出的小怪忽略并继续沿路径前进。

## 【执行步骤】

### A 阶段：两个 Boss 精灵图接入

A 阶段不做动画，只做静态 “躯干图” 替换。具体动画接入由后续任务处理（标记 `[待确认]` 即可）。

1. 在 `public/assets/` 下创建子目录 `bosses/`（已存在则跳过）。

2. 把用户提供的 2 张 PNG 按下表保存。识别依据为图片左上 / 顶部的标题文字：

   | 标题 | 文件名 |
   |---|---|
   | `奥术幽灵BOSS 行动精灵图集` / `Arcane Wraith` | `boss_wraith_sheet.png` |
   | `暗月术士 行动精灵图` / `Dark Moon Warlock` | `boss_warlock_sheet.png` |

3. 由于图片是包含多状态多帧的合集，本任务**不切片**。改为：再额外提取每张图 “行走（Walking）” 这一行的 **第 1 帧** 作为单帧静态 boss 外观。约定：

   - 若用户**已额外提供** 单帧 PNG `boss_wraith.png` 与 `boss_warlock.png` 在 `public/assets/bosses/` 下，则直接使用。
   - 若**未提供**：跳过 A 阶段第 5、6 步，控制台输出 `[待确认] 未提供单帧 boss 图，A 阶段仅完成图鉴接入`，但仍执行第 4 步图鉴。

4. 在 `src/scenes/GameScene.js` 的 `preload()` 末尾追加（容错由 `this.load.on("loaderror", ...)` 兜底）：

   ```js
   this.load.image("boss-wraith-sheet",  "assets/bosses/boss_wraith_sheet.png");
   this.load.image("boss-warlock-sheet", "assets/bosses/boss_warlock_sheet.png");
   this.load.image("boss-wraith",  "assets/bosses/boss_wraith.png");
   this.load.image("boss-warlock", "assets/bosses/boss_warlock.png");
   ```

5. 在 `src/data/map.js` 的 `CHAPTER_LAYOUT` 中（若该文件已按 `doc/规划/接入5张地图与路径.md` 重构，否则参考其方案先行重构）给指定两章添加 `bossTexture` 字段：

   - `CHAPTER_LAYOUT[1]`（第 2 章 幽暗森林）：添加 `bossTexture: "boss-warlock"`。
   - `CHAPTER_LAYOUT[4]`（第 5 章 回响之渊）：添加 `bossTexture: "boss-wraith"`。
   - 其它 3 章不加该字段。
   - 在两条新增字段同行写注释 `// [待确认] boss 章节归属，可由后续任务交换`。

6. 在 `GameScene.js` 的 `spawnEnemy(rank)` 中：

   - 进入 `rank === "boss"` 分支时，先读 `const layout = this.layout;`，然后：

     ```js
     let bossKey = "enemy-golem-walk";
     if (rank === "boss" && layout.bossTexture && this.textures.exists(layout.bossTexture)) {
       bossKey = layout.bossTexture;
     }
     ```

   - 把当前为 boss 创建精灵的 `texture` 由 `enemy-golem-walk`（或 `enemy-brute`）替换为 `bossKey`；其余字段（`hp`、`speed`、`scale`、`damage`、`tint`）**完全不动**。
   - 若 `bossKey` 不是动画精灵（即不是 `enemy-*-walk`），创建用 `this.add.image(...)` 而非 `this.add.sprite(...)`，且不调用 `play(...)`。

7. 新增 “Boss 图鉴” 入口：在 `createUi()` 中、紧接 “敌人图鉴” 按钮之后，追加：

   ```js
   this.bossCodexButton = this.createButton(
     PANEL_X + 62, 322, 100, 30, "Boss 图鉴",
     () => this.openBossCodex(),
     { fill: 0x6c4ea3, hoverFill: 0x8865c0, stroke: 0x2f1f4d, color: "#fff6d8" }
   );
   ```

   并新增方法 `openBossCodex()`：参考 `openTowerCodex` / `openEnemyCodex` 的模式，弹模态后用 2 个文字按钮（“奥术幽灵”、“暗月术士”）切换显示 `boss-wraith-sheet` 与 `boss-warlock-sheet` 整图。

8. 运行 `npm run build`，退出码必须 0。

### B 阶段：出怪节奏从 “等距排队” 改为 “簇式涌出”

9. 编辑 `src/scenes/GameScene.js`：

   - 在 `init` 末尾增加：`this.spawnPlan = [];`。
   - 新增方法 `buildSpawnPlan()`：

     ```js
     buildSpawnPlan() {
       const total = this.enemiesThisWave;
       const plan = [];
       let elapsed = 0;
       let clusterSize = 1;
       let remaining = total;
       const intraGap = 280;       // 簇内每只小怪间隔 ms
       const interGap = 1700;      // 簇之间间隔 ms
       const maxCluster = 5;
       while (remaining > 0) {
         const size = Math.min(clusterSize, remaining);
         for (let i = 0; i < size; i++) {
           plan.push(elapsed + i * intraGap);
         }
         elapsed = plan[plan.length - 1] + interGap;
         clusterSize = Math.min(clusterSize + 1, maxCluster);
         remaining -= size;
       }
       return plan;
     }
     ```

   - 在 `startWave()`（或现有开启波次的方法）中：把原本计算 `this.spawnEvery` 的逻辑保留，但额外赋值 `this.spawnPlan = this.buildSpawnPlan(); this.waveStartedAt = this.time.now;`。
   - 替换 `updateSpawning(time)` 中的判定逻辑：旧的 `time < this.nextSpawnAt` 改为 “按 `spawnPlan[spawnedThisWave]` 比对”：

     ```js
     updateSpawning(time) {
       if (!this.waveActive || this.spawnedThisWave >= this.enemiesThisWave) return;
       const dueAt = this.waveStartedAt + this.spawnPlan[this.spawnedThisWave];
       if (time < dueAt) return;
       const rank = this.getCurrentRank(this.spawnedThisWave + 1, this.enemiesThisWave);
       this.spawnEnemy(rank);
       this.spawnedThisWave += 1;
     }
     ```

   - 删除或停用旧的 `this.nextSpawnAt = time + this.spawnEvery;` 一类语句；`spawnEvery` 字段可保留为废弃常量，但不再决定出怪。

10. **数值约束（不许变）**：

    - `getWaveEnemyTotal(wave)` 公式 / 总数 **不变**。
    - `getCurrentRank` 的 boss / elite / rare 判定 **不变**。
    - 仅出怪时间分布改变；总波时长允许延长 0–35%（无需精确控制，由 `intraGap=280`、`interGap=1700` 自然得出）。

11. 重新 `npm run build`，退出码 0；`npm run dev` 实测：第 1 波前 2 只小怪在 1.7 秒后再来 2 只，再 1.7 秒后来 3 只，**不再** 是固定每 0.82 秒一只的等距队列。

### C 阶段：兵营产兵 + 集结点 + 嘲讽与 5 只上限

C 阶段最复杂，分为 C1（数据结构）→ C2（产兵循环）→ C3（敌人 AI 改造）→ C4（玩家设置集结点 UI）。每子步必须独立可编译。

#### C1 兵的数据结构

12. 编辑 `src/data/towers.js` 的 `TOWER_TYPES.barracks`：

    - **保留** 现有所有字段，**新增** 4 个字段：

      ```js
      soldierMax: 3,
      soldierProduceMs: 4200,
      soldierHp: 40,
      soldierDamage: 6,
      soldierAttackRate: 950,
      soldierAttackRange: 22,
      soldierSpeed: 72,
      soldierAggroRadius: 96,
      ```

    - 不要改 `damage`、`rate`、`range`、`price` 等已有字段。

13. 编辑 `src/scenes/GameScene.js`，在 `createTower(type, slot)` 或类似创建塔的方法中：当 `type === TOWER_TYPES.barracks` 时，在返回的 tower 对象上额外初始化：

    ```js
    tower.rallyPoint = { x: tower.x, y: tower.y + 24 }; // 默认集结点
    tower.soldiers = [];                                 // 当前在场的兵
    tower.nextSoldierAt = 0;                             // 下一次产兵时间
    ```

    **删除** 原 `createTowerGuards(tower)` 在创建兵营时的调用（即原本固定生成 2 名 guards 的代码），改为本任务的动态产兵；`createTowerGuards` 函数本体保留为死代码，不要删除函数定义。

#### C2 产兵循环

14. 修改 `updateBarracksTower(tower, target, time)`：删除原有的 “2 名 guards 跟随目标” 逻辑，全部替换为：

    ```js
    updateBarracksTower(tower, _target, time) {
      const def = TOWER_TYPES.barracks;
      // 1. 清理已死兵
      tower.soldiers = tower.soldiers.filter((s) => s.alive);
      // 2. 产兵
      if (tower.soldiers.length < def.soldierMax && time >= tower.nextSoldierAt) {
        const soldier = this.spawnSoldier(tower);
        tower.soldiers.push(soldier);
        tower.nextSoldierAt = time + def.soldierProduceMs;
      }
      // 3. 兵的行为：未交战则向集结点移动，到点驻守；交战则攻击当前 attacker
      tower.soldiers.forEach((s) => this.updateSoldier(s, time));
    }
    ```

15. 新增方法 `spawnSoldier(tower)`：

    ```js
    spawnSoldier(tower) {
      const def = TOWER_TYPES.barracks;
      const sprite = this.add.image(tower.x, tower.y, "guard")
        .setScale(0.82).setDepth(20);
      return {
        sprite,
        ownerTower: tower,
        x: tower.x, y: tower.y,
        hp: def.soldierHp, maxHp: def.soldierHp,
        damage: def.soldierDamage,
        attackRate: def.soldierAttackRate,
        attackRange: def.soldierAttackRange,
        speed: def.soldierSpeed,
        nextAttackAt: 0,
        alive: true,
        attackers: new Set(), // 当前正在攻击该兵的敌人引用集合（用于 5 只上限）
      };
    }
    ```

    若类已有 `"guard"` 纹理则复用；否则在 `createTextures` 检查并使用 `enemy-scout` 兜底。

16. 新增方法 `updateSoldier(soldier, time)`：

    ```js
    updateSoldier(soldier, time) {
      if (!soldier.alive) return;
      const rally = soldier.ownerTower.rallyPoint;
      // 当前最近的攻击者作为目标（攻击者一定是已锁定该兵的敌人）
      let target = null;
      let bestDist = Infinity;
      soldier.attackers.forEach((e) => {
        if (!e.alive) return;
        const d = Phaser.Math.Distance.Between(soldier.x, soldier.y, e.sprite.x, e.sprite.y);
        if (d < bestDist) { bestDist = d; target = e; }
      });
      if (target) {
        // 接近并攻击
        if (bestDist > soldier.attackRange) {
          this.moveTowards(soldier, target.sprite.x, target.sprite.y, soldier.speed);
        } else if (time >= soldier.nextAttackAt) {
          this.dealDamageToEnemy(target, soldier.damage);
          soldier.nextAttackAt = time + soldier.attackRate;
        }
      } else {
        // 无敌人则回到集结点
        const d = Phaser.Math.Distance.Between(soldier.x, soldier.y, rally.x, rally.y);
        if (d > 4) {
          this.moveTowards(soldier, rally.x, rally.y, soldier.speed);
        }
      }
      soldier.sprite.x = soldier.x;
      soldier.sprite.y = soldier.y;
    }

    moveTowards(obj, tx, ty, speed) {
      const dt = this.game.loop.delta / 1000;
      const dx = tx - obj.x, dy = ty - obj.y;
      const dist = Math.hypot(dx, dy) || 1;
      const step = Math.min(dist, speed * dt);
      obj.x += dx / dist * step;
      obj.y += dy / dist * step;
    }
    ```

    若类已有同名 `dealDamageToEnemy(enemy, damage)` 之类，则复用；否则简化实现：`enemy.hp -= damage; if (enemy.hp <= 0) { enemy.alive = false; ... }` —— 但此处 **不要** 重复进入掉落逻辑；调用现有的 `killEnemy(enemy)` 或类似方法（搜索 `enemy.hp <= 0` 看现有处理方式并复用）。

#### C3 敌人 AI 改造（嘲讽 + 5 只上限）

17. 在 `enemy` 对象创建时（`spawnEnemy` 末尾）追加字段：

    ```js
    enemy.lockedTarget = null;       // 当前被嘲讽到的目标（兵或英雄）
    enemy.savedProgress = 0;         // 离开路径前的 progress，用于回归
    ```

18. 在 `updateEnemies(time, delta)` 处理每只敌人前增加 “嘲讽搜索 / 维持”：

    ```js
    // 已锁定 → 检查目标是否仍有效
    if (enemy.lockedTarget) {
      const tgt = enemy.lockedTarget;
      const tgtAlive = (tgt.alive !== false) && (tgt.hp === undefined || tgt.hp > 0);
      if (!tgtAlive) {
        if (tgt.attackers) tgt.attackers.delete(enemy);
        enemy.lockedTarget = null;
      }
    }
    // 未锁定 → 在 aggroRadius 内寻找最近 “可锁定” 目标
    if (!enemy.lockedTarget) {
      const candidates = this.collectAggroCandidates(); // [{x,y, ref:soldierOrHero, attackers}]
      let best = null, bestD = Infinity;
      const aggro = TOWER_TYPES.barracks.soldierAggroRadius;
      candidates.forEach((c) => {
        if (c.attackers.size >= 5) return;       // 5 只上限：满则忽略
        const d = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, c.x, c.y);
        if (d <= aggro && d < bestD) { bestD = d; best = c; }
      });
      if (best) {
        enemy.savedProgress = enemy.progress;
        enemy.lockedTarget = best.ref;
        best.attackers.add(enemy);
      }
    }
    ```

    `collectAggroCandidates()` 实现：

    ```js
    collectAggroCandidates() {
      const list = [];
      this.towers.forEach((t) => {
        if (t.typeKey !== "barracks") return;
        t.soldiers.forEach((s) => {
          if (s.alive) list.push({ x: s.x, y: s.y, ref: s, attackers: s.attackers });
        });
      });
      this.heroes.forEach((h) => {
        if (h.hp > 0) {
          if (!h.attackers) h.attackers = new Set();
          list.push({ x: h.x, y: h.y, ref: h, attackers: h.attackers });
        }
      });
      return list;
    }
    ```

19. 修改敌人移动逻辑：

    - 如果 `enemy.lockedTarget` 存在：朝目标位置移动至攻击距离内（`attackRange = 18`），到达则按现有 `updateEnemyAttacks` 攻击；**不要** 沿路径推进 `progress`。
    - 如果 `enemy.lockedTarget` 为空：按现有 “沿 path 推进 progress” 行为执行。
    - 当目标失效（被打死 / 已脱离 aggroRadius 1.5 倍距离 / 自身被治疗满血脱离 etc）→ 解锁，从 `savedProgress` 继续推进。

20. 在 `updateEnemyAttacks(time)` 中：原本针对全部英雄的攻击改为：仅当 `enemy.lockedTarget === hero` 时才造成伤害；对兵的伤害交由 “locked target = soldier” 分支统一处理。每次成功命中 → `target.hp -= enemy.attackDamage`，若 `target.hp <= 0` → `target.alive = false`、销毁精灵、清理 `target.attackers`。

21. **5 只上限的强约束**：

    - 任何添加 `attacker` 的位置必须先判 `if (target.attackers.size >= 5) return;`。
    - 任何敌人死亡 / 解锁的位置必须 `target.attackers.delete(enemy);` 否则会泄漏并阻塞后续敌人。
    - 测试：在第 5 波及之后，单一兵周围最多观察到 5 只敌人围攻；第 6、第 7 只敌人应**直接走过**继续路径，而非排队等待。

#### C4 玩家设置集结点

22. 在 `selectTower(tower)`（或显示塔信息面板的方法）里，当 `tower.typeKey === "barracks"` 时，在面板增加按钮 “设置集结点”，点击后置 `this.rallySettingTower = tower; this.showNotice("点击地图设置集结点", "#2f4972");`。

23. 在 `create()` 里增加全局点击：

    ```js
    this.input.on("pointerdown", (p) => {
      if (!this.rallySettingTower) return;
      if (p.x > PANEL_X) return;       // 忽略 UI 面板区域
      this.rallySettingTower.rallyPoint = { x: Math.round(p.worldX), y: Math.round(p.worldY) };
      this.showNotice("集结点已更新", "#315c22");
      this.rallySettingTower = null;
    });
    ```

    若已有 `pointerdown` 回调，则把上述判断附加到现有回调内，**不要** 重复注册全局 listener 导致冲突。

24. 视觉提示：在 `update` 中，对每个 barracks tower 画一个直径 10 的浅蓝色小圆作为集结点标记（仅当该塔被选中时绘制）。每帧重建图形即可，无需缓存。

### 验收

25. 运行：

    ```powershell
    npm run build
    ```

    退出码必须 0。

26. 运行 `npm run dev -- --port 5173`，逐项验证：
    - 第 2 章 / 第 5 章 boss 出现时使用对应的 wraith / warlock 静态图，体型与原 golem boss 一致。
    - 第 1 波出怪：先 1 只 → 暂停 → 2 只簇 → 暂停 → 3 只簇……总数与旧版一致。
    - 建好兵营后每 4.2 秒产 1 名兵，最多 3 名同时存活。
    - 拖动集结点：选中兵营 → 点 “设置集结点” → 在地图上点击 → 兵向新点移动并驻守。
    - 兵在 96 像素范围内会被敌人嘲讽，最多 5 只敌人同时围攻一名兵；第 6 只敌人无视该兵继续沿路径前进。

## 【输入说明】

- **图片**：用户在对话中提供 2 张约 1024×580 的合集 PNG（含多状态多帧），分别为 “奥术幽灵 BOSS 行动精灵图集” 与 “暗月术士 行动精灵图”。可选额外提供 `boss_wraith.png` / `boss_warlock.png` 单帧图。
- **代码仓库**：根 `c:\MyGame`，主版本 `src/`。
- **重点文件**：
  - `src/data/map.js`、`src/data/towers.js`、`src/scenes/GameScene.js`。
- **设计参考**：`doc/game-design.md` §5（章节）、§7.1（王铁柱）、§13（弓箭塔），不修改其中任何条目。

输入示例：用户图片 1 顶部写 “奥术幽灵BOSS” → 必须保存为 `boss_wraith_sheet.png` → `CHAPTER_LAYOUT[4].bossTexture = "boss-wraith"`（即第 5 章）。

## 【输出要求】

A 阶段必须包含：

- `public/assets/bosses/` 下两张合集 PNG（如有单帧也一并归位）。
- `preload` 中至少 2 行 `boss-*-sheet` 加载语句。
- `CHAPTER_LAYOUT[1]` 与 `[4]` 各含 `bossTexture` 字段。
- `spawnEnemy` boss 分支根据 `layout.bossTexture` 选纹理。
- 新增 “Boss 图鉴” 按钮与 `openBossCodex` 方法。

B 阶段必须包含：

- `buildSpawnPlan()` 方法存在；`updateSpawning` 用 `spawnPlan` 而非 `nextSpawnAt`。
- 第 1 波目测 “簇式涌出”，不是等距队列。

C 阶段必须包含：

- `TOWER_TYPES.barracks` 新增 8 个 `soldier*` 配置字段。
- 创建兵营时初始化 `rallyPoint` / `soldiers` / `nextSoldierAt`，**不再** 调用 `createTowerGuards`。
- 新增 `spawnSoldier`、`updateSoldier`、`moveTowards`、`collectAggroCandidates` 方法。
- 敌人对象含 `lockedTarget` / `savedProgress`；`updateEnemies` 含锁定 / 解锁逻辑。
- 任何被锁目标 `attackers.size` 不会超过 5。
- 玩家可通过 “设置集结点” 按钮 + 地图点击改变兵的驻守点。

明确禁止：

- 不要修改 `TOTAL_WAVES`、`getWaveEnemyTotal`、`getCurrentRank` 的计数 / 概率公式。
- 不要修改任何敌人 rank 的 `hp/speed/damage/scale/reward`。
- 不要修改塔的 `damage/range/rate/price` 等已有数值字段。
- 不要修改英雄数据 `src/data/heroes.js`。
- 不要切片 boss 合集图、不要做 boss 动画（留给后续任务）。
- 不要新增 npm 依赖。
- 不要修改 `project.godot`、根 `scenes/`、`scripts/`、`docs/GODOT_MIGRATION.md`、`doc/game-design.md`、`AGENTS.md`。
- 不要在 PowerShell 用 `Get-Content | Set-Content` 处理含中文的源码或 md 文件。

## 【边界与限制】

- 若 `src/data/map.js` 尚未按 `doc/规划/接入5张地图与路径.md` 重构（即没有 `CHAPTER_LAYOUT`）：A 阶段第 5 步暂用 `this.bossTextureOverride[chapterIndex]` 作为本地兜底（在 `GameScene.init` 中硬写 `{1: "boss-warlock", 4: "boss-wraith"}`），并在文件末尾加 `// [待确认] 等地图重构后迁移至 CHAPTER_LAYOUT.bossTexture`。
- 若用户未提供单帧 boss 图：仅完成第 4、7 步（图鉴用合集图直接展示），不替换战斗内 boss 外观；控制台输出 `[待确认] 缺少 boss 单帧图`。
- 若现有 `updateBarracksTower(tower, target, time)` 的签名与说明书不一致：以现有签名为准，本任务只替换函数体与调用 `createTowerGuards` 的位置，**不改签名**。
- 若 `enemy.attackers` 集合中混入已死亡敌人导致 5 只上限被错误占用：必须在敌人死亡处理中显式 `enemy.lockedTarget?.attackers?.delete(enemy)`；找不到该位置就停止 C3 阶段，输出 `[待确认] 找不到敌人死亡统一入口` 并报告搜索关键词 `enemy.alive = false`。
- 若 “设置集结点” 期间玩家点击了塔位 / UI / 已有兵：忽略点击不更新集结点；模式保持开启直到点击空地。
- 不确定兵的 `range` 或 `aggroRadius` 数值时：严格使用本说明书提供的数值（aggro=96、attackRange=22）。**不要** 自行平衡。
- 不确定簇间隔时长时：严格使用 `intraGap=280` / `interGap=1700`。
- C 阶段任一子步使构建失败：回滚 C 阶段全部改动（保留 A、B），输出失败子步编号。

## 【示例】

正例：

- 用户图 1（奥术幽灵）→ 保存 `boss_wraith_sheet.png` + `boss_wraith.png` → 第 5 章 Boss 出现为蓝色幽灵静态图，hp/伤害与原 golem-boss 完全一致。
- 第 1 波 12 只小怪：t=0 出 1 → t=1.7 出 2（间隔 0.28s 内）→ t=3.7 出 3 → t=6.0 出 4 → t=8.6 出 2（剩余）。
- 建造 1 座兵营 → 设集结点在路径附近 → 4.2s 后第一名兵走到集结点驻守 → 5 只小怪冲上去围攻 → 第 6 只小怪从兵身边走过继续路径。

反例：

- 把 `boss_wraith_sheet.png` 切成 5 帧 walk 动画并接入（错误：本任务不切片，不做动画）。
- 把 boss `hp` 由 620 提升到 800 “以匹配新外观”（错误：禁止改数值）。
- 把 `intraGap` 改成 100 “让画面更激烈”（错误：必须 280）。
- 把每个兵的 attackers 上限改成 3（错误：必须 5）。
- 兵营仍调用 `createTowerGuards(tower)` 生成两名固定 guards（错误：必须改成动态 `spawnSoldier`）。
- “设置集结点” 模式下点击 UI 面板把集结点设到面板里（错误：必须忽略 `p.x > PANEL_X`）。
- 敌人在 aggroRadius 外也被嘲讽（错误：严格距离判定）。

## 【自检清单】

- [ ] `public/assets/bosses/` 下含 `boss_wraith_sheet.png` 与 `boss_warlock_sheet.png`。
- [ ] `preload` 含 `boss-wraith-sheet`、`boss-warlock-sheet`、`boss-wraith`、`boss-warlock` 4 行加载。
- [ ] `CHAPTER_LAYOUT[1].bossTexture === "boss-warlock"`、`CHAPTER_LAYOUT[4].bossTexture === "boss-wraith"`（或本地兜底等价实现）。
- [ ] `spawnEnemy` boss 分支按 `layout.bossTexture` 选纹理。
- [ ] 创建了 “Boss 图鉴” 按钮、`openBossCodex` 方法。
- [ ] `buildSpawnPlan()` 存在；`updateSpawning` 通过 `spawnPlan[i]` 决定时间。
- [ ] `intraGap=280`、`interGap=1700` 数值正确。
- [ ] `TOWER_TYPES.barracks` 新增 8 个 `soldier*` 字段，原有 `damage/range/rate/price` 未变。
- [ ] 创建兵营初始化 `rallyPoint/soldiers/nextSoldierAt`，未调用 `createTowerGuards`。
- [ ] `spawnSoldier`、`updateSoldier`、`moveTowards`、`collectAggroCandidates` 4 个方法存在。
- [ ] `enemy` 对象含 `lockedTarget`、`savedProgress` 字段。
- [ ] 任何 `attackers.add` 调用前都有 `attackers.size >= 5` 判定。
- [ ] 任何敌人 / 兵 / 英雄死亡处都把自己 / 自己的 attackers 集合清理干净。
- [ ] 玩家可通过 “设置集结点” 按钮改变兵的驻守点；UI 面板区域点击被忽略。
- [ ] `npm run build` 退出码 0；`npm run dev` 中 3 项主验收通过（boss 外观 / 簇式出怪 / 兵营 5 只上限）。
- [ ] 未触碰 `project.godot`、根 `scenes/`、`scripts/`、`doc/game-design.md`、`AGENTS.md`、英雄 / 装备 / 塔的核心数值。
