# 开发指南

## 当前主版本

当前主开发版本是 Web/Phaser 版，入口在 `src/main.js`，主要场景在 `src/scenes/GameScene.js`。

Godot 文件目前作为迁移参考保留，不作为默认开发目标。除非明确要做 Godot 版本，否则只改 `src/` 和 `doc/`。

## 设定来源

游戏规则以 `doc/game-design.md` 为准。

新增玩法建议先写进设定文档，再实现到代码里。这样后续开发不需要从聊天记录里回溯旧设定。

## 目录说明

| 路径 | 用途 |
|---|---|
| `src/main.js` | Phaser 启动配置 |
| `src/scenes/GameScene.js` | 主场景、战斗循环、UI 交互 |
| `src/data/map.js` | 地图、路径、尺寸常量 |
| `src/data/heroes.js` | 英雄基础数据 |
| `src/data/equipment.js` | 装备和品质数据 |
| `src/data/towers.js` | 防御塔和特殊塔数据 |
| `src/data/easterEggs.js` | 一次性彩蛋数据 |
| `src/render/textures.js` | 程序化贴图绘制 |
| `src/utils/random.js` | 小型通用工具 |
| `doc/game-design.md` | 游戏设定文档 |

## 推荐工作方式

每次开发尽量只改一个系统，例如：

- 只改英雄数值。
- 只改装备商店。
- 只改敌人掉落。
- 只改弓箭塔分支。
- 只改商人商品。

搜索时优先限定范围：

```powershell
rg "格挡" src doc
```

不要搜索 `node_modules`、`dist`、`.godot`，这些目录不是日常开发上下文。

## 验证命令

代码修改后运行：

```powershell
npm run build
```

本地游玩测试：

```powershell
npm run dev -- --port 5173
```
