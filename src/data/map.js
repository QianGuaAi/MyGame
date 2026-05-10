import Phaser from "phaser";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const PANEL_X = 758;
export const TOTAL_WAVES = 10;

export const TEXT_STYLE = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "17px",
  color: "#332314",
};

export const CHAPTER_LAYOUT = [
  {
    // [初版-待校验] 第 1 章 边境平原（黄绿草原）
    name: "边境平原",
    backgroundKey: "ch1-map",
    pathPoints: [
      [-40, 45], [70, 160], [250, 250], [360, 285],
      [480, 225], [600, 225], [690, 280], [760, 220],
      [820, 185], [900, 205],
    ],
    spawnLanes: [
      [
        [-40, 45], [70, 160], [250, 250], [360, 285],
        [480, 225], [600, 225], [690, 280], [760, 220],
        [820, 185], [900, 205],
      ],
      [
        [500, 580], [500, 500], [470, 430], [430, 360],
        [370, 310], [360, 285], [480, 225], [600, 225],
        [690, 280], [760, 220], [820, 185], [900, 205],
      ],
      [
        [930, 560], [890, 500], [840, 440], [790, 390],
        [760, 340], [820, 300], [860, 240], [820, 185],
        [900, 205],
      ],
    ],
    towerSlots: [
      [210, 150], [364, 146], [405, 176], [472, 205], [602, 176],
      [746, 176], [161, 213], [235, 213], [293, 230], [112, 300],
      [496, 292], [651, 292], [742, 292], [862, 292], [912, 330],
      [156, 389], [292, 389], [496, 392], [600, 392], [777, 392],
      [859, 429], [918, 481], [445, 461], [708, 461], [495, 515],
    ],
  },
  {
    // [初版-待校验] 第 2 章 幽暗森林（深绿 + 蓝蘑菇）
    name: "幽暗森林",
    backgroundKey: "ch2-map",
    bossTexture: "boss-warlock", // [待确认] boss 章节归属，可由后续任务交换
    pathPoints: [
      [-40, 180], [220, 180], [260, 320], [440, 340],
      [460, 200], [640, 180], [680, 360], [1000, 380],
    ],
    towerSlots: [
      [140, 100], [340, 100], [380, 240], [540, 280],
      [560, 110], [700, 270], [560, 440], [220, 440],
    ],
  },
  {
    // [初版-待校验] 第 3 章 烈焰火山（红黑 + 岩浆）
    name: "烈焰火山",
    backgroundKey: "ch3-map",
    pathPoints: [
      [-40, 180], [260, 200], [280, 360], [520, 360],
      [560, 200], [720, 200], [740, 320], [1000, 280],
    ],
    towerSlots: [
      [160, 110], [380, 130], [400, 270], [600, 290],
      [620, 130], [180, 360], [380, 460], [620, 460],
    ],
  },
  {
    // [初版-待校验] 第 4 章 极北雪山（白蓝 + 冰堡）
    name: "极北雪山",
    backgroundKey: "ch4-map",
    pathPoints: [
      [-40, 200], [240, 220], [380, 320], [560, 320],
      [700, 220], [1000, 200],
    ],
    towerSlots: [
      [120, 130], [320, 140], [480, 250], [620, 380],
      [320, 410], [160, 380], [560, 130], [700, 360],
    ],
  },
  {
    // [初版-待校验] 第 5 章 回响之渊（紫色水晶）
    name: "回响之渊",
    backgroundKey: "ch5-map",
    bossTexture: "boss-wraith", // [待确认] boss 章节归属，可由后续任务交换
    pathPoints: [
      [-40, 320], [180, 280], [200, 420], [440, 440],
      [480, 240], [680, 240], [720, 380], [1000, 200],
    ],
    towerSlots: [
      [120, 180], [320, 200], [460, 100], [560, 340],
      [320, 360], [120, 460], [680, 460], [700, 140],
    ],
  },
];

export function buildPathSegments(points) {
  let total = 0;

  return points.slice(0, -1).map((point, index) => {
    const from = new Phaser.Math.Vector2(point[0], point[1]);
    const to = new Phaser.Math.Vector2(points[index + 1][0], points[index + 1][1]);
    const length = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const segment = {
      from,
      to,
      length,
      start: total,
      end: total + length,
      angle: Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y),
    };

    total += length;
    return segment;
  });
}

export function getChapterPathSegments(chapterIndex) {
  return buildPathSegments(CHAPTER_LAYOUT[chapterIndex].pathPoints);
}

export function getChapterPathLength(chapterIndex) {
  const segs = getChapterPathSegments(chapterIndex);
  return segs[segs.length - 1].end;
}

export function pointOnChapterPath(chapterIndex, distance) {
  const segs = getChapterPathSegments(chapterIndex);
  const total = segs[segs.length - 1].end;
  const clamped = Math.max(0, Math.min(distance, total));
  const seg = segs.find((s) => clamped <= s.end) || segs[segs.length - 1];
  const t = seg.length === 0 ? 0 : (clamped - seg.start) / seg.length;

  return {
    x: seg.from.x + (seg.to.x - seg.from.x) * t,
    y: seg.from.y + (seg.to.y - seg.from.y) * t,
    angle: seg.angle,
  };
}

export function pointOnPath(distance) {
  return pointOnChapterPath(0, distance);
}

