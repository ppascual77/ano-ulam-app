// In-memory AsyncStorage for the tests; _clear() empties it between tests.
const store = new Map();
export default {
  getItem: async (key) => (store.has(key) ? store.get(key) : null),
  setItem: async (key, value) => void store.set(key, value),
  removeItem: async (key) => void store.delete(key),
  _clear: () => store.clear(),
};
