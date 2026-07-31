const DAY = 86_400_000;

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthKey(date = new Date()) {
  return dateKey(date).slice(0, 7);
}

export function fromDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function shiftDate(key, amount) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

export function recentDateKeys(last = dateKey()) {
  return Array.from({ length: 7 }, (_, index) => shiftDate(last, -index));
}

export function allDateKeys(first, last = dateKey()) {
  if (!first || first > last) return [];
  const keys = [];
  for (let key = last; key >= first; key = shiftDate(key, -1)) keys.push(key);
  return keys;
}

export function daysBetween(first, last = dateKey()) {
  return Math.floor((fromDateKey(last) - fromDateKey(first)) / DAY);
}

export function isUnlocked(startedOn, today = dateKey()) {
  return Boolean(startedOn) && daysBetween(startedOn, today) >= 60;
}

export function displayDate(key) {
  const date = fromDateKey(key);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function displayLongDate(key) {
  const date = fromDateKey(key);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function displayListDate(key, reference = dateKey()) {
  const date = fromDateKey(key);
  const referenceDate = fromDateKey(reference);
  return date.getFullYear() === referenceDate.getFullYear()
    ? displayDate(key)
    : displayLongDate(key);
}

export function monthDayKey(key = dateKey()) {
  return key.slice(5);
}

export function monthDayIndex(key = dateKey()) {
  const [month, day] = monthDayKey(key).split("-").map(Number);
  const offsets = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  return offsets[month - 1] + day - 1;
}
