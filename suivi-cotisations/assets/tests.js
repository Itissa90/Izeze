/* ============================================================
   Contrôles automatiques — à ouvrir via tests.html
   Ne lit ni ne modifie les données enregistrées dans l'application.
   ============================================================ */

(function () {
  const results = [];
  let passed = 0;

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Condition fausse');
  }

  function eq(actual, expected, label) {
    if (actual !== expected) {
      throw new Error(`${label || 'Valeur'} : attendu « ${expected} », obtenu « ${actual} »`);
    }
  }

  function assertThrows(fn, label) {
    let thrown = false;
    try { fn(); } catch (e) { thrown = true; }
    assert(thrown, label || 'Une erreur était attendue');
  }

  function freshState() {
    state = seedState();
    state.settings.todayOverride = '2026-06-15';
    return state;
  }

  function test(name, fn) {
    try {
      fn();
      results.push({ name, ok: true });
      passed += 1;
    } catch (e) {
      results.push({ name, ok: false, message: e && e.message ? e.message : String(e) });
    }
  }

  /* ---------- Données initiales ---------- */
  test('Le registre initial contient 71 employeurs', () => {
    const seeded = seedState();
    eq(seeded.employers.length, 71, 'Nombre d’employeurs');
    eq(new Set(seeded.employers.map(e => e.id)).size, 71, 'Identifiants uniques');
    eq(seeded.dataVersion, DATA_VERSION, 'Version de données');
    assert(Array.isArray(seeded.insured), 'Tableau des assurés présent');
    assert(Array.isArray(seeded.journal), 'Journal présent');
    assert(Array.isArray(seeded.schedules), 'Échéanciers présents');
  });

  /* ---------- Dates ---------- */
  test('Calculs de dates', () => {
    eq(daysBetween('2026-01-01', '2026-01-31'), 30, 'Jours de janvier');
    eq(addDaysISO('2026-02-27', 2), '2026-03-01', 'Ajout de jours');
    eq(addMonths('2026-12', 1), '2027-01', 'Passage d’année');
    eq(monthLong('2026-03'), 'mars 2026', 'Mois long');
    eq(fmtDate('2026-11-09'), '09/11/2026', 'Date courte');
  });

  test('Mois invalides refusés explicitement', () => {
    eq(normalizeMonth('2026-01'), '2026-01', 'Mois valide');
    eq(normalizeMonth(''), '', 'Mois vide');
    eq(normalizeMonth(null), '', 'Mois absent');
    eq(normalizeMonth('abc'), '', 'Mois illisible');
    eq(normalizeMonth('2026-13'), '', 'Mois hors plage');
    const raw = seedState();
    const emp = raw.employers[0];
    raw.monthly = { [emp.id]: { '2026-01': { dueGlobal: 1000 }, 'sans mois': { dueGlobal: 50 } } };
    const normalized = normalizeImportedState(raw);
    eq(Object.keys(normalized.monthly[emp.id]).length, 1, 'Clé de mois invalide ignorée');
    eq(normalized.monthly[emp.id]['2026-01'].dueGlobal, 1000, 'Mois valide conservé');
  });

  /* ---------- Calculs des assurés ---------- */
  test('Calcul des cotisations d’un assuré', () => {
    freshState();
    state.settings.valeurIndiciaire = 12000;
    state.settings.rateEmployee = 0.07;
    state.settings.rateEmployer = 0.20;
    const calc = computeInsuredRow({ indice: 100 });
    eq(calc.salary, 100000, 'Salaire');
    eq(calc.employee, 7000, 'Part employé');
    eq(calc.employer, 20000, 'Part employeur');
    eq(calc.total, 27000, 'Total');
  });

  test('Valeur indiciaire 1272,7 utilisée sans arrondi', () => {
    freshState();
    eq(state.settings.valeurIndiciaire, 1272.7, 'Valeur par défaut exacte');
    const calc = computeInsuredRow({ indice: 100 });
    eq(calc.salary, 10606, 'Salaire calculé avec 1272,7');
    eq(calc.employee, 742, 'Part employé');
    eq(calc.employer, 2121, 'Part employeur');
    state.settings.valeurIndiciaire = 1273;
    eq(computeInsuredRow({ indice: 100 }).salary, 10608, 'Une valeur arrondie donnerait 10 608');
    state.settings.valeurIndiciaire = 1272.7;
    const raw = seedState();
    raw.settings.valeurIndiciaire = '1272,7';
    eq(normalizeImportedState(raw).settings.valeurIndiciaire, 1272.7, 'Valeur décimale conservée à l’import');
    eq(fmtDecimal(1272.7), '1\u202f272,7', 'Affichage exact avec décimale');
    eq(fmtDecimal('1 272,7'), '1\u202f272,7', 'Saisie avec virgule');
    eq(num(fmtDecimal('1272.7')), 1272.7, 'Valeur relue sans arrondi');
  });

  test('Le détail des assurés prime sur le dû global', () => {
    freshState();
    state.settings.valeurIndiciaire = 12000;
    const emp = state.employers[0];
    state.monthly = { [emp.id]: { '2026-01': { dueGlobal: 500000, collected: 100000 } } };
    state.insured = [{ id: 'i1', employerId: emp.id, month: '2026-01', indice: 100 }];
    const entry = monthStats(emp.id, '2026-01', buildInsuredIndex());
    eq(entry.hasDetail, true, 'Détail présent');
    eq(entry.dueRetained, 27000, 'Dû retenu');
    eq(entry.balance, -73000, 'Solde du mois');
  });

  test('Synthèse annuelle d’un employeur', () => {
    freshState();
    const emp = state.employers[0];
    state.monthly = {
      [emp.id]: {
        '2026-01': { dueGlobal: 100000, collected: 40000 },
        '2026-02': { dueGlobal: 50000, collected: 50000 }
      }
    };
    const stat = employerStats(emp, new Map(), monthsList('2026'));
    eq(stat.due, 150000, 'Dû annuel');
    eq(stat.collected, 90000, 'Encaissé annuel');
    eq(stat.balance, 60000, 'Solde annuel');
    eq(stat.totalBalance, 60000, 'Solde cumulé');
    eq(stat.startMonth, '2026-01', 'Premier mois impayé');
    eq(stat.endMonth, '2026-01', 'Dernier mois impayé');
  });

  test('Report pluriannuel avec paiement partiel', () => {
    freshState();
    const emp = state.employers[0];
    state.monthly = {
      [emp.id]: {
        '2025-01': { dueGlobal: 100000, collected: 60000 },
        '2025-02': { dueGlobal: 0, collected: 20000 },
        '2026-01': { dueGlobal: 100000, collected: 0 }
      }
    };
    const stat = employerStats(emp, new Map(), monthsList('2026'), monthsList('2025'));
    eq(stat.priorDue, 100000, 'Dû 2025');
    eq(stat.priorCollected, 80000, 'Encaissé 2025');
    eq(stat.priorBalance, 20000, 'Solde reporté après paiement partiel');
    eq(stat.due, 100000, 'Dû 2026');
    eq(stat.totalBalance, 120000, 'Solde cumulé sur deux années');
    eq(stat.startMonth, '2025-01', 'Impayé depuis janvier 2025');
    eq(stat.endMonth, '2026-01', 'Dernier mois impayé en 2026');
  });

  test('Effectif mensuel : référence et remplacement', () => {
    freshState();
    const emp = state.employers[0];
    emp.effectif = 42;
    state.monthly = {};
    const inherited = monthlyEffectifInfo(emp.id, '2026-01');
    eq(inherited.value, 42, 'Effectif hérité de la fiche');
    eq(inherited.inherited, true, 'Héritage signalé');
    state.monthly[emp.id] = { '2026-01': { effectif: 0 } };
    const zero = monthlyEffectifInfo(emp.id, '2026-01');
    eq(zero.value, 0, 'Effectif zéro conservé');
    eq(zero.inherited, false, 'Remplacement signalé');
    state.monthly[emp.id]['2026-01'].effectif = 55;
    const ms = monthStats(emp.id, '2026-01', new Map());
    eq(ms.effectif, 55, 'Effectif mensuel retenu');
    eq(ms.effectifInherited, false, 'Valeur saisie pour le mois');
  });

  test('Effectif moyen et bornes annuelles', () => {
    freshState();
    const emp = state.employers[0];
    const year = '2026';
    const months = monthsList(year);
    const monthly = {};
    months.forEach((m, i) => { monthly[m] = { dueGlobal: 1000, effectif: i === 0 ? 10 : 20 }; });
    state.monthly = { [emp.id]: monthly };
    const stat = employerStats(emp, new Map(), months);
    eq(stat.effectifStart, 10, 'Effectif de début');
    eq(stat.effectifEnd, 20, 'Effectif de fin');
    eq(stat.effectifAverage, 19, 'Effectif moyen arrondi');
  });

  test('Rapport comité : synthèse d’une page', () => {
    freshState();
    state.settings.alertDays = 30;
    const [a, b, c] = state.employers;
    state.monthly = {
      [a.id]: {
        '2025-01': { dueGlobal: 900000, collected: 0 },
        '2026-01': { dueGlobal: 900000, collected: 0 }
      },
      [b.id]: { '2026-01': { dueGlobal: 500000, collected: 200000 } },
      [c.id]: { '2026-01': { dueGlobal: 2000000, collected: 1000000 } }
    };
    state.schedules = [
      { id: 's1', employerId: a.id, amount: 100000, paidAmount: 0, dueDate: '2026-01-15' },
      { id: 's2', employerId: a.id, amount: 100000, paidAmount: 0, dueDate: '2026-02-15' }
    ];
    state.journal = [
      { id: 'j1', employerId: a.id, date: '2026-01-10', nextDate: '2026-05-01' },
      { id: 'j2', employerId: b.id, date: '2026-01-10', nextDate: '2026-06-20' }
    ];
    invalidateStatsCache();
    const report = buildCommitteeReport();
    eq(report.year, '2026', 'Année du rapport');
    eq(report.today, '2026-06-15', 'Date d’arrêté');
    eq(report.employerCount, 71, 'Employeurs suivis');
    eq(report.debtorCount, 3, 'Débiteurs');
    eq(report.totalDue, 3400000, 'Dû annuel');
    eq(report.totalCollected, 1200000, 'Encaissé annuel');
    eq(report.totalBalance, 3100000, 'Solde restant');
    eq(report.priorBalance, 900000, 'Solde antérieur inclus');
    eq(report.topDebtors.length, 3, 'Soldes impayés listés');
    eq(report.topDebtors[0].id, a.id, 'Solde le plus élevé en tête');
    eq(report.topDebtors[0].balance, 1800000, 'Montant du premier');
    eq(report.topDebtors[1].id, c.id, 'Deuxième solde');
    eq(report.topDebtors[2].id, b.id, 'Troisième solde');
    eq(report.criticalCount, 1, 'Un dossier critique');
    eq(report.criticalTop[0].id, a.id, 'Dossier critique listé');
    eq(report.overdueSchedules, 2, 'Échéances en retard');
    eq(report.overdueScheduleAmount, 200000, 'Montant des échéances en retard');
    eq(report.overdueActions, 1, 'Action de journal en retard');
    eq(report.upcomingActions, 1, 'Action à faire bientôt');
    assert(report.rate > 0 && report.rate < 1, 'Taux de recouvrement intermédiaire');
  });

  /* ---------- Échéanciers et journal ---------- */  test('Statuts des échéanciers', () => {
    freshState();
    eq(scheduleStats({ amount: 1000, paidAmount: 1000, dueDate: '2020-01-01' }).status, 'Payée', 'Échéance soldée');
    const late = scheduleStats({ amount: 1000, paidAmount: 200, dueDate: '2026-06-01' });
    eq(late.status, 'En retard', 'Échéance en retard');
    eq(late.remaining, 800, 'Reste à payer');
    eq(late.lateDays, 14, 'Jours de retard');
    eq(scheduleStats({ amount: 1000, paidAmount: 0, dueDate: '2026-12-01' }).status, 'À venir', 'Échéance à venir');
  });

  test('Alertes du journal', () => {
    freshState();
    eq(journalAlert({ nextDate: '2026-06-01' }), 'En retard', 'Action en retard');
    eq(journalAlert({ nextDate: '2026-06-30' }), 'À faire bientôt', 'Action proche');
    eq(journalAlert({ nextDate: '2026-12-01' }), 'À venir', 'Action lointaine');
    eq(journalAlert({}), '', 'Sans date');
  });

  /* ---------- Import et migration ---------- */
  test('Validation des fichiers importés', () => {
    eq(validateImport(seedState()), true, 'Fichier complet accepté');
    assertThrows(() => validateImport(null), 'Fichier vide refusé');
    assertThrows(() => validateImport([]), 'Tableau racine refusé');
    assertThrows(() => validateImport({ employers: [], monthly: {} }), 'Paramètres manquants refusés');
    assertThrows(() => validateImport({ employers: 'x', monthly: {}, settings: {} }), 'Employeurs invalides refusés');
    assertThrows(() => normalizeImportedState({ employers: [], monthly: {}, settings: {} }), 'Fichier sans employeur refusé');
  });

  test('Migration des anciennes données', () => {
    const legacy = { version: 1, employers: [], monthly: {}, meta: {} };
    const migrated = migrateState(legacy);
    eq(migrated.dataVersion, DATA_VERSION, 'Version mise à jour');
    assert(Array.isArray(migrated.insured), 'Assurés ajoutés');
    assert(Array.isArray(migrated.journal), 'Journal ajouté');
    assert(Array.isArray(migrated.schedules), 'Échéanciers ajoutés');
    assert(migrated.settings && typeof migrated.settings === 'object', 'Paramètres ajoutés');
  });

  test('Normalisation d’une sauvegarde complète', () => {
    const normalized = normalizeImportedState(seedState());
    eq(normalized.employers.length, 71, 'Employeurs conservés');
    eq(normalized.dataVersion, DATA_VERSION, 'Version des données');
    eq(normalized.version, APP_VERSION, 'Version de l’application');
  });

  test('Import : effectif mensuel conservé', () => {
    const raw = seedState();
    const emp = raw.employers[0];
    raw.monthly = { [emp.id]: { '2026-03': { dueGlobal: 5000, collected: 1000, effectif: 33 } } };
    const normalized = normalizeImportedState(raw);
    eq(normalized.monthly[emp.id]['2026-03'].effectif, 33, 'Effectif du mois importé');
  });

  test('Thèmes de couleurs disponibles', () => {
    eq(THEMES.length, 4, 'Quatre thèmes');
    eq(normalizeTheme('amber'), 'amber', 'Thème gris et jaune accepté');
    eq(normalizeTheme('red'), 'red', 'Thème rouge et gris accepté');
    eq(normalizeTheme('dark'), 'dark', 'Thème sombre accepté');
    eq(normalizeTheme('inconnu'), '', 'Thème inconnu ramené au bleu');
  });

  /* ---------- Contacts ---------- */
  test('Contacts : téléphones, e-mails et liens', () => {
    const a = parseContact('90327777/96193939 MUSTAPHA');
    eq(a.phones.length, 2, 'Deux téléphones');
    eq(a.phones[0], '90327777', 'Premier téléphone');
    eq(a.rest, 'MUSTAPHA', 'Nom du contact conservé');
    eq(contactPhoneHref(a.phones[0]), 'tel:+22890327777', 'Lien d’appel');
    eq(contactPhoneLabel(a.phones[0]), '90 32 77 77', 'Numéro lisible');

    const b = parseContact('70597606 M SOGOYOU/samtou.sogoyou@sos-togo.org');
    eq(b.phones[0], '70597606', 'Téléphone extrait');
    eq(b.emails[0], 'samtou.sogoyou@sos-togo.org', 'E-mail extrait');
    eq(b.rest, 'M SOGOYOU', 'Nom et téléphone séparés');

    const c = parseContact('70651653sseqcu.togo@gmail.com');
    eq(c.phones[0], '70651653', 'Numéro collé à l’e-mail séparé');
    eq(c.emails[0], 'sseqcu.togo@gmail.com', 'E-mail reconstitué');

    const d = parseContact('90095882/uepdro4@gmail.com/promake@yahoo.com');
    eq(d.emails.length, 2, 'Deux e-mails');
    eq(d.phones.length, 1, 'Un téléphone');

    const e = parseContact('Projet fermé cette année en juin 2026');
    eq(e.phones.length, 0, 'Année non confondue avec un téléphone');
    eq(e.emails.length, 0, 'Aucun e-mail');
    eq(e.rest, 'Projet fermé cette année en juin 2026', 'Texte libre conservé');

    const f = parseContact('91651794 M KPATCHA (Institution dissoute en Mars 2026)');
    eq(f.phones.length, 1, 'Un seul téléphone');
    eq(f.rest, 'M KPATCHA (Institution dissoute en Mars 2026)', 'Note entre parenthèses conservée');
    eq(parseContact('26601055/bureau_togo@santeintégree.org').emails[0], 'bureau_togo@santeintégree.org', 'E-mail accentué reconnu');
  });

  /* ---------- Excel ---------- */
  test('Excel : colonnes du suivi mensuel reconnues', () => {
    assert(window.excelTools, 'Module Excel chargé');
    assert(typeof XLSX !== 'undefined' && typeof XLSX.utils === 'object', 'SheetJS chargé localement');
    const columns = excelTools.mapMonthlyColumns(['N° immatriculation', 'Employeur', 'Mois', 'Effectif', 'Dû global saisi', 'Dû détail (auto)', 'Dû retenu', 'Encaissé', 'Solde du mois']);
    eq(columns.registration, 0, 'Colonne immatriculation');
    eq(columns.month, 2, 'Colonne mois');
    eq(columns.effectif, 3, 'Colonne effectif');
    eq(columns.due, 4, 'Colonne dû');
    eq(columns.collected, 7, 'Colonne encaissé');
    eq(excelTools.cellValue(new Date(2026, 0, 15)), '2026-01-15', 'Date Excel convertie');
  });

  test('Excel : en-tête décalé et feuille détectée', () => {
    const rows = [
      ['Rapport de suivi 2026'],
      [],
      ['N° d’immatriculation', 'Mois', 'Dû global', 'Encaissé'],
      ['EMP-001', '2026-01', 1500, 500]
    ];
    eq(excelTools.findMonthlyHeaderRow(rows), 2, 'En-tête trouvé à la troisième ligne');
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['N° immatriculation', 'Mois', 'Dû global', 'Encaissé'],
      ['EMP-001', '2026-01', 1500, 500]
    ]), 'Données');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Feuille vide']]), 'Notes');
    const candidates = excelTools.monthlyCandidates(workbook);
    eq(candidates.length, 1, 'Une seule feuille retenue');
    eq(candidates[0].sheet, 'Données', 'Nom de la feuille');
    eq(candidates[0].rows[1][2], 1500, 'Montant conservé');
  });

  test('Excel : classeur écrit puis relu', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['N° immatriculation', 'Mois', 'Dû global', 'Encaissé'],
      ['EMP-002', '2026-02', 2500, 1000]
    ]), 'Suivi mensuel');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    assert(bytes && (bytes.byteLength || bytes.length) > 0, 'Classeur généré');
    const reread = XLSX.read(bytes, { type: 'array', cellDates: true });
    const candidates = excelTools.monthlyCandidates(reread);
    eq(candidates.length, 1, 'Feuille relue');
    eq(candidates[0].rows.length, 2, 'Ligne de données relue');
    eq(candidates[0].rows[1][3], 1000, 'Encaissement relu');
  });

  /* ---------- Score de risque ---------- */
  test('Niveaux de risque et dossier soldé', () => {
    freshState();
    eq(riskScoring.levelFor(30).key, 'low', 'Score 30');
    eq(riskScoring.levelFor(31).key, 'medium', 'Score 31');
    eq(riskScoring.levelFor(61).key, 'high', 'Score 61');
    eq(riskScoring.levelFor(81).key, 'critical', 'Score 81');
    const balanced = riskScoring.compute({
      emp: state.employers[0], months: {}, due: 0, collected: 0,
      priorDue: 0, priorCollected: 0, totalBalance: 0, ageDays: null
    });
    eq(balanced.balanced, true, 'Solde nul');
    eq(balanced.score, 0, 'Risque nul');
    eq(balanced.level.key, 'balanced', 'Niveau soldé');
  });

  test('Calcul du score de risque', () => {
    freshState();
    state.schedules = [];
    const emp = state.employers[0];
    const months = {};
    monthsList('2026').forEach(month => {
      months[month] = { month, dueRetained: 1000, collected: 0, balance: 1000 };
    });
    const risk = riskScoring.compute({
      emp, months, due: 12000, collected: 0, priorDue: 0, priorCollected: 0,
      totalBalance: 12000, ageDays: 365
    });
    eq(risk.factors.length, 5, 'Cinq facteurs');
    eq(risk.factors.find(f => f.key === 'regularity').value, 100, 'Aucun mois payé');
    eq(risk.factors.find(f => f.key === 'recovery').value, 100, 'Aucun encaissement');
    eq(risk.factors.find(f => f.key === 'age').value, 100, 'Un an d’ancienneté');
    eq(risk.score, 73, 'Score pondéré');
    eq(risk.level.key, 'high', 'Niveau élevé');
  });

  test('Répartition et priorités de risque', () => {
    freshState();
    const emp = state.employers[0];
    const months = {};
    monthsList('2026').forEach(month => {
      months[month] = { month, dueRetained: 1000, collected: 0, balance: 1000 };
    });
    const risky = riskScoring.compute({
      emp, months, due: 12000, collected: 0, priorDue: 0, priorCollected: 0,
      totalBalance: 12000, ageDays: 365
    });
    const settled = riskScoring.compute({
      emp: state.employers[1], months: {}, due: 0, collected: 0,
      priorDue: 0, priorCollected: 0, totalBalance: 0, ageDays: null
    });
    const dist = riskScoring.distribution([risky, settled]);
    eq(dist.find(d => d.key === 'balanced').count, 1, 'Un dossier soldé');
    eq(dist.find(d => d.key === 'high').count, 1, 'Un dossier élevé');
    const top = riskScoring.top([risky, settled], 5);
    eq(top.length, 1, 'Le dossier soldé est exclu');
    eq(top[0].employerId, emp.id, 'Dossier prioritaire');
  });

  /* ---------- Filtres rapides du registre ---------- */
  test('Filtres rapides du registre', () => {
    freshState();
    eq(effectiveToday(), '2026-06-15', 'Date de référence de test');
    eq(EMPLOYER_QUICK_FILTERS.length, 4, 'Quatre filtres proposés');
    const debtor = { emp: { id: 'a' }, totalBalance: 5000, lastAction: null };
    const settled = { emp: { id: 'b' }, totalBalance: 0, lastAction: '2026-01-01' };
    eq(matchesQuickFilter(debtor, 'debtors', {}), true, 'Débiteur détecté');
    eq(matchesQuickFilter(settled, 'debtors', {}), false, 'Dossier soldé exclu');
    eq(matchesQuickFilter(debtor, 'stale', {}), true, 'Dossier jamais relancé');
    eq(matchesQuickFilter({ emp: { id: 'a' }, totalBalance: 5000, lastAction: '2026-06-01' }, 'stale', {}), false, 'Action récente');
    eq(matchesQuickFilter({ emp: { id: 'a' }, totalBalance: 5000, lastAction: '2026-05-15' }, 'stale', {}), true, 'Action il y a 31 jours');
    eq(matchesQuickFilter(settled, 'stale', {}), false, 'Dossier soldé exclu des relances');
    const riskById = new Map([
      ['a', { balanced: false, level: { key: 'critical' } }],
      ['b', { balanced: true, level: { key: 'balanced' } }]
    ]);
    eq(matchesQuickFilter(debtor, 'critical', { riskById }), true, 'Score critique');
    eq(matchesQuickFilter(settled, 'critical', { riskById }), false, 'Dossier soldé sans risque');
    state.schedules = [
      { id: 's1', employerId: 'a', amount: 1000, paidAmount: 200, dueDate: '2026-06-01' },
      { id: 's2', employerId: 'b', amount: 1000, paidAmount: 1000, dueDate: '2026-06-01' }
    ];
    const lateIds = lateScheduleEmployerIds();
    assert(lateIds.has('a'), 'Échéance dépassée détectée');
    assert(!lateIds.has('b'), 'Échéance payée ignorée');
    eq(matchesQuickFilter(debtor, 'schedule-late', { lateIds }), true, 'Employeur en retard');
    eq(matchesQuickFilter(settled, 'schedule-late', { lateIds }), false, 'Employeur à jour');
  });

  /* ---------- Navigation clavier du suivi mensuel ---------- */
  test('Navigation clavier du suivi mensuel', () => {
    const disabled = new Set(['1:1']);
    const enabled = (r, c) => !disabled.has(r + ':' + c);
    eq(JSON.stringify(monthlyMoveIndex(0, 0, 'down', 3, 3, enabled)), '{"row":1,"col":0}', 'Ligne suivante');
    eq(JSON.stringify(monthlyMoveIndex(2, 2, 'up', 3, 3, enabled)), '{"row":1,"col":2}', 'Ligne précédente');
    eq(JSON.stringify(monthlyMoveIndex(0, 1, 'down', 3, 3, enabled)), '{"row":2,"col":1}', 'Cellule désactivée ignorée');
    eq(JSON.stringify(monthlyMoveIndex(0, 0, 'right', 3, 3, enabled)), '{"row":0,"col":1}', 'Colonne suivante');
    eq(JSON.stringify(monthlyMoveIndex(0, 2, 'right', 3, 3, enabled)), '{"row":1,"col":0}', 'Fin de ligne : ligne suivante');
    eq(JSON.stringify(monthlyMoveIndex(1, 0, 'left', 3, 3, enabled)), '{"row":0,"col":2}', 'Début de ligne : ligne précédente');
    eq(monthlyMoveIndex(0, 0, 'left', 1, 3, enabled), null, 'Première cellule sans retour');
    eq(monthlyMoveIndex(0, 0, 'up', 3, 3, enabled), null, 'Première ligne sans retour');
    const noMiddle = (r, c) => c !== 1;
    eq(JSON.stringify(monthlyMoveIndex(0, 0, 'right', 2, 3, noMiddle)), '{"row":0,"col":2}', 'Colonne désactivée sautée');
  });

  /* ---------- Sauvegardes et affichage ---------- */
  test('Affichage des sauvegardes', () => {
    eq(formatBytes(2048), '2 Ko', 'Taille en Ko');
    assert(formatBytes(1572864).includes('Mo'), 'Taille en Mo');
    assert(backupDateLabel({ createdAt: '2026-11-09T10:00:00' }).includes('09/11/2026'), 'Date lisible');
    eq(backupDateLabel({}), 'Date inconnue', 'Date absente');
    eq(BACKUP_REASON_LABELS.import, 'Avant import', 'Libellé d’import');
  });

  /* ---------- Fiabilité : sauvegardes et notifications ---------- */
  test('Sauvegarde externe : noms et planification', () => {
    eq(autoBackup.DEFAULT_CONFIG.frequency, 'daily', 'Fréquence par défaut');
    eq(autoBackup.DEFAULT_CONFIG.keepLast, 30, 'Historique par défaut');
    eq(autoBackup.sanitizePrefix('Suivi 2026/01'), 'Suivi_2026-01', 'Préfixe nettoyé');
    eq(autoBackup.sanitizePrefix(''), autoBackup.DEFAULT_CONFIG.prefix, 'Préfixe par défaut');
    eq(autoBackup.buildFilename('test', new Date(2026, 0, 5, 7, 8, 9)), 'test_2026-01-05_07h08m09.json', 'Nom horodaté');
    eq(autoBackup.reasonLabel('scheduled'), 'Planifiée', 'Libellé planifié');
    eq(autoBackup.reasonLabel('auto-change'), 'Après modification', 'Libellé modification');
    const daily = autoBackup.nextRunAt({ frequency: 'daily', time: '19:00' }, new Date(2026, 5, 15, 10, 0));
    eq(daily.getDate(), 15, 'Prochaine sauvegarde le jour même');
    eq(daily.getHours(), 19, 'Heure de sauvegarde');
    const tomorrow = autoBackup.nextRunAt({ frequency: 'daily', time: '19:00' }, new Date(2026, 5, 15, 20, 0));
    eq(tomorrow.getDate(), 16, 'Sauvegarde reportée au lendemain');
    const weekly = autoBackup.nextRunAt({ frequency: 'weekly', time: '08:30', dayOfWeek: 1 }, new Date(2026, 5, 17, 12, 0));
    eq(weekly.getDate(), 22, 'Lundi suivant');
    eq(weekly.getHours(), 8, 'Heure hebdomadaire');
    eq(weekly.getMinutes(), 30, 'Minutes hebdomadaires');
    eq(autoBackup.nextRunAt({ frequency: 'on-change' }, new Date(2026, 5, 15, 10, 0)), null, 'Aucune heure fixe');
  });

  test('Rétention des sauvegardes en jours', () => {
    eq(autoBackup.DEFAULT_CONFIG.retentionDays, 7, 'Sept jours par défaut');
    const now = new Date(2026, 5, 15, 12, 0, 0);
    eq(autoBackup.isOldBackup('sauvegarde_cotisations_2026-06-01_19h00m00.json', 'sauvegarde_cotisations', 7, now), true, 'Fichier de plus de 7 jours');
    eq(autoBackup.isOldBackup('sauvegarde_cotisations_2026-06-10_19h00m00.json', 'sauvegarde_cotisations', 7, now), false, 'Fichier récent conservé');
    eq(autoBackup.isOldBackup('autre_sauvegarde_2026-06-01_19h00m00.json', 'sauvegarde_cotisations', 7, now), false, 'Préfixe différent ignoré');
    eq(autoBackup.isOldBackup('sauvegarde_cotisations_2026-06-01_19h00m00.json', 'sauvegarde_cotisations', 0, now), false, 'Rétention désactivée');
    const stamp = autoBackup.backupTimestamp('sauvegarde_cotisations_2026-06-01_19h05m09.json');
    assert(stamp instanceof Date, 'Horodatage lu');
    eq(stamp.getFullYear(), 2026, 'Année lue');
    eq(stamp.getHours(), 19, 'Heure lue');
    eq(autoBackup.backupTimestamp('fichier-sans-date.json'), null, 'Nom non horodaté');
    eq(autoBackup.nextRunAt({ frequency: 'daily', time: '19:00' }, now).getDate(), 15, 'Planification inchangée');
  });

  test('Notifications : valeurs par défaut et heures de silence', () => {
    const defaults = notifier.DEFAULT_CONFIG;
    eq(defaults.enabled, false, 'Notifications désactivées par défaut');
    eq(defaults.scheduleDays, 7, 'Échéances à 7 jours');
    eq(defaults.categories.thresholds, true, 'Seuils actifs');
    eq(defaults.categories.backups, false, 'Sauvegardes silencieuses');
    const night = { start: '20:00', end: '07:00' };
    eq(notifier.inQuietRange(night, 23 * 60), true, '23 h silencieuse');
    eq(notifier.inQuietRange(night, 6 * 60 + 30), true, '6 h 30 silencieuse');
    eq(notifier.inQuietRange(night, 20 * 60), true, 'Début de plage inclus');
    eq(notifier.inQuietRange(night, 7 * 60), false, 'Fin de plage exclue');
    eq(notifier.inQuietRange(night, 12 * 60), false, 'Midi sans silence');
    eq(notifier.inQuietRange({ start: '08:00', end: '12:00' }, 10 * 60), true, 'Plage de journée');
    assert(['granted', 'denied', 'default', 'unsupported'].includes(notifier.permission()), 'État d’autorisation lisible');
  });

  /* ---------- Contrôles complémentaires ---------- */
  test('Statuts suggérés selon le solde et l’échéancier', () => {
    freshState();
    const emp = state.employers[0];
    state.monthly = { [emp.id]: { '2026-01': { dueGlobal: 100000, collected: 0 } } };
    const index = buildInsuredIndex();
    let stat = employerStats(emp, index, monthsList('2026'));
    eq(suggestedStatusFor(stat), 'À relancer', 'Impayé : à relancer');
    state.monthly[emp.id]['2026-01'].collected = 100000;
    stat = employerStats(emp, index, monthsList('2026'));
    eq(suggestedStatusFor(stat), 'Soldé', 'Entièrement payé : soldé');
    state.schedules = [{ id: 's1', employerId: emp.id, amount: 50000, paidAmount: 0, dueDate: '2026-07-01' }];
    eq(suggestedStatusFor(stat), 'Échéancier en cours', 'Échéance non payée prioritaire');
    const emptyStat = employerStats(state.employers[1], index, monthsList('2026'));
    eq(suggestedStatusFor(emptyStat), '', 'Dossier sans mouvement : aucun statut');
  });

  test('Situation mensuelle d’un employeur', () => {
    eq(situationFor({ dueRetained: 0, collected: 0 }).key, 'ND', 'Rien de déclaré');
    eq(situationFor({ dueRetained: 1000, collected: 1000 }).label, 'Déclaré et payé', 'Payé en totalité');
    eq(situationFor({ dueRetained: 1000, collected: 400 }).key, 'PP', 'Paiement partiel');
    eq(situationFor({ dueRetained: 1000, collected: 0 }).badge, 'badge-red', 'Déclaré non payé');
    const chip = situationBadge({ key: 'PP', label: 'Déclaré, partiellement payé', chip: 'PP' }, true);
    assert(chip.includes('chip-pp'), 'Pastille de paiement partiel');
    assert(chip.includes('title="Déclaré, partiellement payé"'), 'Infobulle conservée');
  });

  test('Échéancier : reste dû, paiement et retard', () => {
    freshState();
    const late = scheduleStats({ amount: 100000, paidAmount: 40000, dueDate: '2026-06-01' });
    eq(late.remaining, 60000, 'Reste dû');
    eq(late.status, 'En retard', 'Échéance dépassée');
    eq(late.lateDays, 14, 'Jours de retard');
    const paid = scheduleStats({ amount: 100000, paidAmount: 100000, dueDate: '2026-01-01' });
    eq(paid.status, 'Payée', 'Échéance soldée');
    eq(paid.lateDays, 0, 'Aucun retard sur une échéance payée');
    const upcoming = scheduleStats({ amount: 50000, paidAmount: 0, dueDate: '2026-07-01' });
    eq(upcoming.status, 'À venir', 'Échéance future');
    eq(lateScheduleEmployerIds().size, 0, 'Aucun employeur en retard');
    state.schedules = [{ id: 's1', employerId: 'a', amount: 1000, paidAmount: 0, dueDate: '2026-05-01' }];
    eq(lateScheduleEmployerIds().has('a'), true, 'Employeur en retard détecté');
  });

  test('Normalisation des raisons sociales', () => {
    eq(normalizeEmployerName('ASSEMBLEE NATIONALE'), 'Assemblée Nationale', 'Majuscules converties');
    eq(normalizeEmployerName('CROIX ROUGE TOGO'), 'Croix-Rouge Togo', 'Cas particulier conservé');
    eq(normalizeEmployerName('SOS-VILLAGES ENFANTS'), "SOS Villages d'Enfants", 'Sigle conservé');
    eq(normalizeEmployerName('INSTITUT NATIONAL DES ASSURANCES MALADIES'), 'Institut National des Assurances Maladies', 'Connecteurs en minuscules');
    eq(normalizeEmployerName('GFA TOGO'), 'GFA Togo', 'Sigle de trois lettres conservé');
    eq(normalizeEmployerName('SANTE TOGO 2'), 'Santé Togo 2', 'Accent rétabli, référence conservée');
    eq(normalizeEmployerName('SOTRAL'), 'SOTRAL', 'Nom d’un seul mot inchangé');
    eq(normalizeEmployerName('Employeur'), 'Employeur', 'Nom déjà normalisé');
  });

  test('Empreinte d’intégrité et export CSV', () => {
    const sig = stateSignature('{"employeurs":[]}');
    eq(sig, stateSignature('{"employeurs":[]}'), 'Empreinte stable');
    assert(sig.endsWith(':17'), 'Longueur incluse dans l’empreinte');
    assert(sig !== stateSignature('{"employeurs":[1]}'), 'Empreinte différente après modification');
    eq(csvValue('Cabinet; Conseil'), '"Cabinet; Conseil"', 'Séparateur protégé');
    eq(csvValue('Le "Comptable"'), '"Le ""Comptable"""', 'Guillemets doublés');
    eq(csvValue(null), '""', 'Valeur absente');
    eq(csvValue(12000), '"12000"', 'Montant converti');
  });

  test('Saisie des montants : séparateurs de milliers', () => {
    eq(formatAmountInput(''), '', 'Valeur vide');
    eq(formatAmountInput(0), '0', 'Zéro');
    eq(formatAmountInput(950), '950', 'Moins de mille');
    eq(formatAmountInput(1000), '1\u202f000', 'Mille');
    eq(formatAmountInput('1234567'), '1\u202f234\u202f567', 'Millions');
    eq(formatAmountInput('1 234 567'), '1\u202f234\u202f567', 'Espaces existants normalisés');
    eq(formatAmountInput('0001234'), '1\u202f234', 'Zéros de tête retirés');
    eq(formatAmountInput('1 000 000,50'), '1\u202f000\u202f000', 'Partie décimale ignorée');
    eq(num(formatAmountInput(2500000)), 2500000, 'Montant relu sans séparateur');
  });

  test('Accès protégé : vérification des identifiants', () => {
    eq(verifyCredentials('AKPANDZA', 'mauvais'), false, 'Mot de passe erroné refusé');
    eq(verifyCredentials('INCONNU', 'motdepasse'), false, 'Identifiant erroné refusé');
    eq(verifyCredentials('', ''), false, 'Champs vides refusés');
    eq(authFingerprint(' akpandza ', 'x'), authFingerprint('AKPANDZA', 'x'), 'Identifiant sans casse ni espaces');
    assert(authFingerprint('AKPANDZA', 'X') !== authFingerprint('AKPANDZA', 'x'), 'Mot de passe sensible à la casse');
  });

  window.__TEST_RESULTS__ = results;

  function render() {
    const root = document.getElementById('test-results');
    const summary = document.getElementById('test-summary');
    if (!root || !summary) return;
    const failed = results.length - passed;
    summary.textContent = failed === 0
      ? `${passed} tests réussis`
      : `${passed} réussis · ${failed} échoué${failed > 1 ? 's' : ''}`;
    summary.className = 'summary ' + (failed ? 'bad' : 'good');
    root.innerHTML = '';
    results.forEach(result => {
      const li = document.createElement('li');
      li.className = result.ok ? 'ok' : 'ko';
      const status = document.createElement('strong');
      status.textContent = result.ok ? 'OK' : 'ÉCHEC';
      const name = document.createElement('span');
      name.textContent = result.name;
      li.append(status, name);
      if (!result.ok) {
        const detail = document.createElement('p');
        detail.textContent = result.message;
        li.append(detail);
      }
      root.append(li);
    });
    document.title = failed ? `Tests — ${failed} échec(s)` : `Tests — ${passed} réussis`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
