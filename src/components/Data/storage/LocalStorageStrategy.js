// src/components/Data/storage/LocalStorageStrategy.js
export class LocalStorageStrategy {
  constructor() {
    this.prefix = 'app_long_term_';
  }

  setItem(key, data) {
    const storageKey = this.prefix + key;
    localStorage.setItem(storageKey, JSON.stringify(data));
    return true;
  }

  getItem(key) {
    const storageKey = this.prefix + key;
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  }

  removeItem(key) {
    const storageKey = this.prefix + key;
    localStorage.removeItem(storageKey);
    return true;
  }

  clear() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }
}