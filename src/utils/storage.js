const PREFIX = "crown-outpost-";

export const STORAGE_KEYS = {
  bestWave: PREFIX + "best-wave",
  easterEggs: PREFIX + "easter-eggs",
  save: PREFIX + "save-v1",
};

export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function readString(key, fallback = "") {
  const v = localStorage.getItem(key);
  return v == null ? fallback : v;
}

export function writeString(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}
