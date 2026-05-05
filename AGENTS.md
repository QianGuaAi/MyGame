# Project Instructions

## Main Version

The active game implementation is the Phaser/Vite version under `src/`.

Godot files under `project.godot`, `scenes/`, `scripts/`, and `docs/GODOT_MIGRATION.md` are migration/reference material. Do not modify them unless the user explicitly asks for Godot work.

## Source Of Truth

Use `doc/game-design.md` as the gameplay design source of truth. When gameplay rules change, update that document first or in the same change.

## Search Scope

Prefer searching only:

```powershell
rg "term" src doc AGENTS.md package.json
```

Avoid `node_modules/`, `dist/`, `.godot/`, generated logs, screenshots, and imported asset metadata.

## Module Map

- `src/main.js`: Phaser bootstrapping only.
- `src/scenes/GameScene.js`: active gameplay scene.
- `src/data/`: static gameplay data.
- `src/render/`: procedural texture drawing helpers.
- `src/utils/`: small shared helpers.
- `doc/`: design and development notes.

## Development Checks

Run this after code changes:

```powershell
npm run build
```

Use the local Phaser dev server for manual testing:

```powershell
npm run dev -- --port 5173
```
