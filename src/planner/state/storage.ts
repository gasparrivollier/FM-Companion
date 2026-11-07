/** Where the snapshot comes from. Plan 3 supplies the Electron implementation. Returns unknown: the app validates it. */
export interface SnapshotSource { load(): Promise<unknown> }

/** Where the owner's data lives (one JSON document). Plan 3 supplies a file in the application data folder. */
export interface OwnerStorage {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
  /** Optional synchronous write, used when the page is being hidden (the Electron bridge provides one). */
  writeSync?(text: string): void;
}

export function memoryStorage(initial?: string): OwnerStorage {
  let text: string | null = initial ?? null;
  return { read: async () => text, write: async (t) => { text = t; } };
}

export function localStorageStorage(key = "fm24companion.owner"): OwnerStorage {
  return {
    read: async () => localStorage.getItem(key),
    write: async (t) => { localStorage.setItem(key, t); },
  };
}

/** Dev source: the importer's output served by the Vite middleware. */
export function fetchSnapshotSource(url = "/snapshot.json"): SnapshotSource {
  return {
    async load() {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status}). Corré "npm run import" primero.`);
      return res.json();
    },
  };
}
