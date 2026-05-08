const mapAsset = (file) => new URL(`../assets/maps/${file}`, import.meta.url).href;

export const CHAPTERS = [
  {
    id: 1,
    name: "边境平原",
    mapKey: "map-chapter-1",
    mapUrl: mapAsset("chapter-1.png"),
  },
  {
    id: 2,
    name: "幽暗森林",
    mapKey: "map-chapter-2",
    mapUrl: mapAsset("chapter-2.png"),
  },
  {
    id: 3,
    name: "烈焰火山",
    mapKey: "map-chapter-3",
    mapUrl: mapAsset("chapter-3.png"),
  },
  {
    id: 4,
    name: "极北雪山",
    mapKey: "map-chapter-4",
    mapUrl: mapAsset("chapter-4.png"),
  },
  {
    id: 5,
    name: "回响之渊",
    mapKey: "map-chapter-5",
    mapUrl: mapAsset("chapter-5.png"),
  },
];

export const TOTAL_CHAPTERS = CHAPTERS.length;

export function getChapterById(chapterId) {
  return CHAPTERS.find((chapter) => chapter.id === chapterId) ?? CHAPTERS[0];
}

export function getChapterByLevelId(levelId) {
  if (typeof levelId !== "string") {
    return CHAPTERS[0];
  }
  const match = levelId.match(/^chapter-(\d+)/);
  const id = match ? Number(match[1]) : 1;
  return getChapterById(id);
}
