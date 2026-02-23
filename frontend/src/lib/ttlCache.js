const now = () => Date.now();

export function readTtlCache(key, ttlMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ts = Number(parsed?.ts || 0);
    if (!ts) return null;
    if (ttlMs && now() - ts > ttlMs) return null;
    return parsed?.value ?? null;
  } catch {
    return null;
  }
}

export function writeTtlCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: now(), value }));
  } catch {
    // ignore (storage full / disabled)
  }
}

export function clearTtlCache(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
