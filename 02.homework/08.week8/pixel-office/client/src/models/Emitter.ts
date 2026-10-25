/** Minimal typed event emitter used by models to tell views that data changed. */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<(v: never) => void>>();

  on<K extends keyof Events>(type: K, fn: (v: Events[K]) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as (v: never) => void);
    return () => set.delete(fn as (v: never) => void);
  }

  emit<K extends keyof Events>(type: K, value: Events[K]): void {
    for (const fn of this.handlers.get(type) ?? []) (fn as (v: Events[K]) => void)(value);
  }
}
