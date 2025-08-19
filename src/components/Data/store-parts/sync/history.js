// src/components/Data/store-parts/sync/history.js
import { LocalStorageStrategy } from '../../storage/LocalStorageStrategy';

const STORAGE_KEY = 'sync_history';

function ensureStorage(storage) {
  return storage && storage.prefix && typeof storage.getItem === 'function'
    ? storage
    : new LocalStorageStrategy();
}

export function saveSyncHistory(storage, history) {
  const s = ensureStorage(storage);
  return s.setItem(STORAGE_KEY, history);
}

export function loadSyncHistory(storage) {
  const s = ensureStorage(storage);
  return s.getItem(STORAGE_KEY) || [];
}

export function createSyncHistoryEntry(syncData) {
  return {
    id: `sync_${Date.now()}`,
    sourceModeId: syncData.sourceModeId,
    targetModeId: syncData.targetModeId,
    cardIds: syncData.cardIds || [],
    ruleId: syncData.ruleId || null,
    fields: syncData.fields || [],
    timestamp: new Date().toISOString(),
    status: syncData.status || 'completed',
    conflictDetected: syncData.conflictDetected || false
  };
}