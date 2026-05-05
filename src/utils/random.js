export function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function cloneStats(stats = {}, multiplier = 1) {
  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => [key, typeof value === "number" ? Number((value * multiplier).toFixed(2)) : value]),
  );
}

