// The /vitest entry types the matchers on Vitest's expect (the main entry types Jest's)
import '@testing-library/jest-dom/vitest';

// Polyfill ResizeObserver globally if needed, though it's already in the test file.
// Moving it here is cleaner for future tests.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: any) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // Deprecated
    removeListener: () => {}, // Deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Recent Node versions define their own global localStorage (unusable without --localstorage-file),
// which hides jsdom's one: provide an in-memory Storage.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: new MemoryStorage() });
  Object.defineProperty(window, name, { configurable: true, writable: true, value: globalThis[name] });
}

// jsdom does not implement scrollIntoView (used by cmdk lists and the weekly calendar)
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
