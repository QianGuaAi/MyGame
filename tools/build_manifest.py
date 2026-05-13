"""Build the image-generation manifest described in doc/AI_IMAGE_GENERATION_BRIEF.md.

The generated manifest is intentionally data driven: each entry contains the
full prompt, API parameters, reference-image dependencies, raw output path,
final game-asset path, and post-processing instructions.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


STYLE_BASE = (
    "Hand-drawn fantasy game art, warm color palette, soft cel-shading, "
    "clean clear outlines, mild rim lighting, painterly textures, slight "
    "2.5D top-down perspective for sprites, consistent with classic JRPG "
    "and indie tower-defense aesthetics; reference style: warm storybook "
    "illustration; no realism, no photo texture; medium saturation, no neon."
)

NEGATIVE_BASE = (
    "text, letters, words, asian characters, chinese characters, japanese kana, "
    "watermark, signature, logo, copyright mark, frame, border, speech bubble, "
    "caption, blurry, out of focus, low quality, jpeg artifacts, compression "
    "artifacts, photo, photorealistic, 3d render, octane render, plastic, cgi "
    "look, multiple characters, twins, duplicate, crowd, extra limbs, extra "
    "fingers, six fingers, deformed hands, missing hands, mutated, ugly, dull, "
    "oversaturated neon, cyberpunk, modern objects, realistic drop shadow on "
    "ground, cast shadow, ground plane, white background, gray background, "
    "color background when transparent requested, checker pattern, transparency "
    "checker, visible canvas border, color frame, vignette."
)

PALETTE_REF = "ref/palette-master.png"

HERO_LOCKS = {
    "tiezhu": (
        "Wang Tiezhu, sturdy young frontline defender, dark blue padded armor, "
        "steel shoulder guards, heavy square warhammer, honest determined face, "
        "short black hair, stocky heroic build."
    ),
    "ergou": (
        "Wang Ergou, agile ranger, warm brown leather armor, yellow scarf, "
        "short bow and quiver, lean build, lively confident expression, quick "
        "footwork silhouette."
    ),
    "yueguang": (
        "Bai Yueguang, moonlit support mage, violet robe, pale silver hair, "
        "crescent staff, soft blue-white magical glow, graceful calm posture."
    ),
    "queen": (
        "Queen Ailinna, dignified fantasy queen, white and gold dress armor, "
        "small crown, emerald cape, calm commanding expression."
    ),
    "yeshi": (
        "Yeshi, mysterious night devourer villain, obsidian robe armor, deep "
        "indigo shadows, pale mask-like face, faint crimson magical accents."
    ),
}

HERO_ACTIONS = {
    "walk": ["left foot forward", "passing step", "right foot forward", "settled step"],
    "run": ["low start", "forward lean", "long stride", "recovery stride"],
    "attack": ["wind-up", "weapon rising", "weapon fully extended", "follow-through"],
    "cast": ["hands gather magic", "spell glow grows", "release magic", "recover pose"],
    "ultimate": ["dramatic charge", "power peak", "impact pose", "afterglow pose"],
    "defeated": ["knees buckle", "falling", "down on ground", "still defeated"],
}

TOWER_LOCKS = {
    "arrow": "wood-and-brass arrow tower, compact archer platform, visible bow arms, golden rope details",
    "mage": "arcane mage tower, violet crystal focus, carved stone base, glowing runes",
    "barracks": "small fantasy barracks tower, green banners, wooden roof, training yard details",
    "artillery": "stout mortar tower, grey stone and bronze cannon, orange ember accents",
    "frost": "ice frost tower, blue crystal spire, snowflake motifs, cool magical mist",
    "flame": "flame tower, red stone brazier, warm orange fire core, scorched metal trims",
    "altar": "support altar tower, teal stone shrine, circular rune platform, pale blessing glow",
    "treasure": "treasure tower, reinforced chest-shaped turret, gold coins, ornate brass lock",
}

TOWER_BRANCHES = {
    "arrow": ["burst", "hawk"],
    "mage": ["arcane", "meteor"],
    "barracks": ["veteran", "reserve"],
    "artillery": ["shrapnel", "rapid"],
    "frost": ["storm", "crystal"],
    "flame": ["inferno", "wildfire"],
    "altar": ["swift", "force", "balance"],
    "treasure": ["vault", "bounty"],
}

MONSTER_FAMILIES = {
    "sprout": "tiny round sprout creature, leaf ears, soft harmless expression",
    "mushroom": "small mushroom goblin creature, cap head, stubby arms",
    "boar": "stout armored boar creature, tusks, determined charge posture",
    "wisp": "floating magical wisp creature, crescent eyes, translucent body",
    "lizard": "small red lizard raider, leather scraps, quick claws",
    "golem": "chunky stone golem creature, rune cracks, heavy feet",
    "shadow": "dark shadow imp creature, purple smoke edges, glowing eyes",
    "snow": "pale snow beast creature, round fur body, icy blue horns",
}

BOSSES = {
    "boss-ch1": "huge armored forest boar boss with broken banner and heavy tusks",
    "boss-ch2": "ancient tree spirit boss with mask face and tangled roots",
    "boss-ch3": "molten lava golem boss with cracked obsidian armor",
    "boss-ch4": "frost giant owl-like boss with crystal feathers",
    "boss-ch5": "abyssal rune knight boss with dark halo and stone armor",
}

PROJECTILES = {
    "arrow-basic": (32, "single clean wooden arrow with iron tip, facing right"),
    "arrow-burst": (48, "arrow with glowing red-orange explosive tip, facing right"),
    "arrow-hawk": (32, "sleek hawk-feather arrow with metallic head, facing right"),
    "magic-bolt": (32, "glowing violet-blue magic orb projectile"),
    "meteor": (64, "burning meteor falling at a 45 degree angle"),
    "bomb": (48, "round black iron bomb with tiny orange fuse spark"),
    "shrapnel": (32, "single jagged grey metal shrapnel piece"),
    "frost-shard": (32, "pale icy-blue translucent crystal shard"),
    "flame": (32, "small stylized orange flame projectile"),
}

FX_SEQS = {
    "flame-puff": (48, 3, "small orange flame puff impact"),
    "hit-spark": (32, 3, "bright yellow-white hit spark impact"),
    "block-spark": (32, 3, "blue steel shield block spark"),
}

AURAS = {
    "slow-ring": (64, "pale ice-blue translucent ring with snowflake motifs"),
    "heal-ring": (64, "soft white-green translucent ring with leaf motifs"),
}

MAPS = {
    1: "golden grassland borderland at sunset, clear winding path geometry",
    2: "deep ancient forest at twilight, luminous plants and clear road path",
    3: "volcanic mountain road with magma cracks and ash, clear road path",
    4: "northern snow-mountain pass during light blizzard, clear road path",
    5: "deep underground abyss cavern with rune-stone pillars, clear road path",
}

COMIC_BEATS = {
    1: ["royal capital plaza at dawn", "heroes receive mission", "border road departure", "first enemy sign"],
    2: ["forest entrance", "lost trail", "moonlit clue", "ancient gate opens"],
    3: ["volcanic ridge", "eruption warning", "rescue under ash", "lava boss reveal"],
    4: ["snow pass approach", "whiteout conflict", "frozen shrine", "frost boss silhouette"],
    5: ["abyss descent", "rune bridge", "villain confrontation", "final echo of the kingdom"],
}

ICONS = {
    "coin": "single round gold coin",
    "blueprint": "tightly rolled blueprint scroll",
    "blueprint-fragment": "torn jagged corner of blueprint paper",
    "heart": "simple stylized round red heart",
    "heart-shield": "red heart inside a steel shield",
    "skill-tiezhu": "top-down warhammer with golden aura",
    "skill-ergou": "three arrows in a fan pattern",
    "skill-yueguang": "glowing crescent moon with stars",
    "equipment-weapon": "two swords crossed in an X",
    "equipment-armor": "round steel chestplate",
    "equipment-trinket": "teardrop blue gemstone in gold setting",
    "easter-egg": "small wrapped golden gift box",
}


def full_prompt(*parts: str, avoid_extra: str = "") -> str:
    body = " ".join(part.strip() for part in parts if part and part.strip())
    avoid = NEGATIVE_BASE if not avoid_extra else f"{NEGATIVE_BASE}, {avoid_extra}"
    return f"{STYLE_BASE} {body}\n\nAvoid: {avoid}"


def make_entry(
    *,
    id: str,
    stage: str,
    category: str,
    prompt: str,
    size: str,
    bg: str,
    quality: str,
    refs: list[str] | None,
    raw: str,
    out: str,
    final: tuple[int, int],
    trim: bool = True,
    anim_group: str | None = None,
    anchor: str = "bottom-center",
    n: int = 1,
) -> dict:
    return {
        "id": id,
        "stage": stage,
        "category": category,
        "prompt": prompt,
        "api": {"size": size, "background": bg, "quality": quality, "n": n},
        "refs": refs or [],
        "raw_path": f"raw/{raw}",
        "out_path": out,
        "final_size": [final[0], final[1]],
        "trim": trim,
        "trim_padding": 2,
        "anim_group": anim_group,
        "anchor": anchor,
        "status": "pending",
    }


def monster_ids() -> list[tuple[str, str, int]]:
    rows: list[tuple[str, str, int]] = []
    families = list(MONSTER_FAMILIES)
    for index in range(30):
        family = families[index % len(families)]
        tier = 1 + min(9, index // 3)
        size = 64 if tier <= 2 else 80
        rows.append((f"{family}-{index + 1:02d}", family, size))
    return rows


def build() -> list[dict]:
    entries: list[dict] = []

    entries.append(
        make_entry(
            id="palette-master",
            stage="0",
            category="palette",
            prompt=full_prompt(
                "Reference color palette swatch chart, neat grid of warm fantasy colors, "
                "labels forbidden, include parchment cream, gold, forest green, moon violet, "
                "frost blue, flame orange, stone grey, shadow indigo."
            ),
            size="1024x1024",
            bg="opaque",
            quality="high",
            refs=[],
            raw="palette-master.png",
            out=PALETTE_REF,
            final=(1024, 1024),
            trim=False,
        )
    )

    for hero in ("tiezhu", "ergou", "yueguang"):
        entries.append(
            make_entry(
                id=f"{hero}-master",
                stage="A",
                category="hero-master",
                prompt=full_prompt(
                    HERO_LOCKS[hero],
                    "master reference sheet, neutral idle pose, three-quarter front view, "
                    "front side and back mini views, weapon close-up, plain neutral background"
                ),
                size="1024x1024",
                bg="opaque",
                quality="high",
                refs=[PALETTE_REF],
                raw=f"heroes/{hero}-master.png",
                out=f"ref/{hero}-master.png",
                final=(1024, 1024),
                trim=False,
                n=4,
            )
        )

    for tower, desc in TOWER_LOCKS.items():
        entries.append(
            make_entry(
                id=f"tower-{tower}-portrait",
                stage="A",
                category="tower-portrait",
                prompt=full_prompt(desc, "single tower codex portrait, transparent background, no ground"),
                size="1024x1024",
                bg="transparent",
                quality="high",
                refs=[PALETTE_REF],
                raw=f"towers/{tower}.png",
                out=f"src/assets/towers/{tower}.png",
                final=(256, 256),
            )
        )

    for monster, family, size in monster_ids():
        entries.append(
            make_entry(
                id=f"{monster}-portrait",
                stage="A",
                category="monster-portrait",
                prompt=full_prompt(
                    MONSTER_FAMILIES[family],
                    f"tier {size}px monster codex portrait, single creature, facing left, transparent background",
                    avoid_extra="facing right",
                ),
                size="1024x1024",
                bg="transparent",
                quality="high",
                refs=[PALETTE_REF],
                raw=f"enemies/{monster}/portrait.png",
                out=f"src/assets/portraits/monsters/{monster}.png",
                final=(256, 256),
            )
        )

    for boss, desc in BOSSES.items():
        entries.append(
            make_entry(
                id=f"{boss}-portrait",
                stage="A",
                category="boss-frame",
                prompt=full_prompt(desc, "boss portrait splash, three-quarter view, transparent background"),
                size="1024x1024",
                bg="transparent",
                quality="high",
                refs=[PALETTE_REF],
                raw=f"bosses/{boss}/portrait.png",
                out=f"src/assets/enemies/{boss}/portrait.png",
                final=(256, 256),
            )
        )

    for hero in ("tiezhu", "ergou", "yueguang"):
        for action, frames in HERO_ACTIONS.items():
            for index, pose in enumerate(frames, start=1):
                stage = "B" if index == 1 else "C"
                refs = [PALETTE_REF, f"ref/{hero}-master.png"]
                if index > 1:
                    refs.append(f"src/assets/heroes/action-sheets/{hero}-{action}-01.png")
                entries.append(
                    make_entry(
                        id=f"{hero}-{action}-{index:02d}",
                        stage=stage,
                        category="hero-frame",
                        prompt=full_prompt(
                            HERO_LOCKS[hero],
                            f"hero action sprite frame {index:02d} of {action}, {pose}, facing right, "
                            "single full body character centered in 96x96 final canvas",
                            avoid_extra="facing left",
                        ),
                        size="1024x1024",
                        bg="transparent",
                        quality="high",
                        refs=refs,
                        raw=f"heroes/{hero}-{action}-{index:02d}.png",
                        out=f"src/assets/heroes/action-sheets/{hero}-{action}-{index:02d}.png",
                        final=(96, 96),
                        anim_group=f"{hero}-{action}",
                    )
                )

    for tower, desc in TOWER_LOCKS.items():
        for level in ("l1", "l2", "l3", "attack"):
            stage = "B" if level == "l1" else "C"
            refs = [PALETTE_REF, f"src/assets/towers/{tower}.png"]
            if level != "l1":
                refs.append(f"src/assets/towers/{tower}-l1.png")
            entries.append(
                make_entry(
                    id=f"tower-{tower}-{level}",
                    stage=stage,
                    category="tower-stage",
                    prompt=full_prompt(
                        desc,
                        f"single tower {level.upper()} game sprite, same base footprint, transparent background, no ground"
                    ),
                    size="1024x1024",
                    bg="transparent",
                    quality="high",
                    refs=refs,
                    raw=f"towers/{tower}-{level}.png",
                    out=f"src/assets/towers/{tower}-{level}.png",
                    final=(96, 96),
                )
            )
        for branch in TOWER_BRANCHES[tower]:
            entries.append(
                make_entry(
                    id=f"tower-{tower}-branch-{branch}",
                    stage="C",
                    category="tower-branch",
                    prompt=full_prompt(
                        desc,
                        f"single tower branch upgrade {branch}, same base footprint as L3, transparent background"
                    ),
                    size="1024x1024",
                    bg="transparent",
                    quality="high",
                    refs=[PALETTE_REF, f"src/assets/towers/{tower}.png", f"src/assets/towers/{tower}-l1.png"],
                    raw=f"towers/{tower}-branch-{branch}.png",
                    out=f"src/assets/towers/{tower}-branch-{branch}.png",
                    final=(96, 96),
                )
            )

    for monster, family, size in monster_ids():
        for action, count in (("walk", 4), ("attack", 3), ("death", 3)):
            for index in range(1, count + 1):
                stage = "B" if action == "walk" and index == 1 else "C"
                refs = [PALETTE_REF, f"src/assets/portraits/monsters/{monster}.png"]
                if not (action == "walk" and index == 1):
                    refs.append(f"src/assets/enemies/{monster}/walk-01.png")
                entries.append(
                    make_entry(
                        id=f"{monster}-{action}-{index:02d}",
                        stage=stage,
                        category="monster-frame",
                        prompt=full_prompt(
                            MONSTER_FAMILIES[family],
                            f"monster {action} animation frame {index:02d}, facing left, single creature, "
                            "transparent background, no ground",
                            avoid_extra="facing right",
                        ),
                        size="1024x1024",
                        bg="transparent",
                        quality="high",
                        refs=refs,
                        raw=f"enemies/{monster}/{action}-{index:02d}.png",
                        out=f"src/assets/enemies/{monster}/{action}-{index:02d}.png",
                        final=(size, size),
                        anim_group=f"{monster}-{action}",
                    )
                )

    for boss, desc in BOSSES.items():
        for action, count in (("walk", 4), ("attack", 4), ("death", 4)):
            for index in range(1, count + 1):
                entries.append(
                    make_entry(
                        id=f"{boss}-{action}-{index:02d}",
                        stage="C",
                        category="boss-frame",
                        prompt=full_prompt(
                            desc,
                            f"boss {action} animation frame {index:02d}, facing left, transparent background"
                        ),
                        size="1024x1024",
                        bg="transparent",
                        quality="high",
                        refs=[PALETTE_REF, f"src/assets/enemies/{boss}/portrait.png"],
                        raw=f"bosses/{boss}/{action}-{index:02d}.png",
                        out=f"src/assets/enemies/{boss}/{action}-{index:02d}.png",
                        final=(128, 128),
                        anim_group=f"{boss}-{action}",
                    )
                )

    for projectile, (size, desc) in PROJECTILES.items():
        entries.append(
            make_entry(
                id=f"projectile-{projectile}",
                stage="B",
                category="projectile",
                prompt=full_prompt(desc, "single projectile centered, transparent background, no glow outside canvas"),
                size="1024x1024",
                bg="transparent",
                quality="medium",
                refs=[PALETTE_REF],
                raw=f"projectiles/{projectile}.png",
                out=f"src/assets/projectiles/{projectile}.png",
                final=(size, size),
                anchor="center",
            )
        )

    for fx, (size, count, desc) in FX_SEQS.items():
        for index in range(1, count + 1):
            entries.append(
                make_entry(
                    id=f"fx-{fx}-{index}",
                    stage="B" if index == 1 else "C",
                    category="fx-frame",
                    prompt=full_prompt(desc, f"frame {index} of {count}, transparent additive-friendly alpha"),
                    size="1024x1024",
                    bg="transparent",
                    quality="medium",
                    refs=[PALETTE_REF],
                    raw=f"fx/{fx}-{index}.png",
                    out=f"src/assets/projectiles/{fx}-{index}.png",
                    final=(size, size),
                    anchor="center",
                    anim_group=f"fx-{fx}",
                )
            )

    for aura, (size, desc) in AURAS.items():
        entries.append(
            make_entry(
                id=f"aura-{aura}",
                stage="B",
                category="aura",
                prompt=full_prompt(desc, "top-down ring, transparent background, centered"),
                size="1024x1024",
                bg="transparent",
                quality="medium",
                refs=[PALETTE_REF],
                raw=f"fx/{aura}.png",
                out=f"src/assets/projectiles/{aura}.png",
                final=(size, size),
                anchor="center",
            )
        )

    for chapter, desc in MAPS.items():
        entries.append(
            make_entry(
                id=f"map-chapter-{chapter}",
                stage="D",
                category="map",
                prompt=full_prompt(desc, "tower-defense battlefield background, no UI, no text, path clearly visible"),
                size="1536x1024",
                bg="opaque",
                quality="high",
                refs=[PALETTE_REF],
                raw=f"maps/chapter-{chapter}.png",
                out=f"src/assets/maps/chapter-{chapter}.png",
                final=(1920, 1080),
                trim=False,
                anchor="center",
            )
        )

    for chapter, beats in COMIC_BEATS.items():
        for index, beat in enumerate(beats, start=1):
            for suffix in ("prologue", "epilogue"):
                entries.append(
                    make_entry(
                        id=f"ch{chapter}-{suffix}-{index}",
                        stage="D",
                        category="comic",
                        prompt=full_prompt(
                            f"chapter {chapter} comic panel: {beat}",
                            "single square story illustration, cinematic composition, no speech bubbles, no text"
                        ),
                        size="1024x1024",
                        bg="opaque",
                        quality="high",
                        refs=[PALETTE_REF],
                        raw=f"comics/ch{chapter}-{suffix}-{index}.png",
                        out=f"src/assets/comics/ch{chapter}-{suffix}-{index}.png",
                        final=(1024, 1024),
                        trim=False,
                        anchor="center",
                    )
                )

    for npc in ("queen", "yeshi"):
        entries.append(
            make_entry(
                id=f"portrait-{npc}",
                stage="D",
                category="npc-portrait",
                prompt=full_prompt(HERO_LOCKS[npc], "full body portrait, opaque painted background, no text"),
                size="1024x1536",
                bg="opaque",
                quality="high",
                refs=[PALETTE_REF],
                raw=f"portraits/{npc}.png",
                out=f"src/assets/portraits/{npc}.png",
                final=(768, 1024),
                trim=False,
                anchor="center",
            )
        )

    for hero in ("tiezhu", "ergou", "yueguang"):
        entries.append(
            make_entry(
                id=f"portrait-hero-{hero}",
                stage="D",
                category="hero-portrait",
                prompt=full_prompt(HERO_LOCKS[hero], "full body hero portrait, opaque painted background, no text"),
                size="1024x1536",
                bg="opaque",
                quality="high",
                refs=[PALETTE_REF, f"ref/{hero}-master.png"],
                raw=f"portraits/heroes/{hero}.png",
                out=f"src/assets/portraits/heroes/{hero}.png",
                final=(768, 1024),
                trim=False,
                anchor="center",
            )
        )

    for item, desc in {
        "splash-main": "main splash screen with the three heroes defending a fantasy road",
        "menu-bg": "main menu background showing a warm fantasy tower-defense battlefield",
    }.items():
        entries.append(
            make_entry(
                id=item,
                stage="D",
                category="splash" if item == "splash-main" else "menu",
                prompt=full_prompt(desc, "wide illustration, no UI, no text"),
                size="1536x1024",
                bg="opaque",
                quality="high",
                refs=[PALETTE_REF, "ref/tiezhu-master.png", "ref/ergou-master.png", "ref/yueguang-master.png"],
                raw=f"{'splash' if item == 'splash-main' else 'menu'}/{item}.png",
                out=f"src/assets/{'splash' if item == 'splash-main' else 'menu'}/{item}.png",
                final=(1920, 1080),
                trim=False,
                anchor="center",
            )
        )

    for state in ("default", "hover", "disabled", "danger"):
        entries.append(
            make_entry(
                id=f"ui-button-{state}",
                stage="D",
                category="ui-button",
                prompt=full_prompt(
                    f"fantasy wooden UI button state {state}, centered in canvas, transparent background, no text"
                ),
                size="1024x1024",
                bg="transparent",
                quality="medium",
                refs=[PALETTE_REF],
                raw=f"ui/button-{state}.png",
                out=f"src/assets/ui/button-{state}.png",
                final=(256, 96),
                anchor="center",
            )
        )

    entries.append(
        make_entry(
            id="ui-panel-wood",
            stage="D",
            category="ui-panel",
            prompt=full_prompt("seamless warm wood plank UI panel texture, square tile, no text"),
            size="1024x1024",
            bg="opaque",
            quality="medium",
            refs=[PALETTE_REF],
            raw="ui/panel-wood.png",
            out="src/assets/ui/panel-wood.png",
            final=(512, 512),
            trim=False,
            anchor="center",
        )
    )

    for icon, desc in ICONS.items():
        entries.append(
            make_entry(
                id=f"icon-{icon}",
                stage="D",
                category="ui-icon",
                prompt=full_prompt(f"clean readable game UI icon: {desc}, transparent background, no text"),
                size="1024x1024",
                bg="transparent",
                quality="medium",
                refs=[PALETTE_REF],
                raw=f"icons/{icon}.png",
                out=f"src/assets/icons/{icon}.png",
                final=(64, 64),
                anchor="center",
            )
        )

    return entries


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="tools/assets-manifest.json")
    parser.add_argument("--indent", type=int, default=2)
    args = parser.parse_args()

    manifest = build()
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=args.indent), encoding="utf-8")
    print(f"wrote {len(manifest)} entries to {out}")


if __name__ == "__main__":
    main()
