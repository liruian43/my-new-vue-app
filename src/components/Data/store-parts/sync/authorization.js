// src/components/Data/store-parts/sync/authorization.js
import { LocalStorageStrategy } from '../../storage/LocalStorageStrategy';

const STORAGE_KEY = 'field_authorizations';

function ensureStorage(storage) {
  return storage && storage.prefix && typeof storage.getItem === 'function'
    ? storage
    : new LocalStorageStrategy();
}

export function saveFieldAuthorizations(storage, authorizations) {
  const s = ensureStorage(storage);
  return s.setItem(STORAGE_KEY, authorizations);
}

export function loadFieldAuthorizations(storage) {
  const s = ensureStorage(storage);
  return s.getItem(STORAGE_KEY) || {};
}

export function filterSyncFields(sourceData, authorizedFields) {
  const filtered = {};
  Object.keys(sourceData || {}).forEach(key => {
    if ((authorizedFields || []).includes(key)) {
      filtered[key] = sourceData[key];
    }
  });
  return filtered;
}