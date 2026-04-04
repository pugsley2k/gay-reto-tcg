export async function register() {
  // Polyfill localStorage for server-side Clerk on Node.js 22+
  // Node.js 22+ adds a partial localStorage via --localstorage-file,
  // but on Windows the path often fails, leaving a broken object.
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
    const store: Record<string, string> = {};
    (global as any).localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = String(value); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: (index: number) => Object.keys(store)[index] ?? null,
    };
  }
}
