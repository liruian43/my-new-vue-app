// src/components/Data/store-parts/sync/status.js
import { LocalStorageStrategy } from '../../storage/LocalStorageStrategy';
import { loadSyncHistory } from './history';
import { CARD_DATA_TEMPLATE } from '../cards';

function ensureStorage(storage) {
  return storage && storage.prefix && typeof storage.getItem === 'function'
    ? storage
    : new LocalStorageStrategy();
}

export function getSyncStatus(storage, itemId) {
  const s = ensureStorage(storage);
  const syncHistory = loadSyncHistory(s);
  const latestSync = syncHistory
    .filter(entry => (entry.cardIds || []).includes(itemId))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

  if (!latestSync) {
    return { hasSync: false, hasConflict: false };
  }
  return {
    hasSync: true,
    hasConflict: latestSync.conflictDetected || false,
    lastSync: latestSync.timestamp
  };
}

export function updateCardSyncStatus(card, field) {
  if (!card.syncStatus) {
    card.syncStatus = { ...CARD_DATA_TEMPLATE.syncStatus };
  }
  if (field.startsWith('title')) {
    card.syncStatus.title = { hasSync: true, isAuthorized: true };
  } else if (field.startsWith('options.name')) {
    card.syncStatus.options.name = { hasSync: true, isAuthorized: true };
  } else if (field.startsWith('options.value')) {
    card.syncStatus.options.value = { hasSync: true, isAuthorized: true };
  } else if (field.startsWith('options.unit')) {
    card.syncStatus.options.unit = { hasSync: true, isAuthorized: true };
  }
  return card;
}