import Phaser from "phaser";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const PANEL_X = 758;
export const TOTAL_WAVES = 10;

export const PATH_POINTS = [
  [-56, 338],
  [124, 338],
  [124, 162],
  [292, 162],
  [292, 426],
  [474, 426],
  [474, 246],
  [626, 246],
  [626, 378],
  [742, 378],
];

export const TOWER_SLOTS = [
  [86, 224],
  [96, 454],
  [214, 270],
  [222, 86],
  [360, 246],
  [352, 486],
  [430, 124],
  [546, 156],
  [548, 342],
  [686, 166],
  [684, 458],
  [694, 298],
];

export const DECORATIONS = [
  ["tree", 44, 88, 0.9, { obstacleRadius: 20 }],
  ["tree", 162, 72, 0.78, { obstacleRadius: 18 }],
  ["tree", 520, 62, 0.86, { obstacleRadius: 19 }],
  ["tree", 700, 92, 0.72, { obstacleRadius: 17 }],
  ["tree", 46, 486, 0.8, { obstacleRadius: 18 }],
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

