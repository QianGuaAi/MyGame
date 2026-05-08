import Phaser from "phaser";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const PANEL_X = 758;
export const TOTAL_WAVES = 10;

export const PATH_POINTS = [
  [742, 324],
  [626, 324],
  [566, 264],
  [464, 246],
  [354, 268],
  [274, 244],
  [230, 174],
  [168, 168],
  [98, 226],
  [58, 338],
  [-54, 338],
];

export const TOWER_SLOTS = [
  [672, 268],
  [686, 440],
  [564, 354],
  [508, 164],
  [378, 182],
  [358, 356],
  [238, 316],
  [184, 112],
  [104, 150],
  [86, 446],
];

export const DECORATIONS = [
  ["tree", 36, 88, 0.78, { obstacleRadius: 17 }],
  ["tree", 150, 70, 0.68, { obstacleRadius: 16 }],
  ["tree", 520, 62, 0.74, { obstacleRadius: 17 }],
  ["tree", 700, 92, 0.72, { obstacleRadius: 17 }],
  ["tree", 46, 486, 0.7, { obstacleRadius: 16 }],
  ["tree", 594, 486, 0.84, { obstacleRadius: 19 }],
  ["rock", 234, 352, 0.9, { obstacleRadius: 20 }],
  ["rock", 406, 322, 0.7, { obstacleRadius: 17 }],
  ["rock", 660, 510, 0.82, { obstacleRadius: 19 }],
  ["shrub", 72, 146, 1],
  ["shrub", 388, 72, 0.9],
  ["shrub", 584, 188, 0.78],
  ["shrub", 168, 504, 0.85],
];

export const TEXT_STYLE = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "17px",
  color: "#332314",
};

export const PATH_SEGMENTS = buildPathSegments(PATH_POINTS);
export const PATH_LENGTH = PATH_SEGMENTS[PATH_SEGMENTS.length - 1].end;

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

export function pointOnPath(distance) {
  const clamped = Phaser.Math.Clamp(distance, 0, PATH_LENGTH);
  const segment = PATH_SEGMENTS.find((item) => clamped <= item.end) || PATH_SEGMENTS[PATH_SEGMENTS.length - 1];
  const t = segment.length === 0 ? 0 : (clamped - segment.start) / segment.length;

  return {
    x: Phaser.Math.Linear(segment.from.x, segment.to.x, t),
    y: Phaser.Math.Linear(segment.from.y, segment.to.y, t),
    angle: segment.angle,
  };
}

