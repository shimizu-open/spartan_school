import { dateKey, monthKey } from "./lib/date.js";
import { load, save } from "./storage/index.js";

let value;
const subscribers = new Set();

function commit(next) {
  value = next;
  save(value);
  subscribers.forEach((subscriber) => subscriber(value));
}

export function initialize() {
  value = load();
  return value;
}

export function getState() {
  return value;
}

export function subscribe(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function finishOnboarding() {
  commit({ ...value, onboarded: true });
}

export function saveEntry(fields, today = dateKey()) {
  const feeling = fields.feeling.trim();
  if (!feeling) return false;
  const previous = value.entries[today];
  const entry = {
    feeling,
    done: fields.done.trim(),
    person: fields.person.trim(),
    created_at: previous?.created_at ?? new Date().toISOString(),
  };
  commit({
    ...value,
    started_on: value.started_on ?? today,
    entries: { ...value.entries, [today]: entry },
  });
  return true;
}

export function saveOuting(fields, month = monthKey()) {
  const goal = fields.goal.trim();
  if (!goal) return false;
  const previous = value.outings[month];
  const outing = {
    goal,
    planned_on: fields.planned_on || null,
    went_on: previous?.went_on ?? null,
    created_at: previous?.created_at ?? new Date().toISOString(),
  };
  commit({ ...value, outings: { ...value.outings, [month]: outing } });
  return true;
}

export function markOutingWent(month = monthKey(), today = dateKey()) {
  const outing = value.outings[month];
  if (!outing?.goal || outing.went_on) return false;
  commit({
    ...value,
    outings: { ...value.outings, [month]: { ...outing, went_on: today } },
  });
  return true;
}

export function restoreBackup(data) {
  const restored = {
    ...value,
    started_on: value.started_on ?? data.started_on ?? null,
    onboarded: value.onboarded || data.onboarded === true,
    entries: { ...data.entries, ...value.entries },
    outings: { ...data.outings, ...value.outings },
  };
  commit(restored);
}

export function clearAll() {
  commit({
    version: 1,
    started_on: null,
    onboarded: false,
    entries: {},
    outings: {},
  });
}
