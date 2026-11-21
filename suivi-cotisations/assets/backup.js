/* ============================================================
   Sauvegarde externe automatique (JSON dans un dossier choisi)
   ============================================================ */

window.autoBackup = (function () {
  const CONFIG_KEY = 'suivi-cotisations-autobackup-v1';
  const HISTORY_KEY = 'suivi-cotisations-autobackup-history-v1';
  const DB_NAME = 'suivi-cotisations-autobackup';
  const DB_STORE = 'handles';
  const DB_HANDLE_KEY = 'directory';
  const MAX_HISTORY = 365;

  const DEFAULT_CONFIG = Object.freeze({
    enabled: false,
    frequency: 'daily',
    time: '19:00',
    dayOfWeek: 1,
    keepLast: 30,
    retentionDays: 7,
    prefix: 'sauvegarde_cotisations',
    downloadFallback: false
  });

  const REASON_LABELS = Object.freeze({
    manual: 'Manuelle',
    scheduled: 'Planifiée',
    'auto-change': 'Après modification'
  });

  let directoryHandle = null;
  let currentPermission = 'none';
  let timerId = null;
  let changeTimer = null;
  let lastSignature = null;
  let initialized = false;
  let warnedMissingFolder = false;
  let warnedPermission = false;

  function normalizeConfig(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const config = {
      enabled: !!source.enabled,
      frequency: ['daily', 'weekly', 'on-change'].includes(source.frequency) ? source.frequency : 'daily',
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(source.time || '')) ? String(source.time) : DEFAULT_CONFIG.time,
      dayOfWeek: source.dayOfWeek == null ? DEFAULT_CONFIG.dayOfWeek : Math.max(0, Math.min(6, Math.round(num(source.dayOfWeek)))),
      keepLast: Math.max(1, Math.min(MAX_HISTORY, Math.round(num(source.keepLast)) || DEFAULT_CONFIG.keepLast)),
      retentionDays: source.retentionDays == null
        ? DEFAULT_CONFIG.retentionDays
        : Math.max(0, Math.min(3650, Math.round(num(source.retentionDays)))),
      prefix: sanitizePrefix(source.prefix),
      downloadFallback: !!source.downloadFallback
    };
    return config;
  }

  function getConfig() {
    try {
      const raw = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
      return normalizeConfig(raw);
    } catch (e) {
      return normalizeConfig(null);
    }
  }

  function saveConfig(config) {
    const normalized = normalizeConfig(config);
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.warn('Configuration de sauvegarde non enregistrée.', e);
      if (typeof toast === 'function') toast('Impossible d’enregistrer la configuration de sauvegarde.', 'error');
    }
    return normalized;
  }

  function sanitizePrefix(value) {
    const cleaned = String(value == null ? '' : value)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '_')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 60);
    return cleaned || DEFAULT_CONFIG.prefix;
  }

  function buildFilename(prefix, date) {
    const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    const stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}h${pad2(d.getMinutes())}m${pad2(d.getSeconds())}`;
    return `${sanitizePrefix(prefix)}_${stamp}.json`;
  }

  function backupTimestamp(filename) {
    const match = /_(\d{4})-(\d{2})-(\d{2})_(\d{2})h(\d{2})m(\d{2})\.json$/.exec(String(filename || ''));
    if (!match) return null;
    const date = new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]);
    return isNaN(date.getTime()) ? null : date;
  }

  function isOldBackup(filename, prefix, retentionDays, now) {
    if (!retentionDays || retentionDays <= 0) return false;
    const name = String(filename || '');
    if (!name.startsWith(sanitizePrefix(prefix) + '_') || !name.endsWith('.json')) return false;
    const created = backupTimestamp(name);
    if (!created) return false;
    const base = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
    return base.getTime() - created.getTime() > retentionDays * 24 * 60 * 60 * 1000;
  }

  function parseTime(value) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
    return match ? { h: Number(match[1]), m: Number(match[2]) } : { h: 19, m: 0 };
  }

  function nextRunAt(config, from) {
    const cfg = normalizeConfig(config);
    if (cfg.frequency === 'on-change') return null;
    const base = from instanceof Date && !isNaN(from.getTime()) ? new Date(from.getTime()) : new Date();
    const time = parseTime(cfg.time);
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), time.h, time.m, 0, 0);
    if (cfg.frequency === 'weekly') {
      next.setDate(next.getDate() + ((cfg.dayOfWeek - next.getDay() + 7) % 7));
      if (next <= base) next.setDate(next.getDate() + 7);
    } else if (next <= base) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  function intervalMs(config) {
    if (config.frequency === 'weekly') return 7 * 24 * 60 * 60 * 1000;
    if (config.frequency === 'daily') return 24 * 60 * 60 * 1000;
    return 0;
  }

  /* ---------- Dossier et autorisations ---------- */
  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB indisponible.')); return; }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB indisponible.'));
    });
  }

  async function loadHandle() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).get(DB_HANDLE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  async function saveHandle(handle) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(handle, DB_HANDLE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  async function queryHandlePermission(handle) {
    if (!handle || typeof handle.queryPermission !== 'function') return 'none';
    try {
      return await handle.queryPermission({ mode: 'readwrite' });
    } catch (e) {
      return 'none';
    }
  }

  async function ensurePermission(handle, interactive) {
    if (!handle) return 'none';
    let state = await queryHandlePermission(handle);
    if (state === 'granted') return state;
    if (!interactive || state === 'denied') return state;
    try {
      state = await handle.requestPermission({ mode: 'readwrite' });
    } catch (e) {
      return 'denied';
    }
    return state;
  }

  async function pickDirectory() {
    if (typeof window.showDirectoryPicker !== 'function') {
      throw new Error('Ce navigateur ne permet pas de choisir un dossier. Utilisez le téléchargement ou Chrome / Edge.');
    }
    let handle = null;
    try {
      handle = await window.showDirectoryPicker({ id: 'suivi-cotisations', mode: 'readwrite', startIn: 'documents' });
    } catch (e) {
      if (e && e.name === 'AbortError') return null;
      throw e;
    }
    const state = await ensurePermission(handle, true);
    if (state !== 'granted') throw new Error('L’autorisation d’écriture sur ce dossier a été refusée.');
    directoryHandle = handle;
    currentPermission = state;
    warnedPermission = false;
    try {
      await saveHandle(handle);
    } catch (e) {
      console.warn('Dossier non mémorisé pour la prochaine session.', e);
    }
    return handle;
  }

  async function grantDirectoryAccess() {
    if (!directoryHandle) throw new Error('Aucun dossier choisi.');
    const state = await ensurePermission(directoryHandle, true);
    currentPermission = state;
    if (state !== 'granted') throw new Error('L’autorisation d’écriture a été refusée.');
    warnedPermission = false;
    return directoryHandle.name;
  }

  /* ---------- Historique ---------- */
  function getHistory() {
    let list = [];
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      list = Array.isArray(raw) ? raw : [];
    } catch (e) {
      list = [];
    }
    return list
      .filter(item => item && typeof item === 'object' && item.filename)
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  }

  function addToHistory(entry) {
    const history = getHistory();
    history.unshift(entry);
    const keep = getConfig().keepLast;
    while (history.length > Math.min(keep, MAX_HISTORY)) history.pop();
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Historique de sauvegarde non enregistré.', e);
    }
  }

  function dataSignature(text) {
    let hash = 5381;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    }
    return text.length + ':' + hash.toString(36);
  }

  /* ---------- Sauvegarde ---------- */
  async function writeToFolder(filename, content) {
    const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(content);
      await writable.close();
    } catch (e) {
      try { await writable.abort(); } catch (err) { /* déjà fermé */ }
      throw e;
    }
  }

  function downloadBackup(filename, content) {
    if (typeof downloadFile === 'function') {
      downloadFile(filename, content, 'application/json');
      return;
    }
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function notifyBackup(title, body, key) {
    if (window.notifier && typeof window.notifier.send === 'function') {
      window.notifier.send(title, body, { category: 'backups', key, timeout: 6000 });
    }
  }

  function removeFromHistory(names) {
    if (!names.length) return;
    const remaining = getHistory().filter(item => !names.includes(item.filename));
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(remaining));
    } catch (e) {
      console.warn('Historique de sauvegarde non nettoyé.', e);
    }
  }

  async function pruneOldBackups(now) {
    const config = getConfig();
    if (!directoryHandle || config.retentionDays <= 0) return 0;
    if (currentPermission !== 'granted') return 0;
    const stale = [];
    try {
      for await (const entry of directoryHandle.values()) {
        if (entry.kind !== 'file') continue;
        if (isOldBackup(entry.name, config.prefix, config.retentionDays, now)) stale.push(entry.name);
      }
    } catch (e) {
      console.warn('Lecture du dossier de sauvegarde impossible.', e);
      return 0;
    }
    const removed = [];
    for (const name of stale) {
      try {
        await directoryHandle.removeEntry(name);
        removed.push(name);
      } catch (e) {
        console.warn('Suppression impossible : ' + name, e);
      }
    }
    removeFromHistory(removed);
    return removed.length;
  }

  async function runBackup(reason = 'manual') {
    const config = getConfig();
    const manual = reason === 'manual';
    if (!config.enabled && !manual) return { ok: false, skipped: true, reason: 'disabled' };
    if (!state) return { ok: false, error: 'Données indisponibles.' };
    if (typeof flushPendingSave === 'function') flushPendingSave();

    let method = 'download';
    if (directoryHandle) {
      currentPermission = await queryHandlePermission(directoryHandle);
      if (manual && currentPermission !== 'granted') {
        currentPermission = await ensurePermission(directoryHandle, true);
      }
      if (currentPermission === 'granted') {
        method = 'folder';
      } else if (!manual) {
        if (!warnedPermission) {
          warnedPermission = true;
          if (typeof toast === 'function') toast('Sauvegarde en attente : autorisez le dossier dans Paramètres.', 'error');
        }
        return { ok: false, skipped: true, reason: 'permission' };
      }
    }
    if (method === 'download' && !manual && !config.downloadFallback) {
      if (!warnedMissingFolder) {
        warnedMissingFolder = true;
        if (typeof toast === 'function') toast('Sauvegarde automatique en attente : choisissez un dossier.', 'error');
      }
      return { ok: false, skipped: true, reason: 'no-folder' };
    }

    const content = JSON.stringify(state, null, 2);
    const now = new Date();
    const filename = buildFilename(config.prefix, now);
    const bytes = new Blob([content]).size;

    let pruned = 0;
    try {
      if (method === 'folder') {
        await writeToFolder(filename, content);
        pruned = await pruneOldBackups(now);
      } else {
        downloadBackup(filename, content);
      }
      addToHistory({
        filename,
        at: now.toISOString(),
        reason,
        bytes,
        method,
        employerCount: Array.isArray(state.employers) ? state.employers.length : 0
      });
      lastSignature = dataSignature(content);
      warnedMissingFolder = false;
      warnedPermission = false;
      if (manual && typeof toast === 'function') {
        toast(method === 'folder'
          ? `Sauvegarde créée dans le dossier : ${filename}${pruned ? ` (${plural(pruned, 'ancienne copie supprimée', 'anciennes copies supprimées')})` : ''}`
          : 'Sauvegarde téléchargée : ' + filename);
      }
      notifyBackup('Sauvegarde effectuée', filename, 'backup:' + filename);
      window.dispatchEvent(new CustomEvent('auto-backup-done', { detail: { filename, method, reason, pruned } }));
      return { ok: true, filename, method, pruned };
    } catch (e) {
      console.error('Sauvegarde externe impossible.', e);
      if (typeof toast === 'function') toast('Sauvegarde impossible : ' + (e.message || 'erreur inconnue'), 'error');
      return { ok: false, error: e.message || 'Erreur de sauvegarde.' };
    }
  }

  /* ---------- Planification ---------- */
  function unschedule() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (changeTimer) {
      clearTimeout(changeTimer);
      changeTimer = null;
    }
  }

  function schedule() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    const config = getConfig();
    if (!config.enabled || config.frequency === 'on-change') return;
    const next = nextRunAt(config, new Date());
    if (!next) return;
    timerId = setTimeout(async () => {
      timerId = null;
      await runBackup('scheduled');
      schedule();
    }, Math.max(1000, next.getTime() - Date.now()));
  }

  function onDataChange() {
    if (!initialized) return;
    const config = getConfig();
    if (!config.enabled || config.frequency !== 'on-change') return;
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(async () => {
      changeTimer = null;
      if (!state) return;
      const content = JSON.stringify(state);
      if (lastSignature && dataSignature(content) === lastSignature) return;
      await runBackup('auto-change');
    }, 5 * 60 * 1000);
  }

  function maybeCatchUp(config) {
    if (!config.enabled || config.frequency === 'on-change') return;
    if (!directoryHandle || currentPermission !== 'granted') return;
    const history = getHistory();
    if (!history.length) return;
    const last = Date.parse(history[0].at || '');
    if (!Number.isFinite(last)) return;
    if (Date.now() - last < intervalMs(config)) return;
    setTimeout(() => { runBackup('scheduled'); }, 8000);
  }

  async function init() {
    if (initialized) return getStatus();
    initialized = true;
    try {
      directoryHandle = await loadHandle();
      currentPermission = directoryHandle ? await queryHandlePermission(directoryHandle) : 'none';
    } catch (e) {
      console.warn('Dossier de sauvegarde non rechargé.', e);
      directoryHandle = null;
      currentPermission = 'none';
    }
    lastSignature = state ? dataSignature(JSON.stringify(state)) : null;
    const config = getConfig();
    schedule();
    maybeCatchUp(config);
    return getStatus();
  }

  function getStatus() {
    const config = getConfig();
    return {
      supported: typeof window.showDirectoryPicker === 'function',
      folderName: directoryHandle ? directoryHandle.name : '',
      permission: directoryHandle ? currentPermission : 'none',
      nextRun: nextRunAt(config, new Date()),
      lastBackup: getHistory()[0] || null
    };
  }

  function reasonLabel(reason) {
    return REASON_LABELS[reason] || reason || '—';
  }

  return {
    DEFAULT_CONFIG,
    getConfig,
    saveConfig,
    sanitizePrefix,
    buildFilename,
    backupTimestamp,
    isOldBackup,
    pruneOldBackups,
    nextRunAt,
    pickDirectory,
    grantDirectoryAccess,
    runBackup,
    getHistory,
    init,
    onDataChange,
    schedule,
    unschedule,
    getStatus,
    reasonLabel
  };
})();
