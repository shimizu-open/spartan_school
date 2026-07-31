const KEY = "kakera.state.v1";

function emptyState() {
  return {
    version: 1,
    started_on: null,
    onboarded: false,
    entries: {},
    outings: {},
  };
}

function validRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalize(value) {
  if (!validRecord(value) || value.version !== 1) return emptyState();
  return {
    version: 1,
    started_on: typeof value.started_on === "string" ? value.started_on : null,
    onboarded: value.onboarded === true,
    entries: validRecord(value.entries) ? value.entries : {},
    outings: validRecord(value.outings) ? value.outings : {},
  };
}

export function load() {
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? normalize(JSON.parse(stored)) : emptyState();
  } catch {
    return emptyState();
  }
}

export function save(value) {
  localStorage.setItem(KEY, JSON.stringify(normalize(value)));
}
