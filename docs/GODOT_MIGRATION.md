# Godot 4 + GDScript 迁移说明

当前 Godot 版本入口：

- 项目文件：`project.godot`
- 主场景：`scenes/main.tscn`
- 主脚本：`scripts/main.gd`

这个版本保留了当前塔防目标：完整玩法闭环、地图、波次、塔升级、英雄技能。为方便快速迭代，第一版没有依赖外部图片资源，地图、塔、怪物、弹道和英雄都在 GDScript 中程序化绘制。

运行方式：

1. 安装 Godot 4.x。
2. 打开 Godot Project Manager。
3. Import 选择 `C:\MyGame\project.godot`。
4. 点击 Run。

旧的 Phaser/Vite 原型暂时保留在 `src/`、`index.html`、`package.json` 中，作为可运行参考。确认 Godot 版本稳定后，再清理旧 Web 原型更稳妥。
