/* ============================================================
   Notifications du navigateur : échéances, actions, seuils
   ============================================================ */

window.notifier = (function () {
  const CONFIG_KEY = 'suivi-cotisations-notifications-v1';
  const SEEN_KEY = 'suivi-cotisations-notifications-seen-v1';
  const SEEN_TTL = 7 * 24 * 60 * 60 * 1000;
  const CHECK_INTERVAL = 60 * 60 * 1000;
  const MAX_PER_RUN = 8;

  const DEFAULT_CONFIG = Object.freeze({
    enabled: false,
    categories: Object.freeze({
      schedules: true,
      actions: true,
      thresholds: true,
      backups: false
    }),
    scheduleDays: 7,
    thresholds: Object.freeze({
      balance: 1000000,
      age: 180
    }),
    quietHours: Object.freeze({
      start: '20:00',
      end: '07:00'
    })
  });

  let intervalId = null;
  let firstCheckId = null;
  let baseTitle = null;
  let visibilityBound = false;

  function cloneDefaults() {
    return {
      enabled: false,
      categories: {
        schedules: true,
        actions: true,
        thresholds: true,
        backups: false
      },
      scheduleDays: 7,
      thresholds: {
        balance: 1000000,
        age: 180
      },
      quietHours: {
        start: '20:00',
        end: '07:00'
      }
    };
  }

  function validTime(value, fallback) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? String(value) : fallback;
  }

  function normalizeConfig(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const config = cloneDefaults();
    config.enabled = !!source.enabled;
    const categories = source.categories && typeof source.categories === 'object' ? source.categories : {};
    config.categories.schedules = categories.schedules !== false;
    config.categories.actions = categories.actions !== false;
    config.categories.thresholds = categories.thresholds !== false;
    config.categories.backups = !!categories.backups;
    config.scheduleDays = [3, 7, 14, 30].includes(Number(source.scheduleDays)) ? Number(source.scheduleDays) : 7;
    const thresholds = source.thresholds && typeof source.thresholds === 'object' ? source.thresholds : {};
    config.thresholds.balance = thresholds.balance == null
      ? DEFAULT_CONFIG.thresholds.balance
      : Math.max(0, Math.round(num(thresholds.balance)));
    config.thresholds.age = thresholds.age == null
      ? DEFAULT_CONFIG.thresholds.age
      : Math.max(0, Math.round(num(thresholds.age)));
    const quiet = source.quietHours && typeof source.quietHours === 'object' ? source.quietHours : {};
    config.quietHours.start = validTime(quiet.start, DEFAULT_CONFIG.quietHours.start);
    config.quietHours.end = validTime(quiet.end, DEFAULT_CONFIG.quietHours.end);
    return config;
  }

  function getConfig() {
    try {
      return normalizeConfig(JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null'));
    } catch (e) {
      return normalizeConfig(null);
    }
  }

  function saveConfig(config) {
    const normalized = normalizeConfig(config);
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.warn('Configuration de notifications non enregistrée.', e);
    }
    return normalized;
  }

  function permission() {
    return ('Notification' in window) ? Notification.permission : 'unsupported';
  }

  async function requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission;
    try {
      return await Notification.requestPermission();
    } catch (e) {
      return 'denied';
    }
  }

  function getSeen() {
    try {
      const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function isSeen(key) {
    return !!getSeen()[key];
  }

  function markSeen(key) {
    const seen = getSeen();
    seen[key] = Date.now();
    const cutoff = Date.now() - SEEN_TTL;
    Object.keys(seen).forEach(k => {
      if (!(seen[k] >= cutoff)) delete seen[k];
    });
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch (e) {
      console.warn('Mémoire des notifications non enregistrée.', e);
    }
  }

  function timeToMinutes(value) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function inQuietRange(range, minutes) {
    if (!range) return false;
    const start = timeToMinutes(range.start);
    const end = timeToMinutes(range.end);
    if (start == null || end == null || start === end) return false;
    if (start < end) return minutes >= start && minutes < end;
    return minutes >= start || minutes < end;
  }

  function isQuietHours(config) {
    const now = new Date();
    return inQuietRange(config.quietHours, now.getHours() * 60 + now.getMinutes());
  }

  function send(title, body, options = {}) {
    const config = getConfig();
    if (!config.enabled && !options.force) return false;
    if (options.category && config.categories[options.category] === false) return false;
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    if (!options.force && isQuietHours(config)) return false;

    const key = options.key || `${title}:${body}`;
    if (!options.force && isSeen(key)) return false;

    let notif = null;
    try {
      notif = new Notification(title, {
        body: String(body || ''),
        tag: key,
        requireInteraction: !!options.important,
        data: { employerId: options.employerId || '' }
      });
    } catch (e) {
      console.warn('Notification impossible.', e);
      return false;
    }

    notif.onclick = () => {
      try { window.focus(); } catch (e) { /* fenêtre déjà active */ }
      if (options.employerId && typeof openEmployerFiche === 'function') {
        openEmployerFiche(options.employerId);
      } else if (options.hash) {
        location.hash = options.hash;
      }
      notif.close();
    };

    if (!options.force) markSeen(key);
    if (options.timeout !== false) {
      setTimeout(() => {
        try { notif.close(); } catch (e) { /* déjà fermée */ }
      }, options.timeout || 10000);
    }
    return true;
  }

  function scheduleCount(config) {
    if (!state || !Array.isArray(state.schedules)) return 0;
    const today = effectiveToday();
    const limit = addDaysISO(today, config.scheduleDays);
    return state.schedules.filter(sch => {
      if (!sch.dueDate) return false;
      if (scheduleStats(sch).status === 'Payée') return false;
      return sch.dueDate >= today && sch.dueDate <= limit;
    }).length;
  }

  function updateTabBadge() {
    if (baseTitle == null) baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
    const config = getConfig();
    const count = config.enabled ? scheduleCount(config) : 0;
    document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
  }

  function runChecks() {
    const config = getConfig();
    updateTabBadge();
    if (!config.enabled || permission() !== 'granted') return 0;

    const employers = new Map(state.employers.map(emp => [emp.id, emp]));
    const today = effectiveToday();
    let sent = 0;

    if (config.categories.schedules) {
      const limit = addDaysISO(today, config.scheduleDays);
      const upcoming = state.schedules
        .filter(sch => sch.dueDate && sch.dueDate >= today && sch.dueDate <= limit && scheduleStats(sch).status !== 'Payée')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      for (const sch of upcoming) {
        if (sent >= MAX_PER_RUN) break;
        const emp = employers.get(sch.employerId);
        if (!emp) continue;
        const daysLeft = Math.max(0, daysBetween(today, sch.dueDate));
        const title = daysLeft === 0
          ? 'Échéance aujourd’hui'
          : `Échéance dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`;
        const body = `${employerDisplay(emp)}${sch.number ? ' · ' + sch.number : ''} — ${fmtMoney(num(sch.amount))}`;
        if (send(title, body, {
          category: 'schedules',
          key: `sch:${sch.id}:${sch.dueDate}`,
          employerId: sch.employerId,
          important: daysLeft <= 2
        })) sent += 1;
      }
    }

    if (config.categories.actions && sent < MAX_PER_RUN) {
      const entries = state.journal
        .filter(entry => entry.nextDate && entry.employerId && entry.nextDate <= today)
        .filter(entry => daysBetween(entry.nextDate, today) <= 7)
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
      for (const entry of entries) {
        if (sent >= MAX_PER_RUN) break;
        const emp = employers.get(entry.employerId);
        if (!emp) continue;
        const late = daysBetween(entry.nextDate, today);
        const title = late > 0 ? `Action en retard de ${late} jour${late > 1 ? 's' : ''}` : 'Action prévue aujourd’hui';
        const body = `${employerDisplay(emp)} — ${entry.type}${entry.nextAction ? ' : ' + entry.nextAction : ''}`;
        if (send(title, body, {
          category: 'actions',
          key: `act:${entry.id}:${entry.nextDate}`,
          employerId: entry.employerId
        })) sent += 1;
      }
    }

    if (config.categories.thresholds && sent < MAX_PER_RUN) {
      const { stats } = buildStats();
      for (const stat of stats) {
        if (sent >= MAX_PER_RUN) break;
        if (num(stat.totalBalance) <= 0) continue;
        if (config.thresholds.balance > 0 && num(stat.totalBalance) > config.thresholds.balance) {
          if (send('Solde impayé élevé', `${employerDisplay(stat.emp)} — ${fmtMoney(stat.totalBalance)}`, {
            category: 'thresholds',
            key: `thr:bal:${stat.emp.id}`,
            employerId: stat.emp.id
          })) sent += 1;
        }
        if (sent >= MAX_PER_RUN) break;
        if (stat.ageDays != null && config.thresholds.age > 0 && num(stat.ageDays) > config.thresholds.age) {
          if (send('Dette ancienne', `${employerDisplay(stat.emp)} — ${stat.ageDays} jours d’ancienneté`, {
            category: 'thresholds',
            key: `thr:age:${stat.emp.id}`,
            employerId: stat.emp.id
          })) sent += 1;
        }
      }
    }

    return sent;
  }

  function stop() {
    if (intervalId) clearInterval(intervalId);
    if (firstCheckId) clearTimeout(firstCheckId);
    intervalId = null;
    firstCheckId = null;
    updateTabBadge();
  }

  function start() {
    stop();
    firstCheckId = setTimeout(() => {
      firstCheckId = null;
      runChecks();
    }, 4000);
    intervalId = setInterval(runChecks, CHECK_INTERVAL);
    if (!visibilityBound) {
      visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && getConfig().enabled) runChecks();
      });
    }
  }

  function init() {
    const config = getConfig();
    updateTabBadge();
    if (config.enabled && permission() === 'granted') start();
    else stop();
  }

  function onDataChange() {
    if (getConfig().enabled) updateTabBadge();
  }

  async function test() {
    const perm = await requestPermission();
    if (perm !== 'granted') return perm;
    const ok = send(
      'Test de notification',
      'Les notifications de l’application fonctionnent.',
      { force: true, timeout: 6000, key: `test:${Date.now()}` }
    );
    return ok ? 'sent' : 'failed';
  }

  return {
    DEFAULT_CONFIG,
    getConfig,
    saveConfig,
    permission,
    requestPermission,
    send,
    runChecks,
    start,
    stop,
    init,
    onDataChange,
    updateTabBadge,
    inQuietRange,
    test
  };
})();
