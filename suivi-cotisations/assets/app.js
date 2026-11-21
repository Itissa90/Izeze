/* ============================================================
   Application : navigation, formulaires, événements, exports
   ============================================================ */

const ROUTES = ['dashboard', 'employers', 'monthly', 'situation', 'insured', 'journal', 'schedules', 'settings'];

function parseRoute() {
  const value = String(location.hash || '').replace(/^#\/?/, '').replace(/\/$/, '');
  return ROUTES.includes(value) ? value : 'dashboard';
}

function navigate(route) {
  const target = ROUTES.includes(route) ? route : 'dashboard';
  if (location.hash === '#/' + target) renderCurrentView();
  else location.hash = '#/' + target;
}

function renderCurrentView(options = {}) {
  const active = document.activeElement;
  const focusId = active && active.id ? active.id : null;
  const selectionStart = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;

  ui.route = parseRoute();
  const meta = pageMeta(ui.route);
  const titleEl = $('#page-title');
  const subtitleEl = $('#page-subtitle');
  if (titleEl) titleEl.textContent = meta[0];
  if (subtitleEl) subtitleEl.textContent = meta[1];

  $$('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.route === ui.route));

  const views = {
    dashboard: viewDashboard,
    employers: viewEmployers,
    monthly: viewMonthly,
    situation: viewSituation,
    insured: viewInsured,
    journal: viewJournal,
    schedules: viewSchedules,
    settings: viewSettings
  };
  const view = $('#view');
  view.innerHTML = views[ui.route]();
  view.classList.remove('view-enter');
  void view.offsetWidth;
  view.classList.add('view-enter');
  updateTopbar();
  updateStorageStatus();
  if (window.bulkMail) window.bulkMail.syncToolbar();

  if (options.keepFocus && focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus();
      if (selectionStart != null && typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(selectionStart, selectionStart); } catch (e) { /* type non compatible */ }
      }
    }
  }
}

function updateTopbar() {
  const label = $('#today-label');
  if (label && state) label.textContent = fmtDate(effectiveToday());
  const chip = $('#today-chip');
  if (chip && state) chip.title = 'Date de référence des calculs : ' + fmtDateLong(effectiveToday()) + '. Cliquez pour la modifier.';
  const yearSelect = $('#year-select');
  if (yearSelect && state) {
    const current = normalizeYear(ui.year);
    const years = availableYears();
    if (!years.includes(current)) {
      years.push(current);
      years.sort((a, b) => Number(a) - Number(b));
    }
    yearSelect.innerHTML = years.map(y => `<option value="${y}"${y === current ? ' selected' : ''}>Année ${y}</option>`).join('');
  }
}

const SIDEBAR_STORAGE_KEY = 'suivi-cotisations-sidebar-v1';

function desktopLayout() {
  return window.matchMedia('(min-width: 981px)').matches;
}

function sidebarCollapsed() {
  return document.documentElement.dataset.sidebar === 'collapsed';
}

function syncSidebarUi() {
  const desktop = desktopLayout();
  if (desktop) {
    $('#sidebar').classList.remove('open');
    $('#sidebar-backdrop').classList.remove('show');
  }
  const collapsed = desktop && sidebarCollapsed();
  const drawerOpen = !desktop && $('#sidebar').classList.contains('open');
  const expanded = desktop ? !collapsed : drawerOpen;
  const btn = $('#menu-btn');
  if (btn) {
    const label = desktop
      ? (collapsed ? 'Déployer le menu latéral' : 'Réduire le menu latéral')
      : (drawerOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
  $$('.nav-link').forEach(link => {
    const text = link.querySelector('span');
    if (!text) return;
    const label = text.textContent.trim();
    if (!link.getAttribute('aria-label')) link.setAttribute('aria-label', label);
    if (collapsed) link.title = label;
    else link.removeAttribute('title');
  });
}

function setSidebarCollapsed(collapsed) {
  if (collapsed) document.documentElement.dataset.sidebar = 'collapsed';
  else delete document.documentElement.dataset.sidebar;
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch (e) { /* stockage indisponible */ }
  syncSidebarUi();
}

function openSidebar() {
  $('#sidebar').classList.add('open');
  $('#sidebar-backdrop').classList.add('show');
  syncSidebarUi();
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#sidebar-backdrop').classList.remove('show');
  syncSidebarUi();
}

/* ---------------- Fiche employeur ---------------- */
function openEmployerFiche(employerId) {
  const emp = getEmployer(employerId);
  if (!emp) return;
  const origin = pageMeta(ui.route)[0];
  const contact = parseContact(emp.contact);
  const firstPhone = contact.phones[0];
  const firstEmail = contact.emails[0];
  openModal({
    title: 'Fiche employeur',
    subtitle: 'Synthèse du dossier, mouvements et actions de recouvrement',
    size: 'modal-lg',
    body: employerFicheHtml(employerId, origin),
    footer: `
      <button class="btn" type="button" data-close-modal>Fermer</button>
      ${firstPhone ? `<a class="btn" href="${escapeAttr(contactPhoneHref(firstPhone))}" title="Appeler ${escapeAttr(contactPhoneLabel(firstPhone))}">${ico('phone')} Appeler</a>` : ''}
      ${firstEmail ? `<a class="btn" href="${escapeAttr('mailto:' + encodeURI(firstEmail))}" title="Écrire à ${escapeAttr(firstEmail)}">${ico('mail')} E-mail</a>` : ''}
      <button class="btn" type="button" id="fiche-letter">${ico('mail')} Courrier</button>
      <button class="btn" type="button" id="fiche-print">${ico('printer')} Imprimer / PDF</button>
      <button class="btn" type="button" id="fiche-edit">${ico('edit')} Modifier</button>
      <button class="btn btn-primary" type="button" id="fiche-monthly">${ico('calendar')} Voir le suivi mensuel</button>`,
    onMount(modal, close) {
      modal.querySelector('#fiche-print').addEventListener('click', printFiche);
      modal.querySelector('#fiche-letter').addEventListener('click', () => {
        close();
        openEmployerLetter(employerId);
      });
      modal.querySelector('#fiche-edit').addEventListener('click', () => {
        close();
        openEmployerForm(employerId);
      });
      const applyStatus = modal.querySelector('#fiche-apply-status');
      if (applyStatus) {
        applyStatus.addEventListener('click', () => {
          const next = suggestedStatus(employerId);
          if (!next) return;
          emp.status = next;
          saveState();
          close();
          openEmployerFiche(employerId);
          renderCurrentView();
          toast('Statut mis à jour : ' + next + '.');
        });
      }
      modal.querySelector('#fiche-monthly').addEventListener('click', () => {
        const { stats } = buildStats();
        const s = stats.find(x => x.emp.id === employerId);
        const months = monthsList();
        const activeMonths = s ? months.filter(m => s.months[m].dueRetained > 0 || s.months[m].collected > 0 || s.months[m].hasDetail) : [];
        ui.monthlyMode = 'entry';
        ui.monthlyMonth = activeMonths.length ? activeMonths[activeMonths.length - 1] : (months.includes(currentMonthKey()) ? currentMonthKey() : months[0]);
        ui.monthlySearch = emp.registration;
        close();
        navigate('monthly');
      });
    }
  });
}

/* ---------------- Courriers de recouvrement ---------------- */
function buildEmployerLetterHtml(s, year, type) {
  const amount = Math.max(0, s.totalBalance);
  const issueDate = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const period = s.startMonth ? `${monthLong(s.startMonth)} à ${monthLong(s.endMonth || s.startMonth)}` : `l’année ${year}`;
  const describePart = (value, label) => value < 0
    ? `crédit de <strong>${fmtMoney(Math.abs(value))}</strong> ${label}`
    : `<strong>${fmtMoney(value)}</strong> ${label}`;
  const detailParts = [];
  if (s.balance !== 0) detailParts.push(describePart(s.balance, `au titre de l’année ${escapeHtml(year)}`));
  if (s.priorBalance !== 0) detailParts.push(describePart(s.priorBalance, 'au titre des exercices antérieurs'));
  const detail = s.priorBalance !== 0 && detailParts.length
    ? `<p class="letter-detail">Détail du solde : ${detailParts.join(' ; ')}.</p>`
    : '';
  const body = type === 'mise'
    ? `<p>En conséquence, nous vous mettons en demeure de régler la somme de <strong>${fmtMoney(amount)}</strong> dans un délai de huit (8) jours à compter de la réception de la présente.</p>
       <p>À défaut de règlement dans ce délai, nous serons contraints d’engager les poursuites prévues par la réglementation en vigueur, sans préjudice des majorations et frais éventuels.</p>`
    : type === 'rappel'
      ? `<p>Sauf erreur de notre part, ce solde reste à ce jour impayé. Nous vous invitons à vérifier vos règlements et, si nécessaire, à procéder à la régularisation dans un délai de trente (30) jours à compter de la réception de la présente.</p>
       <p>Si le paiement a déjà été effectué, veuillez ne pas tenir compte de ce rappel et nous communiquer la référence du règlement.</p>`
      : `<p>Nous vous invitons à régulariser cette situation dans un délai de quinze (15) jours à compter de la réception de la présente, en procédant au règlement des sommes dues ou en prenant contact avec notre service pour convenir d’un échéancier.</p>
       <p>À défaut, le dossier pourra faire l’objet d’une mise en demeure.</p>`;

  return `
    <div class="letter-head">
      <div>
        <div class="lh-org">Service du recouvrement</div>
        <div class="lh-sub">Cotisations sociales</div>
      </div>
      <div class="lh-date">${escapeHtml(issueDate)}</div>
    </div>
    <div class="letter-recipient">
      <div>À l’attention de la Direction</div>
      <strong>${escapeHtml(s.emp.name)}</strong>
      <div>N° d’immatriculation : ${escapeHtml(s.emp.registration)}</div>
      ${s.emp.contact ? `<div>Contact : ${escapeHtml(s.emp.contact)}</div>` : ''}
    </div>
    <p class="letter-object"><strong>Objet : ${type === 'mise' ? 'Mise en demeure' : type === 'rappel' ? 'Rappel' : 'Relance amiable'} — cotisations sociales impayées</strong></p>
    <p>Madame, Monsieur,</p>
    <p>Nos relevés font apparaître, pour l’employeur <strong>${escapeHtml(s.emp.name)}</strong> (n° ${escapeHtml(s.emp.registration)}), un solde de cotisations sociales impayé de <strong>${fmtMoney(amount)}</strong> arrêté au ${escapeHtml(issueDate)}, au titre de la période ${escapeHtml(period)}.</p>
    ${detail}
    ${body}
    <p>Nous restons à votre disposition pour tout renseignement complémentaire.</p>
    <p>Veuillez agréer, Madame, Monsieur, l’expression de nos salutations distinguées.</p>
    <div class="letter-sign">
      <div>Le Service du recouvrement</div>
      <div class="letter-sign-space"></div>
      <div>Signature et cachet</div>
    </div>`;
}

function copyLetterText() {
  const paper = $('#letter-paper');
  if (!paper) return;
  const text = paper.innerText;
  const done = () => toast('Texte du courrier copié.');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copie impossible dans ce navigateur.'); }
      area.remove();
    });
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('Copie impossible dans ce navigateur.'); }
  area.remove();
}

function openEmployerLetter(employerId) {
  const { stats, year } = buildStats();
  const s = stats.find(x => x.emp.id === employerId);
  if (!s) return;
  if (s.totalBalance <= 0) {
    toast('Aucun solde impayé : aucun courrier à générer.');
    return;
  }
  let letterType = 'relance';
  openModal({
    title: 'Courrier de recouvrement',
    subtitle: 'Texte modifiable avant impression',
    size: 'modal-lg',
    body: `
      <div class="letter-controls">
        <label for="letter-type">Type de courrier</label>
        <select class="select" id="letter-type">
          <option value="rappel">Rappel simple</option>
          <option value="relance" selected>Relance amiable</option>
          <option value="mise">Mise en demeure</option>
        </select>
        <span class="letter-hint">Le texte ci-dessous est librement modifiable.</span>
      </div>
      <div class="letter-paper" id="letter-paper" contenteditable="true" spellcheck="false">${buildEmployerLetterHtml(s, year, letterType)}</div>`,
    footer: `
      <button class="btn" type="button" data-close-modal>Fermer</button>
      <button class="btn" type="button" id="letter-copy">Copier le texte</button>
      <button class="btn btn-primary" type="button" id="letter-print">${ico('printer')} Imprimer / PDF</button>`,
    onMount(modal) {
      const select = modal.querySelector('#letter-type');
      select.addEventListener('change', () => {
        letterType = select.value;
        modal.querySelector('#letter-paper').innerHTML = buildEmployerLetterHtml(s, year, letterType);
      });
      modal.querySelector('#letter-copy').addEventListener('click', copyLetterText);
      modal.querySelector('#letter-print').addEventListener('click', () => runPrint('print-letter'));
    }
  });
}

/* ---------------- Formulaire employeur ---------------- */
function openEmployerForm(employerId) {
  const emp = employerId ? getEmployer(employerId) : null;
  if (employerId && !emp) return;
  const isEdit = !!emp;
  const data = emp || {
    registration: '', name: '', sigle: '', contact: '', effectif: 0, status: 'À relancer'
  };
  const suggestion = emp ? suggestedStatus(emp.id) : '';
  const showSuggestion = !!suggestion && suggestion !== data.status;
  const body = `
    <form id="employer-form" autocomplete="off">
      <div class="form-grid">
        <div class="form-field">
          <label for="f-registration">N° d'immatriculation <span class="req">*</span></label>
          <input class="input" id="f-registration" type="text" value="${escapeAttr(data.registration)}" placeholder="Ex. 1201503250" required>
        </div>
        <div class="form-field">
          <label for="f-status">Statut du dossier</label>
          <select class="select" id="f-status">${optionsFrom(STATUSES, data.status)}</select>
          ${showSuggestion ? `<span class="help status-suggest">Statut suggéré : <strong>${escapeHtml(suggestion)}</strong> <button class="link-btn" type="button" id="f-apply-status">Appliquer</button></span>` : ''}
        </div>
        <div class="form-field full">
          <label for="f-name">Raison sociale <span class="req">*</span></label>
          <input class="input" id="f-name" type="text" value="${escapeAttr(data.name)}" placeholder="Nom complet de l'employeur" required>
        </div>
        <div class="form-field">
          <label for="f-sigle">Sigle</label>
          <input class="input" id="f-sigle" type="text" value="${escapeAttr(data.sigle)}" placeholder="Ex. ANADEB">
        </div>
        <div class="form-field">
          <label for="f-effectif">Effectif déclaré</label>
          <input class="input" id="f-effectif" type="number" min="0" step="1" value="${num(data.effectif)}">
        </div>
        <div class="form-field full">
          <label for="f-contact">Contact</label>
          <input class="input" id="f-contact" type="text" value="${escapeAttr(data.contact)}" placeholder="Téléphone / email">
        </div>
      </div>
    </form>`;
  openModal({
    title: isEdit ? 'Modifier l’employeur' : 'Ajouter un employeur',
    subtitle: isEdit ? data.registration : 'Un employeur par ligne dans le registre',
    body,
    footer: `
      <button class="btn" type="button" data-close-modal>Annuler</button>
      <button class="btn btn-primary" type="submit" form="employer-form">${ico('check')} Enregistrer</button>`,
    onMount(modal, close) {
      const form = modal.querySelector('#employer-form');
      const applyStatusBtn = form.querySelector('#f-apply-status');
      if (applyStatusBtn) {
        applyStatusBtn.addEventListener('click', () => {
          form.querySelector('#f-status').value = suggestion;
          applyStatusBtn.remove();
        });
      }
      form.addEventListener('submit', e => {
        e.preventDefault();
        const registration = form.querySelector('#f-registration').value.trim();
        const name = form.querySelector('#f-name').value.trim();
        const sigle = form.querySelector('#f-sigle').value.trim();
        const contact = form.querySelector('#f-contact').value.trim();
        const effectif = Math.max(0, round0(form.querySelector('#f-effectif').value));
        const status = form.querySelector('#f-status').value;

        if (!registration) {
          toast('Le n° d’immatriculation est obligatoire.', 'error');
          form.querySelector('#f-registration').focus();
          return;
        }
        if (!name) {
          toast('La raison sociale est obligatoire.', 'error');
          form.querySelector('#f-name').focus();
          return;
        }
        if (state.employers.some(x => x.id !== (emp ? emp.id : '') && x.registration === registration)) {
          toast('Ce n° d’immatriculation existe déjà dans le registre.', 'error');
          form.querySelector('#f-registration').focus();
          return;
        }

        const payload = { registration, name, sigle, contact, effectif, status };
        if (emp) {
          Object.assign(emp, payload);
        } else {
          state.employers.push(Object.assign({ id: uid('emp') }, payload));
        }
        saveState();
        close();
        renderCurrentView();
        toast(emp ? 'Employeur modifié.' : 'Employeur ajouté au registre.');
      });
    }
  });
}

/* ---------------- Qualité des données ---------------- */
function hasEmailAddress(contact) {
  return parseContact(contact).emails.length > 0;
}

function isAllUpperName(emp) {
  return /[A-ZÀ-Ý]/.test(emp.name) && emp.name === emp.name.toUpperCase();
}

function dataQualityItems(kind) {
  const employers = state.employers.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (kind === 'no-contact') {
    return employers.filter(e => !String(e.contact || '').trim())
      .map(emp => ({ emp, detail: 'Aucun contact enregistré' }));
  }
  if (kind === 'no-email') {
    return employers.filter(e => String(e.contact || '').trim() && !hasEmailAddress(e.contact))
      .map(emp => ({ emp, detail: emp.contact }));
  }
  if (kind === 'uppercase') {
    return employers.filter(isAllUpperName).map(emp => ({ emp, detail: emp.sigle || '', normalized: normalizeEmployerName(emp.name) }));
  }
  if (kind === 'suggested') {
    const stats = buildStats().stats;
    return stats
      .map(stat => ({ emp: stat.emp, detail: 'Statut actuel : ' + stat.emp.status, suggested: suggestedStatusFor(stat) }))
      .filter(x => x.suggested && x.suggested !== x.emp.status)
      .sort((a, b) => a.emp.name.localeCompare(b.emp.name, 'fr'));
  }
  return [];
}

function openDataQualityList(kind) {
  const titles = {
    'no-contact': 'Employeurs sans contact',
    'no-email': 'Contacts sans adresse e-mail',
    uppercase: 'Raisons sociales en majuscules',
    suggested: 'Statuts à vérifier'
  };
  const items = dataQualityItems(kind);
  const canNormalize = kind === 'uppercase' && items.some(x => x.normalized && x.normalized !== x.emp.name);
  const body = items.length ? `
    <div class="quality-modal-list" data-quality-kind="${escapeAttr(kind)}">
      ${items.map(item => `
        <div class="quality-modal-row">
          <div class="qm-main">
            <strong>${escapeHtml(item.emp.name)}</strong>
            <span>${escapeHtml(item.emp.registration)}${item.detail ? ' · ' + escapeHtml(item.detail) : ''}</span>
            ${item.normalized && item.normalized !== item.emp.name ? `<span class="qm-next">Proposé : ${escapeHtml(item.normalized)}</span>` : ''}
          </div>
          <div class="qm-actions">
            ${item.suggested ? `<button class="btn btn-sm" type="button" data-apply-status="${escapeAttr(item.emp.id)}" data-status="${escapeAttr(item.suggested)}">Appliquer « ${escapeHtml(item.suggested)} »</button>` : ''}
            <button class="btn btn-sm btn-ghost" type="button" data-edit-employer="${escapeAttr(item.emp.id)}">Modifier</button>
          </div>
        </div>`).join('')}
    </div>
    ${kind === 'no-contact' || kind === 'no-email' ? `<p class="quality-help">Ces informations ne peuvent pas être complétées automatiquement : ouvrez chaque dossier pour ajouter le contact manquant.</p>` : ''}
    ${kind === 'suggested' ? `<p class="quality-help">Le statut suggéré découle des échéanciers et du solde cumulé. « Appliquer » remplace le statut manuel du dossier.</p>` : ''}`
    : `<div class="empty-state"><div class="empty-ico">${ico('check')}</div><strong>Aucun point à signaler</strong><p>Ce contrôle ne relève rien sur le registre actuel.</p></div>`;

  openModal({
    title: titles[kind] || 'Qualité des données',
    subtitle: `${items.length} dossier${items.length > 1 ? 's' : ''} concerné${items.length > 1 ? 's' : ''}`,
    size: 'modal-lg',
    body,
    footer: `
      <button class="btn" type="button" data-close-modal>Fermer</button>
      ${canNormalize ? `<button class="btn btn-primary" type="button" id="normalize-names">${ico('edit')} Normaliser la casse</button>` : ''}`,
    onMount(modal, close) {
      const btn = modal.querySelector('#normalize-names');
      if (btn) {
        btn.addEventListener('click', () => {
          close();
          openNameNormalization();
        });
      }
    }
  });
}

function openNameNormalization() {
  const proposals = state.employers
    .map(emp => ({ emp, next: normalizeEmployerName(emp.name) }))
    .filter(p => p.next !== p.emp.name);
  if (!proposals.length) {
    toast('Aucun nom à normaliser.');
    return;
  }
  openModal({
    title: 'Normaliser la casse des noms',
    subtitle: `${proposals.length} raison${proposals.length > 1 ? 's' : ''} sociale${proposals.length > 1 ? 's' : ''} à modifier`,
    size: 'modal-lg',
    body: `
      <p class="quality-help">Les sigles de 4 lettres ou moins, les références contenant des chiffres et les noms à un seul mot restent inchangés. Vérifiez le résultat avant d’appliquer.</p>
      <div class="table-wrap" style="max-height:420px">
        <table class="mini-table quality-preview">
          <thead><tr><th>Nom actuel</th><th>Nom proposé</th></tr></thead>
          <tbody>
            ${proposals.map(p => `<tr><td>${escapeHtml(p.emp.name)}</td><td><strong>${escapeHtml(p.next)}</strong></td></tr>`).join('')}
          </tbody>
        </table>
      </div>`,
    footer: `
      <button class="btn" type="button" data-close-modal>Annuler</button>
      <button class="btn btn-primary" type="button" id="apply-name-normalization">Appliquer ${proposals.length} modification${proposals.length > 1 ? 's' : ''}</button>`,
    onMount(modal, close) {
      modal.querySelector('#apply-name-normalization').addEventListener('click', () => {
        proposals.forEach(p => { p.emp.name = p.next; });
        saveState();
        close();
        renderCurrentView();
        toast(proposals.length + ' nom' + (proposals.length > 1 ? 's' : '') + ' normalisé' + (proposals.length > 1 ? 's' : '') + '.');
      });
    }
  });
}

function deleteEmployer(employerId) {
  const emp = getEmployer(employerId);
  if (!emp) return;
  const insuredCount = state.insured.filter(r => r.employerId === employerId).length;
  const journalCount = state.journal.filter(r => r.employerId === employerId).length;
  const scheduleCount = state.schedules.filter(r => r.employerId === employerId).length;
  const monthlyCount = state.monthly[employerId] ? Object.keys(state.monthly[employerId]).length : 0;
  const details = [
    monthlyCount ? `${monthlyCount} mois de suivi` : '',
    insuredCount ? `${insuredCount} ligne(s) d’assurés` : '',
    journalCount ? `${journalCount} action(s) au journal` : '',
    scheduleCount ? `${scheduleCount} échéance(s)` : ''
  ].filter(Boolean).join(', ');
  confirmAction({
    title: 'Supprimer cet employeur ?',
    message: `<strong>${escapeHtml(emp.name)}</strong> (${escapeHtml(emp.registration)}) sera supprimé définitivement.${details ? '<br><br>Seront également supprimés : ' + details + '.' : ''}`,
    confirmLabel: 'Supprimer',
    danger: true,
    onConfirm() {
      state.employers = state.employers.filter(e => e.id !== employerId);
      delete state.monthly[employerId];
      state.insured = state.insured.filter(r => r.employerId !== employerId);
      state.journal = state.journal.filter(r => r.employerId !== employerId);
      state.schedules = state.schedules.filter(r => r.employerId !== employerId);
      saveState();
      renderCurrentView();
      toast('Employeur supprimé.');
    }
  });
}

/* ---------------- Détail assurés ---------------- */
function openInsuredForm(insuredId, presetEmployerId, presetMonth) {
  if (!state.employers.length) {
    toast('Ajoutez d’abord un employeur dans le registre.', 'error');
    return;
  }
  const row = insuredId ? state.insured.find(r => r.id === insuredId) : null;
  if (insuredId && !row) return;
  let months = monthsList();
  if (row && !months.includes(row.month)) months = months.concat(row.month).sort();
  const defaultMonth = row ? row.month : (presetMonth || ui.insuredMonth || (months.includes(currentMonthKey()) ? currentMonthKey() : months[0]));
  const defaultEmployer = row ? row.employerId : (presetEmployerId || ui.insuredEmployer || state.employers[0].id);
  const isEdit = !!row;

  const body = `
    <form id="insured-form" autocomplete="off">
      <div class="form-grid">
        <div class="form-field full">
          <label for="f-ins-employer">Employeur <span class="req">*</span></label>
          <select class="select" id="f-ins-employer">${employerSelectOptions(defaultEmployer, 'Choisir un employeur')}</select>
        </div>
        <div class="form-field">
          <label for="f-ins-month">Mois <span class="req">*</span></label>
          <select class="select" id="f-ins-month">${monthSelectOptions(defaultMonth, '', months)}</select>
        </div>
        <div class="form-field">
          <label for="f-ins-matricule">N° assuré / matricule</label>
          <input class="input" id="f-ins-matricule" type="text" value="${escapeAttr(row ? row.matricule : '')}" placeholder="Ex. 054821">
        </div>
        <div class="form-field full">
          <label for="f-ins-name">Nom et prénoms <span class="req">*</span></label>
          <input class="input" id="f-ins-name" type="text" value="${escapeAttr(row ? row.name : '')}" placeholder="Nom complet de l'assuré" required>
        </div>
        <div class="form-field">
          <label for="f-ins-indice">Indice</label>
          <input class="input" id="f-ins-indice" type="number" min="0" step="1" value="${row ? row.indice : ''}" placeholder="Ex. 500">
          <span class="help">Salaire = indice × ${fmtDecimal(state.settings.valeurIndiciaire)} ÷ 12 (valeur exacte, sans arrondi).</span>
        </div>
        <div class="form-field">
          <label>Cotisation totale calculée</label>
          <div class="input-suffix">
            <input class="input" type="text" id="calc-total" value="0" disabled>
            <span>FCFA</span>
          </div>
        </div>
      </div>
      <div class="calc-preview" id="calc-preview" style="margin-top:16px">
        <div><span>Salaire mensuel</span><strong id="calc-salary">0</strong></div>
        <div><span>Part employé (${fmtPct(state.settings.rateEmployee)})</span><strong id="calc-employee">0</strong></div>
        <div><span>Part employeur (${fmtPct(state.settings.rateEmployer)})</span><strong id="calc-employer">0</strong></div>
        <div><span>Cotisations totales</span><strong id="calc-total-2">0</strong></div>
      </div>
    </form>`;

  openModal({
    title: isEdit ? 'Modifier un assuré' : 'Ajouter un assuré',
    subtitle: 'Le détail est facultatif : il remplace le dû global du mois pour cet employeur.',
    size: 'modal-lg',
    body,
    footer: `
      <button class="btn" type="button" data-close-modal>Annuler</button>
      ${isEdit ? '' : `<button class="btn" type="button" id="save-insured-new">${ico('plus')} Enregistrer et ajouter</button>`}
      <button class="btn btn-primary" type="submit" form="insured-form">${ico('check')} Enregistrer</button>`,
    onMount(modal, close) {
      const form = modal.querySelector('#insured-form');
      const indiceInput = form.querySelector('#f-ins-indice');
      const updatePreview = () => {
        const calc = computeInsuredRow({ indice: indiceInput.value });
        form.querySelector('#calc-salary').textContent = fmtMoney(calc.salary);
        form.querySelector('#calc-employee').textContent = fmtMoney(calc.employee);
        form.querySelector('#calc-employer').textContent = fmtMoney(calc.employer);
        form.querySelector('#calc-total-2').textContent = fmtMoney(calc.total);
        form.querySelector('#calc-total').value = fmtNum(calc.total);
      };
      indiceInput.addEventListener('input', updatePreview);
      updatePreview();

      const save = (keepOpen) => {
        const employerId = form.querySelector('#f-ins-employer').value;
        const month = form.querySelector('#f-ins-month').value;
        const matricule = form.querySelector('#f-ins-matricule').value.trim();
        const name = form.querySelector('#f-ins-name').value.trim();
        const indice = Math.max(0, round0(indiceInput.value));
        if (!employerId) { toast('Choisissez un employeur.', 'error'); return; }
        if (!month) { toast('Choisissez un mois.', 'error'); return; }
        if (!name) {
          toast('Le nom de l’assuré est obligatoire.', 'error');
          form.querySelector('#f-ins-name').focus();
          return;
        }
        if (row) {
          Object.assign(row, { employerId, month, matricule, name, indice });
        } else {
          state.insured.push({
            id: uid('ass'), employerId, month, matricule, name, indice
          });
        }
        saveState();
        renderCurrentView();
        if (keepOpen) {
          close();
          openInsuredForm(null, employerId, month);
          toast('Assuré enregistré. Saisissez le suivant.');
        } else {
          close();
          toast(row ? 'Assuré modifié.' : 'Assuré ajouté. Le dû du mois est mis à jour.');
        }
      };

      form.addEventListener('submit', e => {
        e.preventDefault();
        save(false);
      });
      const saveNew = modal.querySelector('#save-insured-new');
      if (saveNew) saveNew.addEventListener('click', () => save(true));
    }
  });
}

function deleteInsured(insuredId) {
  const row = state.insured.find(r => r.id === insuredId);
  if (!row) return;
  confirmAction({
    title: 'Supprimer cet assuré ?',
    message: `<strong>${escapeHtml(row.name)}</strong> (${monthLong(row.month)}) sera retiré du détail. Si c’était le dernier assuré de ce mois pour cet employeur, le dû global saisi redeviendra la référence.`,
    confirmLabel: 'Supprimer',
    danger: true,
    onConfirm() {
      state.insured = state.insured.filter(r => r.id !== insuredId);
      saveState();
      renderCurrentView();
      toast('Ligne d’assuré supprimée.');
    }
  });
}

/* ---------------- Journal ---------------- */
function openJournalForm(journalId) {
  if (!state.employers.length) {
    toast('Ajoutez d’abord un employeur dans le registre.', 'error');
    return;
  }
  const row = journalId ? state.journal.find(j => j.id === journalId) : null;
  if (journalId && !row) return;
  const isEdit = !!row;
  const defaultEmployer = row ? row.employerId : (ui.journalEmployer || '');
  const now = effectiveToday();

  const body = `
    <form id="journal-form" autocomplete="off">
      <div class="form-grid">
        <div class="form-field full">
          <label for="f-journal-employer">Employeur <span class="req">*</span></label>
          <select class="select" id="f-journal-employer">${employerSelectOptions(defaultEmployer, 'Choisir un employeur')}</select>
        </div>
        <div class="form-field">
          <label for="f-journal-date">Date de l'action <span class="req">*</span></label>
          <input class="input" id="f-journal-date" type="date" value="${row ? row.date : now}" required>
        </div>
        <div class="form-field">
          <label for="f-journal-type">Type d'action</label>
          <select class="select" id="f-journal-type">${optionsFrom(ACTION_TYPES, row ? row.type : 'Appel')}</select>
        </div>
        <div class="form-field full">
          <label for="f-journal-contact">Interlocuteur contacté</label>
          <input class="input" id="f-journal-contact" type="text" value="${escapeAttr(row ? row.contact : '')}" placeholder="Nom, fonction">
        </div>
        <div class="form-field full">
          <label for="f-journal-result">Résultat / engagement pris</label>
          <textarea class="textarea" id="f-journal-result" placeholder="Ex. Promesse de paiement, document transmis…">${escapeHtml(row ? row.result : '')}</textarea>
        </div>
        <div class="form-field">
          <label for="f-journal-next">Prochaine action</label>
          <input class="input" id="f-journal-next" type="text" value="${escapeAttr(row ? row.nextAction : '')}" placeholder="Ex. Relancer par courrier">
        </div>
        <div class="form-field">
          <label for="f-journal-next-date">Date de la prochaine action</label>
          <input class="input" id="f-journal-next-date" type="date" value="${row ? row.nextDate : ''}">
          <span class="help">Déclenche l’alerte. À effacer une fois l’action réalisée.</span>
        </div>
        <div class="form-field full">
          <label for="f-journal-agent">Agent responsable</label>
          <input class="input" id="f-journal-agent" type="text" value="${escapeAttr(row ? row.agent : '')}" placeholder="Agent de recouvrement">
        </div>
      </div>
    </form>`;

  openModal({
    title: isEdit ? 'Modifier l’action' : 'Nouvelle action de recouvrement',
    subtitle: 'Appel, courrier, email, visite ou engagement',
    body,
    footer: `
      <button class="btn" type="button" data-close-modal>Annuler</button>
      <button class="btn btn-primary" type="submit" form="journal-form">${ico('check')} Enregistrer</button>`,
    onMount(modal, close) {
      const form = modal.querySelector('#journal-form');
      form.addEventListener('submit', e => {
        e.preventDefault();
        const employerId = form.querySelector('#f-journal-employer').value;
        const date = form.querySelector('#f-journal-date').value;
        const type = form.querySelector('#f-journal-type').value;
        const contact = form.querySelector('#f-journal-contact').value.trim();
        const result = form.querySelector('#f-journal-result').value.trim();
        const nextAction = form.querySelector('#f-journal-next').value.trim();
        const nextDate = form.querySelector('#f-journal-next-date').value;
        const agent = form.querySelector('#f-journal-agent').value.trim();

        if (!employerId) { toast('Choisissez un employeur.', 'error'); return; }
        if (!date) { toast('La date de l’action est obligatoire.', 'error'); return; }

        const payload = { employerId, date, type, contact, result, nextAction, nextDate, agent };
        if (row) {
          Object.assign(row, payload);
        } else {
          state.journal.push(Object.assign({ id: uid('act') }, payload));
        }
        saveState();
        close();
        renderCurrentView();
        toast(row ? 'Action modifiée.' : 'Action enregistrée dans le journal.');
      });
    }
  });
}

function deleteJournal(journalId) {
  const row = state.journal.find(j => j.id === journalId);
  if (!row) return;
  const emp = getEmployer(row.employerId);
  confirmAction({
    title: 'Supprimer cette action ?',
    message: `L’action du ${fmtDate(row.date)}${emp ? ' pour <strong>' + escapeHtml(emp.name) + '</strong>' : ''} sera supprimée du journal.`,
    confirmLabel: 'Supprimer',
    danger: true,
    onConfirm() {
      state.journal = state.journal.filter(j => j.id !== journalId);
      saveState();
      renderCurrentView();
      toast('Action supprimée.');
    }
  });
}

/* ---------------- Échéanciers ---------------- */
function openScheduleForm(scheduleId) {
  if (!state.employers.length) {
    toast('Ajoutez d’abord un employeur dans le registre.', 'error');
    return;
  }
  const row = scheduleId ? state.schedules.find(s => s.id === scheduleId) : null;
  if (scheduleId && !row) return;
  const isEdit = !!row;
  const defaultEmployer = row ? row.employerId : (ui.scheduleEmployer || '');
  const defaultDueDate = row ? row.dueDate : addDaysISO(effectiveToday(), 30);

  const body = `
    <form id="schedule-form" autocomplete="off">
      <div class="form-grid">
        <div class="form-field full">
          <label for="f-sch-employer">Employeur <span class="req">*</span></label>
          <select class="select" id="f-sch-employer">${employerSelectOptions(defaultEmployer, 'Choisir un employeur')}</select>
        </div>
        <div class="form-field">
          <label for="f-sch-number">N° d'échéance</label>
          <input class="input" id="f-sch-number" type="text" value="${escapeAttr(row ? row.number : '')}" placeholder="Ex. 1/3">
        </div>
        <div class="form-field">
          <label for="f-sch-due">Date prévue <span class="req">*</span></label>
          <input class="input" id="f-sch-due" type="date" value="${defaultDueDate}" required>
        </div>
        <div class="form-field">
          <label for="f-sch-amount">Montant prévu (FCFA) <span class="req">*</span></label>
          <input class="input" id="f-sch-amount" type="text" inputmode="numeric" autocomplete="off" data-amount value="${escapeAttr(formatAmountInput(row ? row.amount : ''))}" placeholder="0">
        </div>
        <div class="form-field">
          <label for="f-sch-paid-date">Date de paiement</label>
          <input class="input" id="f-sch-paid-date" type="date" value="${row ? row.paidDate : ''}">
        </div>
        <div class="form-field">
          <label for="f-sch-paid-amount">Montant payé (FCFA)</label>
          <input class="input" id="f-sch-paid-amount" type="text" inputmode="numeric" autocomplete="off" data-amount value="${escapeAttr(formatAmountInput(row ? row.paidAmount : ''))}" placeholder="0">
        </div>
      </div>
    </form>`;

  openModal({
    title: isEdit ? 'Modifier l’échéance' : 'Nouvelle échéance de paiement',
    subtitle: 'Une ligne par échéance négociée',
    body,
    footer: `
      <button class="btn" type="button" data-close-modal>Annuler</button>
      <button class="btn btn-primary" type="submit" form="schedule-form">${ico('check')} Enregistrer</button>`,
    onMount(modal, close) {
      const form = modal.querySelector('#schedule-form');
      form.addEventListener('submit', e => {
        e.preventDefault();
        const employerId = form.querySelector('#f-sch-employer').value;
        const number = form.querySelector('#f-sch-number').value.trim();
        const dueDate = form.querySelector('#f-sch-due').value;
        const amount = Math.max(0, round0(form.querySelector('#f-sch-amount').value));
        const paidDate = form.querySelector('#f-sch-paid-date').value;
        const paidAmount = Math.max(0, round0(form.querySelector('#f-sch-paid-amount').value));

        if (!employerId) { toast('Choisissez un employeur.', 'error'); return; }
        if (!dueDate) { toast('La date prévue est obligatoire.', 'error'); return; }
        if (amount <= 0) { toast('Le montant prévu doit être supérieur à 0.', 'error'); return; }

        const payload = { employerId, number, dueDate, amount, paidDate, paidAmount };
        if (row) {
          Object.assign(row, payload);
        } else {
          state.schedules.push(Object.assign({ id: uid('ech') }, payload));
        }
        saveState();
        close();
        renderCurrentView();
        toast(row ? 'Échéance modifiée.' : 'Échéance ajoutée.');
      });
    }
  });
}

function markSchedulePaid(scheduleId) {
  const row = state.schedules.find(s => s.id === scheduleId);
  if (!row) return;
  row.paidDate = effectiveToday();
  row.paidAmount = num(row.amount);
  saveState();
  renderCurrentView();
  toast('Échéance marquée comme payée.');
}

function deleteSchedule(scheduleId) {
  const row = state.schedules.find(s => s.id === scheduleId);
  if (!row) return;
  const emp = getEmployer(row.employerId);
  confirmAction({
    title: 'Supprimer cette échéance ?',
    message: `L’échéance ${row.number ? '<strong>' + escapeHtml(row.number) + '</strong> ' : ''}du ${fmtDate(row.dueDate)}${emp ? ' pour <strong>' + escapeHtml(emp.name) + '</strong>' : ''} sera supprimée.`,
    confirmLabel: 'Supprimer',
    danger: true,
    onConfirm() {
      state.schedules = state.schedules.filter(s => s.id !== scheduleId);
      saveState();
      renderCurrentView();
      toast('Échéance supprimée.');
    }
  });
}

/* ---------------- Saisie mensuelle ---------------- */
function handleMonthlyChange(input) {
  const employerId = input.dataset.monthlyEmp;
  const field = input.dataset.monthlyField;
  if (!employerId || (field !== 'dueGlobal' && field !== 'collected' && field !== 'effectif')) return;
  if (field === 'effectif') {
    const raw = String(input.value || '').trim();
    if (!raw) {
      const months = state.monthly[employerId];
      const key = normalizeMonth(ui.monthlyMonth);
      const existing = months && months[key];
      if (existing) {
        delete existing.effectif;
        if (!Number(existing.dueGlobal) && !Number(existing.collected)) {
          delete months[key];
          if (!Object.keys(months).length) delete state.monthly[employerId];
        }
      }
    } else {
      const entry = monthlyEntry(employerId, ui.monthlyMonth, true);
      entry.effectif = Math.max(0, round0(raw));
    }
    saveStateSoon();
    patchMonthlyView(employerId);
    return;
  }
  const value = Math.max(0, round0(input.value));
  const entry = monthlyEntry(employerId, ui.monthlyMonth, true);
  entry[field] = value;
  input.value = value ? formatAmountInput(value) : '';
  saveStateSoon();
  patchMonthlyView(employerId);
}

function monthlyGridCells() {
  const rows = Array.from(document.querySelectorAll('#monthly-tbody tr[data-monthly-row]'));
  return rows.map(tr => MONTHLY_FIELDS.map(field => tr.querySelector(`.cell-input[data-monthly-field="${field}"]`)));
}

function focusMonthlyMove(input, direction) {
  const rowEl = input.closest('tr[data-monthly-row]');
  const rows = Array.from(document.querySelectorAll('#monthly-tbody tr[data-monthly-row]'));
  const row = rows.indexOf(rowEl);
  const col = MONTHLY_FIELDS.indexOf(input.dataset.monthlyField);
  if (row < 0 || col < 0) return;
  const cells = monthlyGridCells();
  const target = monthlyMoveIndex(row, col, direction, rows.length, MONTHLY_FIELDS.length,
    (r, c) => !!(cells[r][c] && !cells[r][c].disabled));
  if (!target) return;
  const next = cells[target.row][target.col];
  next.focus();
  next.select();
  delete next.dataset.caretEdit;
}

function patchMonthlyView(employerId) {
  const month = ui.monthlyMonth;
  const { stats } = buildStats();
  const s = stats.find(x => x.emp.id === employerId);
  if (!s) return;
  const ms = s.months[month];
  const row = document.querySelector(`tr[data-monthly-row="${String(employerId).replace(/"/g, '\\"')}"]`);
  if (row) {
    const dueCell = row.querySelector('[data-cell="dueRetained"]');
    if (dueCell) dueCell.innerHTML = `<strong>${fmtNum(ms.dueRetained)}</strong>`;
    const balCell = row.querySelector('[data-cell="balance"]');
    if (balCell) {
      balCell.className = 'num ' + (ms.balance > 0 ? 'text-red' : ms.balance < 0 ? 'text-green' : 'muted');
      balCell.innerHTML = `<strong>${fmtNum(ms.balance)}</strong>`;
    }
    const effInput = row.querySelector('.cell-input[data-monthly-field="effectif"]');
    if (effInput) {
      effInput.value = String(ms.effectif);
      effInput.classList.toggle('inherited-effectif', ms.effectifInherited);
      effInput.title = ms.effectifInherited ? 'Effectif de référence — modifiez pour ce mois' : 'Effectif saisi pour ce mois';
    }
  }

  const totals = stats.reduce((acc, x) => {
    const m = x.months[month];
    acc.due += m.dueRetained;
    acc.collected += m.collected;
    acc.detail += m.detailTotal;
    acc.balance += m.balance;
    acc.effectif += m.effectif;
    return acc;
  }, { due: 0, collected: 0, detail: 0, balance: 0, effectif: 0 });

  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  setText('monthly-sum-effectif', fmtNum(totals.effectif));
  setText('monthly-total-effectif', fmtNum(totals.effectif));
  setText('monthly-sum-due', fmtNum(totals.due) + ' FCFA');
  setText('monthly-sum-collected', fmtNum(totals.collected) + ' FCFA');
  setText('monthly-sum-balance', fmtNum(totals.balance) + ' FCFA');
  setText('monthly-sum-detail', fmtNum(totals.detail) + ' FCFA');
  setText('monthly-total-collected', fmtNum(totals.collected));
  setText('monthly-total-detail', fmtNum(totals.detail));
  setText('monthly-total-due', fmtNum(totals.due));
  setText('monthly-total-balance', fmtNum(totals.balance));

  const balSummary = document.getElementById('monthly-sum-balance');
  if (balSummary) balSummary.className = totals.balance > 0 ? 'red' : 'green';
  const balTotal = document.getElementById('monthly-total-balance');
  if (balTotal) balTotal.className = 'num ' + (totals.balance > 0 ? 'text-red' : 'text-green');
}

/* ---------------- Paramètres ---------------- */
function handleSettingsSubmit(form) {
  const alertDays = Math.max(0, round0(form.querySelector('#set-alert-days').value));
  const auto = form.querySelector('#set-today-auto').checked;
  const todayValue = form.querySelector('#set-today').value;
  if (!auto && !dateParts(todayValue)) {
    toast('Choisissez une date de référence ou cochez « date du système ».', 'error');
    return;
  }
  const valeur = Math.max(0, num(form.querySelector('#set-valeur').value));
  const rateEmployee = Math.max(0, Math.min(100, num(form.querySelector('#set-rate-employee').value))) / 100;
  const rateEmployer = Math.max(0, Math.min(100, num(form.querySelector('#set-rate-employer').value))) / 100;

  state.settings = {
    alertDays,
    valeurIndiciaire: valeur,
    rateEmployee,
    rateEmployer,
    todayOverride: auto ? '' : todayValue
  };
  saveState();
  resetMonthSelections();
  renderCurrentView();
  toast('Paramètres enregistrés. Les calculs ont été mis à jour.');
}

function updateRatePreview() {
  const employee = num(($('#set-rate-employee') || {}).value) / 100;
  const employer = num(($('#set-rate-employer') || {}).value) / 100;
  const total = $('#set-rate-total');
  if (total) total.value = fmtPct(employee + employer);
}

function fillDefaultSettings() {
  const d = defaultSettings();
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
  set('set-alert-days', d.alertDays);
  set('set-valeur', fmtDecimal(d.valeurIndiciaire));
  set('set-rate-employee', (d.rateEmployee * 100).toFixed(2));
  set('set-rate-employer', (d.rateEmployer * 100).toFixed(2));
  const auto = document.getElementById('set-today-auto');
  if (auto) auto.checked = true;
  const today = document.getElementById('set-today');
  if (today) {
    today.disabled = true;
    today.value = todayISO();
  }
  updateRatePreview();
  toast('Valeurs du classeur chargées. Cliquez sur « Enregistrer les paramètres ».');
}

function resetAllData() {
  openModal({
    title: 'Réinitialiser l’application ?',
    subtitle: 'Cette action est irréversible',
    body: `
      <div class="notice danger">${ico('alert')}<div>
        Toutes les saisies seront effacées et remplacées par le registre initial des <strong>71 employeurs</strong>.
        Les années, les assurés, le journal et les échéanciers seront perdus.
      </div></div>
      <div class="form-field" style="margin-top:16px">
        <label for="reset-confirm-input">Saisissez <strong>EFFACER</strong> pour confirmer</label>
        <input class="input" id="reset-confirm-input" type="text" autocomplete="off" spellcheck="false" placeholder="EFFACER">
      </div>
      <label style="display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-size:12px;color:var(--ink-2);cursor:pointer">
        <input type="checkbox" id="reset-export" checked>
        Télécharger une sauvegarde JSON avant de réinitialiser
      </label>`,
    footer: `
      <button class="btn" type="button" data-close-modal>Annuler</button>
      <button class="btn btn-danger" type="button" id="reset-confirm" disabled>Tout réinitialiser</button>`,
    onMount(modal, close) {
      const input = modal.querySelector('#reset-confirm-input');
      const confirmBtn = modal.querySelector('#reset-confirm');
      const sync = () => { confirmBtn.disabled = input.value.trim().toUpperCase() !== 'EFFACER'; };
      input.addEventListener('input', sync);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !confirmBtn.disabled) confirmBtn.click();
      });
      confirmBtn.addEventListener('click', () => {
        if (input.value.trim().toUpperCase() !== 'EFFACER') return;
        if (modal.querySelector('#reset-export').checked) exportJSON();
        createLocalBackup('reset');
        close();
        state = seedState();
        saveState();
        Object.assign(ui, {
          year: String(currentYear()),
          employerSearch: '', employerStatus: '', employerQuick: [], monthlySearch: '', situationSearch: '',
          insuredSearch: '', insuredEmployer: '', insuredMonth: '',
          journalEmployer: '', journalType: '', journalAlert: '',
          scheduleEmployer: '', scheduleStatus: ''
        });
        resetMonthSelections();
        navigate('dashboard');
        renderCurrentView();
        toast('Application réinitialisée avec les 71 employeurs.');
      });
      setTimeout(() => input.focus(), 50);
    }
  });
}

function createBackupNow() {
  const backup = createLocalBackup('manual');
  if (!backup) {
    toast('Sauvegarde impossible : espace insuffisant. Exportez un fichier JSON.', 'error');
    return;
  }
  renderCurrentView({ keepFocus: true });
  toast('Sauvegarde locale créée.');
}

function restoreLocalBackup(key) {
  const item = listLocalBackups().find(x => x.key === key);
  if (!item) {
    toast('Sauvegarde introuvable.', 'error');
    return;
  }
  confirmAction({
    title: 'Restaurer cette sauvegarde ?',
    message: `Les données actuelles seront remplacées par la sauvegarde du <strong>${escapeHtml(backupDateLabel(item))}</strong>${item.employerCount != null ? ` (${item.employerCount} employeurs)` : ''}. Une sauvegarde de l’état actuel sera créée avant la restauration.`,
    confirmLabel: 'Restaurer',
    danger: true,
    onConfirm() {
      try {
        const restored = readLocalBackup(key);
        createLocalBackup('restore');
        state = restored;
        ui.year = defaultViewYear();
        saveState();
        resetMonthSelections();
        ui.ficheEmployerId = null;
        renderCurrentView();
        toast('Sauvegarde restaurée.');
      } catch (e) {
        toast('Restauration impossible : ' + e.message, 'error');
      }
    }
  });
}

function deleteLocalBackup(key) {
  const item = listLocalBackups().find(x => x.key === key);
  if (!item) {
    toast('Sauvegarde introuvable.', 'error');
    return;
  }
  confirmAction({
    title: 'Supprimer cette sauvegarde ?',
    message: `La sauvegarde du <strong>${escapeHtml(backupDateLabel(item))}</strong> sera supprimée définitivement. Les données actuelles ne sont pas modifiées.`,
    confirmLabel: 'Supprimer',
    danger: true,
    onConfirm() {
      removeLocalBackup(key);
      renderCurrentView({ keepFocus: true });
      toast('Sauvegarde supprimée.');
    }
  });
}

function openThemeModal() {
  const current = normalizeTheme(loadTheme());
  openModal({
    title: 'Thème de l’application',
    subtitle: 'Choisissez les couleurs de l’interface. Le choix est mémorisé sur cet ordinateur.',
    body: `
      <div class="theme-grid" role="radiogroup" aria-label="Choix du thème">
        ${THEMES.map(t => `
          <button type="button" class="theme-card${t.id === current ? ' active' : ''}" data-theme-choice="${escapeAttr(t.id)}" role="radio" aria-checked="${t.id === current ? 'true' : 'false'}">
            <span class="theme-swatch theme-swatch-${t.id || 'blue'}" aria-hidden="true">
              <span class="swatch-side"></span>
              <span class="swatch-bar"></span>
              <span class="swatch-dot"></span>
            </span>
            <span class="theme-card-text">
              <strong>${escapeHtml(t.label)}</strong>
              <span>${escapeHtml(t.description)}</span>
            </span>
            <span class="theme-check" aria-hidden="true">${ico('check')}</span>
          </button>`).join('')}
      </div>
      <p class="quality-help" style="margin-top:14px">Le thème ne change que l’apparence : aucune donnée n’est modifiée.</p>`,
    footer: `<button class="btn" type="button" data-close-modal>Fermer</button>`
  });
}

function startNextYear() {
  const fromYear = normalizeYear(ui.year);
  const nextYear = String(Number(fromYear) + 1);
  const { stats } = buildStats();
  const carry = stats.reduce((sum, s) => sum + s.totalBalance, 0);
  const debtors = stats.filter(s => s.totalBalance > 0).length;
  confirmAction({
    title: `Préparer l’année ${nextYear} ?`,
    message: `Le suivi passera à l’année civile <strong>${nextYear}</strong>. <strong>Aucune donnée ne sera supprimée.</strong> Les données de <strong>${fromYear}</strong> restent intactes et accessibles ; vous pourrez revenir à ${fromYear} à tout moment avec le sélecteur d’année en haut de l’écran.<br><br>Le solde cumulé au 31/12/${fromYear} (<strong>${fmtMoney(carry)}</strong>${debtors ? ` pour ${debtors} ${plural(debtors, 'employeur', 'employeurs')}` : ''}) sera automatiquement repris comme solde antérieur. Ne saisissez pas ce montant dans le dû de janvier ${nextYear}.`,
    confirmLabel: `Préparer ${nextYear}`,
    onConfirm() {
      setYear(nextYear, { toast: `Année ${nextYear} prête. Le solde antérieur est reporté automatiquement.` });
      navigate('dashboard');
    }
  });
}

/* ---------------- Exports CSV ---------------- */
function exportEmployersCSV() {
  const { stats, year } = buildStats();
  const list = filteredEmployerStats(stats);
  const headers = ['N° immatriculation', 'Raison sociale', 'Sigle', 'Contact', 'Effectif', 'Début période impayée', 'Fin période impayée', `Cotisations dues ${year}`, `Montant recouvré ${year}`, 'Solde antérieur', 'Solde cumulé', 'Statut', 'Ancienneté (jours)', 'Dernière action'];
  const rows = list.map(s => [
    s.emp.registration, s.emp.name, s.emp.sigle, s.emp.contact, s.emp.effectif,
    s.startMonth ? monthStartISO(s.startMonth) : '',
    s.endMonth ? monthStartISO(s.endMonth) : '',
    s.due, s.collected, s.priorBalance, s.totalBalance, s.emp.status,
    s.ageDays == null ? '' : s.ageDays,
    s.lastAction || ''
  ]);
  downloadCSV(`employeurs-${year}-${todayISO()}.csv`, headers, rows);
}

function exportMonthlyCSV() {
  const { stats, months, year } = buildStats();
  const query = ui.monthlySearch.trim().toLowerCase();
  const list = stats.filter(s => matchesEmployer(s.emp, query));
  if (ui.monthlyMode === 'entry') {
    const month = ui.monthlyMonth;
    const headers = ['N° immatriculation', 'Employeur', 'Mois', 'Effectif', 'Dû global saisi', 'Encaissé', 'Dû détail', 'Dû retenu', 'Solde'];
    const rows = list.map(s => {
      const ms = s.months[month];
      return [s.emp.registration, s.emp.name, monthLong(month), ms.effectif, ms.dueGlobal, ms.collected, ms.detailTotal, ms.dueRetained, ms.balance];
    });
    downloadCSV(`suivi-mensuel-${month}.csv`, headers, rows);
    return;
  }
  const headers = ['N° immatriculation', 'Employeur', 'Effectif moyen', ...months.map(m => 'Solde ' + monthLong(m)), `Dû ${year}`, `Encaissé ${year}`, 'Solde annuel', 'Solde antérieur', 'Solde cumulé'];
  const rows = list.map(s => [
    s.emp.registration, s.emp.name, s.effectifAverage,
    ...months.map(m => s.months[m].balance),
    s.due, s.collected, s.balance, s.priorBalance, s.totalBalance
  ]);
  const totalsByMonth = months.map(m => stats.reduce((sum, s) => sum + s.months[m].balance, 0));
  const totalsByMonthEffectif = months.map(m => stats.reduce((sum, s) => sum + s.months[m].effectif, 0));
  const averageEffectif = Math.round(totalsByMonthEffectif.reduce((sum, v) => sum + v, 0) / months.length);
  rows.push([
    '', 'TOTAL GÉNÉRAL', averageEffectif, ...totalsByMonth,
    stats.reduce((sum, s) => sum + s.due, 0),
    stats.reduce((sum, s) => sum + s.collected, 0),
    stats.reduce((sum, s) => sum + s.balance, 0),
    stats.reduce((sum, s) => sum + s.priorBalance, 0),
    stats.reduce((sum, s) => sum + s.totalBalance, 0)
  ]);
  downloadCSV(`synthese-mensuelle-${year}.csv`, headers, rows);
}

function xlsxColumnWidths(rows, maxWidth = 48) {
  const widths = [];
  rows.forEach(row => {
    row.forEach((value, index) => {
      const length = String(value == null ? '' : value).length;
      widths[index] = Math.max(widths[index] || 8, Math.min(maxWidth, length + 2));
    });
  });
  return widths.map(width => ({ wch: width || 8 }));
}

function xlsxSheet(rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = xlsxColumnWidths(rows);
  return sheet;
}

function exportWorkbookXLSX() {
  if (typeof XLSX === 'undefined') {
    toast('Le lecteur Excel local n’est pas chargé. Utilisez l’export CSV.', 'error');
    return;
  }
  const { stats, year } = buildStats();
  const workbook = XLSX.utils.book_new();

  const employerHeaders = [
    'N° d’immatriculation', 'Raison sociale', 'Sigle', 'Secteur', 'Contact', 'Effectif déclaré',
    'Début période impayée', 'Fin période impayée', 'Cotisations dues (FCFA)', 'Majorations de retard (FCFA)',
    'Total dû (FCFA)', 'Montant recouvré (FCFA)', 'Solde antérieur (FCFA)', 'Solde restant (FCFA)',
    'Statut', 'Ancienneté (jours)', 'Dernière action'
  ];
  const employerRows = stats.map(s => [
    s.emp.registration, s.emp.name, s.emp.sigle, '', s.emp.contact, s.emp.effectif,
    s.startMonth ? monthStartISO(s.startMonth) : '', s.endMonth ? monthStartISO(s.endMonth) : '',
    s.due, 0, s.due + s.priorBalance, s.collected, s.priorBalance, s.totalBalance,
    s.emp.status, s.ageDays == null ? '' : s.ageDays, s.lastAction || ''
  ]);
  XLSX.utils.book_append_sheet(workbook, xlsxSheet([employerHeaders].concat(employerRows)), 'Employeurs');

  const insuredIndex = buildInsuredIndex();
  const monthlyKeys = new Set();
  Object.keys(state.monthly).forEach(empId => {
    Object.keys(state.monthly[empId] || {}).forEach(month => {
      if (normalizeMonth(month)) monthlyKeys.add(empId + '|' + month);
    });
  });
  state.insured.forEach(row => {
    const month = normalizeMonth(row.month);
    if (month) monthlyKeys.add(row.employerId + '|' + month);
  });
  const monthlyRows = [['N° immatriculation', 'Employeur', 'Mois', 'Effectif', 'Dû global saisi', 'Dû détail (auto)', 'Dû retenu', 'Encaissé', 'Solde du mois']];
  Array.from(monthlyKeys)
    .map(key => key.split('|'))
    .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
    .forEach(([employerId, month]) => {
      const emp = getEmployer(employerId);
      if (!emp) return;
      const ms = monthStats(employerId, month, insuredIndex);
      if (!ms.dueGlobal && !ms.collected && !ms.hasDetail && !ms.effectif) return;
      monthlyRows.push([emp.registration, emp.name, month, ms.effectif, ms.dueGlobal, ms.detailTotal, ms.dueRetained, ms.collected, ms.balance]);
    });
  XLSX.utils.book_append_sheet(workbook, xlsxSheet(monthlyRows), 'Suivi mensuel');

  const insuredRows = [['N° employeur', 'Employeur', 'Mois', 'N° assuré', 'Nom et prénoms', 'Indice', 'Salaire', 'Part employé', 'Part employeur', 'Total']];
  state.insured.forEach(row => {
    const emp = getEmployer(row.employerId);
    if (!emp) return;
    const calc = computeInsuredRow(row);
    insuredRows.push([emp.registration, emp.name, row.month, row.matricule, row.name, row.indice, calc.salary, calc.employee, calc.employer, calc.total]);
  });
  XLSX.utils.book_append_sheet(workbook, xlsxSheet(insuredRows), 'Assurés');

  const journalRows = [['N° d’immatriculation', 'Employeur', 'Date de l’action', 'Type d’action', 'Interlocuteur contacté', 'Résultat / engagement pris', 'Prochaine action', 'Date prochaine action', 'Agent responsable', 'Alerte']];
  state.journal.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).forEach(entry => {
    const emp = getEmployer(entry.employerId);
    journalRows.push([
      emp ? emp.registration : '', emp ? emp.name : 'Employeur supprimé',
      entry.date, entry.type, entry.contact, entry.result, entry.nextAction, entry.nextDate, entry.agent,
      journalAlert(entry)
    ]);
  });
  XLSX.utils.book_append_sheet(workbook, xlsxSheet(journalRows), 'Journal');

  const scheduleRows = [['N° d’immatriculation', 'Employeur', 'N° d’échéance', 'Date prévue', 'Montant prévu (FCFA)', 'Date de paiement', 'Montant payé (FCFA)', 'Reste à payer (FCFA)', 'Statut', 'Jours de retard']];
  state.schedules.forEach(schedule => {
    const emp = getEmployer(schedule.employerId);
    const info = scheduleStats(schedule);
    scheduleRows.push([
      emp ? emp.registration : '', emp ? emp.name : 'Employeur supprimé',
      schedule.number, schedule.dueDate, schedule.amount, schedule.paidDate || '',
      schedule.paidAmount, info.remaining, info.status, info.lateDays || 0
    ]);
  });
  XLSX.utils.book_append_sheet(workbook, xlsxSheet(scheduleRows), 'Échéanciers');

  const settings = state.settings || {};
  const parameterRows = [
    ['Paramètre', 'Valeur'],
    ['Valeur indiciaire', num(settings.valeurIndiciaire)],
    ['Taux part employé', num(settings.rateEmployee)],
    ['Taux part employeur', num(settings.rateEmployer)],
    ['Taux global', num(settings.rateEmployee) + num(settings.rateEmployer)],
    ['Nombre de jours « à faire bientôt »', num(settings.alertDays)],
    ['Date du jour simulée', settings.todayOverride || ''],
    ['Année affichée', year],
    ['Version de l’application', APP_RELEASE],
    ['Version des données', DATA_VERSION],
    ['Date de l’export', todayISO()]
  ];
  XLSX.utils.book_append_sheet(workbook, xlsxSheet(parameterRows), 'Paramètres');

  try {
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    downloadFile(`classeur-cotisations-${year}-${todayISO()}.xlsx`, new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    toast('Classeur Excel téléchargé.');
  } catch (e) {
    toast('Export Excel impossible : ' + (e && e.message ? e.message : 'erreur inconnue'), 'error');
  }
}

function exportSituationCSV() {
  const month = ui.situationMonth;
  const query = ui.situationSearch.trim().toLowerCase();
  const { stats } = buildStats();
  const list = stats.filter(s => matchesEmployer(s.emp, query));
  const headers = ['N° immatriculation', 'Organisme', 'Sigle', 'Mois', 'Dû', 'Encaissé', 'Solde', 'Situation'];
  const rows = list.map(s => {
    const ms = s.months[month];
    return [s.emp.registration, s.emp.name, s.emp.sigle, monthLong(month), ms.dueRetained, ms.collected, ms.balance, situationFor(ms).label];
  });
  downloadCSV(`situation-${month}.csv`, headers, rows);
}

function exportInsuredCSV() {
  const rows = filteredInsured().map(row => {
    const emp = getEmployer(row.employerId);
    const calc = computeInsuredRow(row);
    return [emp ? emp.registration : '', emp ? emp.name : '', monthLong(row.month), row.matricule, row.name, row.indice, calc.salary, calc.employee, calc.employer, calc.total];
  });
  downloadCSV(`detail-assures-${normalizeYear(ui.year)}-${todayISO()}.csv`, ['N° employeur', 'Employeur', 'Mois', 'N° assuré', 'Nom et prénoms', 'Indice', 'Salaire', 'Part employé', 'Part employeur', 'Total'], rows);
}

function exportJournalCSV() {
  const rows = filteredJournal().map(j => {
    const emp = getEmployer(j.employerId);
    return [j.date, emp ? emp.registration : '', emp ? emp.name : '', j.type, j.contact, j.result, j.nextAction, j.nextDate, j.agent, journalAlert(j)];
  });
  downloadCSV(`journal-${todayISO()}.csv`, ['Date', 'N° employeur', 'Employeur', 'Type', 'Interlocuteur', 'Résultat', 'Prochaine action', 'Date prochaine action', 'Agent', 'Alerte'], rows);
}

function exportSchedulesCSV() {
  const rows = filteredSchedules().map(item => {
    const emp = getEmployer(item.employerId);
    const calc = scheduleStats(item);
    return [emp ? emp.registration : '', emp ? emp.name : '', item.number, item.dueDate, calc.amount, item.paidDate, calc.paid, calc.remaining, calc.status, calc.lateDays];
  });
  downloadCSV(`echeanciers-${todayISO()}.csv`, ['N° employeur', 'Employeur', 'N° échéance', 'Date prévue', 'Montant prévu', 'Date paiement', 'Montant payé', 'Reste', 'Statut', 'Jours de retard'], rows);
}

/* ---------------- Import CSV du suivi mensuel ---------------- */
function normalizeImportText(value) {
  return String(value == null ? '' : value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const IMPORT_MONTH_NAMES = MONTHS_LONG
  .map((name, i) => ({ key: normalizeImportText(name), value: i + 1 }))
  .concat(MONTHS_SHORT.map((name, i) => ({ key: normalizeImportText(name), value: i + 1 })))
  .filter((item, index, list) => list.findIndex(x => x.key === item.key) === index);

function buildImportMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return null;
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  return `${y}-${pad2(m)}`;
}

function importMonthKey(value) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})$/.exec(s);
  if (m) return buildImportMonth(m[1], m[2]);
  m = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return buildImportMonth(m[2], m[1]);
  m = /^(\d{4})(\d{2})$/.exec(s);
  if (m) return buildImportMonth(m[1], m[2]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return buildImportMonth(m[3], m[2]);

  const normalized = normalizeImportText(s);
  const yearMatch = /(20\d{2})/.exec(normalized);
  if (!yearMatch) return null;
  const namePart = normalized.replace(yearMatch[1], '').trim();
  if (namePart.length < 3) return null;
  const exact = IMPORT_MONTH_NAMES.find(x => x.key === namePart);
  const matched = exact || IMPORT_MONTH_NAMES.find(x => x.key.startsWith(namePart) || namePart.startsWith(x.key));
  return matched ? `${yearMatch[1]}-${pad2(matched.value)}` : null;
}

function importAmount(value) {
  let s = String(value == null ? '' : value).trim();
  if (!s) return 0;
  s = s.replace(/[\u00a0\u202f]/g, ' ').replace(/\s/g, '');
  s = s.replace(/fcfa|cfa|francs?/gi, '').replace(/[€$]/g, '');
  if (!s) return 0;

  const commas = (s.match(/,/g) || []).length;
  const dots = (s.match(/\./g) || []).length;
  if (commas && dots) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(/,/g, '.');
    else s = s.replace(/,/g, '');
  } else if (commas) {
    if (commas > 1) {
      const last = s.lastIndexOf(',');
      s = s.slice(0, last).replace(/,/g, '') + '.' + s.slice(last + 1);
    } else {
      s = s.replace(',', '.');
    }
  } else if (dots) {
    if (dots > 1) {
      const last = s.lastIndexOf('.');
      const tail = s.slice(last + 1);
      s = tail.length === 3 ? s.replace(/\./g, '') : s.slice(0, last).replace(/\./g, '') + '.' + tail;
    } else {
      const parts = s.split('.');
      if (parts[1] && parts[1].length === 3 && parts[0].length <= 3) s = parts.join('');
    }
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function detectCsvDelimiter(text) {
  const firstLine = String(text || '').split(/\r?\n/)[0] || '';
  const candidates = [';', ',', '\t'];
  let best = ';';
  let bestCount = 0;
  candidates.forEach(delimiter => {
    const count = firstLine.split(delimiter).length - 1;
    if (count > bestCount) { best = delimiter; bestCount = count; }
  });
  return best;
}

function parseCsvRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '') { quoted = true; continue; }
    if (ch === delimiter) { row.push(cell); cell = ''; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (ch === '\r') continue;
    cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter(r => r.some(value => String(value).trim() !== ''));
}

function mapMonthlyImportColumns(headers) {
  return window.excelTools
    ? excelTools.mapMonthlyColumns(headers)
    : { registration: -1, month: -1, due: -1, collected: -1, effectif: -1 };
}

function openMonthlyImportError(headers, missing, sourceLabel) {
  openModal({
    title: 'Fichier non reconnu',
    subtitle: sourceLabel || 'Les colonnes indispensables sont absentes',
    body: `
      <div class="notice danger">${ico('alert')}<div>Colonne(s) manquante(s) : <strong>${missing.map(escapeHtml).join(', ')}</strong>.</div></div>
      <p class="quality-help">Colonnes attendues : <strong>N° immatriculation</strong>, <strong>Mois</strong> (ex. 2026-01), <strong>Dû global</strong> et <strong>Encaissé</strong>. La colonne <strong>Effectif</strong> est optionnelle.</p>
      <p class="quality-help">Fichiers acceptés : CSV (séparateur point-virgule ou virgule) et classeur Excel (.xlsx, .xls). Dans un classeur, l’application cherche la feuille qui contient ces colonnes, même si le tableau ne commence pas à la première ligne.</p>
      <p class="quality-help">Colonnes trouvées : ${headers.map(h => escapeHtml(h || '(vide)')).join(', ') || '(aucune)'}.</p>
      <p class="quality-help">Pour un fichier CSV, utilisez « Enregistrer sous → CSV UTF-8 » pour conserver les accents.</p>`,
    footer: `
      <button class="btn" type="button" data-close-modal>Fermer</button>
      <button class="btn btn-primary" type="button" id="import-model-from-error">${ico('download')} Télécharger le modèle CSV</button>`,
    onMount(modal) {
      modal.querySelector('#import-model-from-error').addEventListener('click', downloadMonthlyImportModel);
    }
  });
}

function isSpreadsheetFile(file) {
  const name = String(file && file.name || '').toLowerCase();
  if (/\.(xlsx|xlsm|xls)$/.test(name)) return true;
  return /spreadsheetml|ms-excel/.test(String(file && file.type || ''));
}

function readMonthlyImportFile(file) {
  if (!file) return;
  if (isSpreadsheetFile(file)) {
    readMonthlySpreadsheet(file);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const bytes = new Uint8Array(reader.result || []);
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(bytes);
    } catch (e) {
      text = String(reader.result || '');
    }
    openMonthlyImportPreview(text);
  };
  reader.onerror = () => toast('Impossible de lire le fichier.');
  reader.readAsArrayBuffer(file);
}

function openWorkbookImportChoice(candidates) {
  openModal({
    title: 'Quelle feuille importer ?',
    subtitle: 'Plusieurs feuilles contiennent un tableau de suivi mensuel',
    body: `<div class="notice" style="margin-bottom:12px">${ico('info')}<div>Choisissez la feuille à analyser. Les colonnes reconnues sont <strong>N° immatriculation</strong>, <strong>Mois</strong>, <strong>Dû global</strong> et <strong>Encaissé</strong>.</div></div>
      <div class="data-actions">
        ${candidates.map((candidate, index) => `<button class="data-action" type="button" data-xlsx-sheet="${index}">
          <span class="da-ico">${ico('file')}</span>
          <span><strong>${escapeHtml(candidate.sheet)}</strong><span>${candidate.rows.length - 1} ligne(s) de données</span></span>
        </button>`).join('')}
      </div>`,
    footer: `<button class="btn" type="button" data-close-modal>Annuler</button>`,
    onMount(modal) {
      modal.querySelectorAll('[data-xlsx-sheet]').forEach(button => {
        button.addEventListener('click', () => {
          const candidate = candidates[Number(button.dataset.xlsxSheet)];
          closeModal();
          if (!candidate) return;
          openMonthlyImportRows(candidate.rows, { sourceLabel: `feuille Excel « ${candidate.sheet} »` });
        });
      });
    }
  });
}

function readMonthlySpreadsheet(file) {
  if (typeof XLSX === 'undefined') {
    toast('Le lecteur Excel local n’est pas chargé. Utilisez un fichier CSV.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    let workbook = null;
    try {
      workbook = XLSX.read(new Uint8Array(reader.result || []), { type: 'array', cellDates: true });
    } catch (e) {
      toast('Fichier Excel illisible : ' + (e && e.message ? e.message : 'format inconnu'), 'error');
      return;
    }
    const candidates = excelTools.monthlyCandidates(workbook);
    if (!candidates.length) {
      openMonthlyImportError([], ['N° immatriculation', 'Mois', 'Dû global et/ou Encaissé'], 'Aucune feuille de suivi mensuel reconnue');
      return;
    }
    if (candidates.length === 1) {
      openMonthlyImportRows(candidates[0].rows, { sourceLabel: `feuille Excel « ${candidates[0].sheet} »` });
      return;
    }
    openWorkbookImportChoice(candidates);
  };
  reader.onerror = () => toast('Impossible de lire le fichier Excel.');
  reader.readAsArrayBuffer(file);
}

function downloadMonthlyImportModel() {
  downloadCSV(
    `modele-import-mensuel-${todayISO()}.csv`,
    ['N° immatriculation', 'Mois', 'Effectif', 'Dû global', 'Encaissé'],
    []
  );
}

function openMonthlyImportPreview(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  if (!clean.trim()) { toast('Le fichier est vide.'); return; }

  const delimiter = detectCsvDelimiter(clean);
  const rows = parseCsvRows(clean, delimiter);
  openMonthlyImportRows(rows, {
    sourceLabel: `fichier lu avec le séparateur « ${delimiter === '\t' ? 'tabulation' : delimiter} »`
  });
}

function openMonthlyImportRows(rows, options = {}) {
  if (!rows || rows.length < 2) { toast('Le fichier ne contient aucune ligne de données.'); return; }

  const headerIndex = window.excelTools ? excelTools.findMonthlyHeaderRow(rows) : 0;
  if (headerIndex < 0) {
    openMonthlyImportError(rows[0] || [], ['N° immatriculation', 'Mois', 'Dû global et/ou Encaissé'], options.sourceLabel);
    return;
  }
  const headers = (rows[headerIndex] || []).map(value => value == null ? '' : String(value).trim());
  const columns = mapMonthlyImportColumns(headers);
  const missing = [];
  if (columns.registration < 0) missing.push('N° immatriculation');
  if (columns.month < 0) missing.push('Mois');
  if (columns.due < 0 && columns.collected < 0) missing.push('Dû global et/ou Encaissé');
  if (missing.length) { openMonthlyImportError(headers, missing, options.sourceLabel); return; }

  const registrationMap = new Map();
  state.employers.forEach(emp => {
    const exact = String(emp.registration || '').trim().toLowerCase();
    const compact = exact.replace(/[^0-9a-z]/g, '');
    if (exact) registrationMap.set(exact, emp);
    if (compact) registrationMap.set(compact, emp);
  });

  const valid = [];
  const errors = [];
  const warnings = [];
  const cell = (row, index) => index >= 0 && index < row.length ? String(row[index] == null ? '' : row[index]).trim() : '';
  const dataRows = rows.slice(headerIndex + 1);

  dataRows.forEach((row, offset) => {
    const line = headerIndex + offset + 2;
    const rawRegistration = cell(row, columns.registration);
    const rawMonth = cell(row, columns.month);
    const rawDue = cell(row, columns.due);
    const rawCollected = cell(row, columns.collected);
    const rawEffectif = cell(row, columns.effectif);

    if (!rawRegistration && !rawMonth && !rawDue && !rawCollected && !rawEffectif) return;
    if (!rawRegistration) { errors.push({ line, message: 'N° d’immatriculation vide' }); return; }
    const emp = registrationMap.get(rawRegistration.toLowerCase()) || registrationMap.get(rawRegistration.toLowerCase().replace(/[^0-9a-z]/g, ''));
    if (!emp) { errors.push({ line, message: `Employeur inconnu : ${rawRegistration}` }); return; }
    const month = importMonthKey(rawMonth);
    if (!month) { errors.push({ line, message: `Mois illisible : ${rawMonth || '(vide)'}` }); return; }
    const dueProvided = columns.due >= 0 && rawDue !== '';
    const collectedProvided = columns.collected >= 0 && rawCollected !== '';
    const effectifProvided = columns.effectif >= 0 && rawEffectif !== '';
    if (!dueProvided && !collectedProvided && !effectifProvided) { errors.push({ line, message: 'Dû, encaissé et effectif sont vides' }); return; }
    const parsedDue = dueProvided ? importAmount(rawDue) : 0;
    if (dueProvided && parsedDue == null) { errors.push({ line, message: `Dû global invalide : ${rawDue}` }); return; }
    const parsedCollected = collectedProvided ? importAmount(rawCollected) : 0;
    if (collectedProvided && parsedCollected == null) { errors.push({ line, message: `Encaissé invalide : ${rawCollected}` }); return; }
    const parsedEffectif = effectifProvided ? importAmount(rawEffectif) : null;
    if (effectifProvided && parsedEffectif == null) { errors.push({ line, message: `Effectif invalide : ${rawEffectif}` }); return; }

    const key = emp.id + '|' + month;
    const duplicateIndex = valid.findIndex(item => item.key === key);
    if (duplicateIndex >= 0) {
      const previousLine = valid[duplicateIndex].line;
      valid.splice(duplicateIndex, 1);
      warnings.push({ line, message: `Doublon avec la ligne ${previousLine} : seule cette ligne sera importée.` });
    }

    const existing = state.monthly[emp.id] ? state.monthly[emp.id][month] : null;
    const beforeDue = existing ? num(existing.dueGlobal) : 0;
    const beforeCollected = existing ? num(existing.collected) : 0;
    const beforeEffectif = existing && existing.effectif !== undefined && existing.effectif !== null && existing.effectif !== ''
      ? Math.max(0, round0(existing.effectif))
      : null;
    const due = dueProvided ? parsedDue : beforeDue;
    const collected = collectedProvided ? parsedCollected : beforeCollected;
    const effectif = effectifProvided ? Math.max(0, round0(parsedEffectif)) : beforeEffectif;
    const status = !existing
      ? 'Nouveau'
      : (beforeDue === due && beforeCollected === collected && beforeEffectif === effectif ? 'Inchangé' : 'Mise à jour');
    const hasDetail = dueProvided && state.insured.some(r => r.employerId === emp.id && normalizeMonth(r.month) === month);

    valid.push({
      key, line, emp, month, due, collected, effectif, effectifProvided, beforeDue, beforeCollected, status, hasDetail
    });
  });

  const newCount = valid.filter(item => item.status === 'Nouveau').length;
  const updateCount = valid.filter(item => item.status === 'Mise à jour').length;
  const unchangedCount = valid.filter(item => item.status === 'Inchangé').length;
  const detailCount = valid.filter(item => item.hasDetail).length;
  const years = Array.from(new Set(valid.map(item => item.month.slice(0, 4)))).sort();
  const previewRows = valid.slice(0, 200);

  const body = `
    <div class="import-summary">
      <div><span>Lignes valides</span><strong>${valid.length}</strong></div>
      <div><span>Nouvelles</span><strong>${newCount}</strong></div>
      <div><span>Mises à jour</span><strong>${updateCount}</strong></div>
      <div><span>Inchangées</span><strong>${unchangedCount}</strong></div>
      <div><span>Lignes en erreur</span><strong class="${errors.length ? 'red' : ''}">${errors.length}</strong></div>
    </div>
    <p class="quality-help">
      Année(s) concernée(s) : <strong>${years.length ? years.join(', ') : '—'}</strong>.
      Les mois absents du fichier ne seront pas modifiés. Les valeurs existantes des lignes importées seront remplacées.
    </p>
    ${valid.length ? `<div class="table-wrap" style="max-height:340px;margin-top:10px">
      <table class="mini-table import-preview-table">
        <thead><tr><th>Ligne</th><th>Immatriculation</th><th>Employeur</th><th>Mois</th><th>Effectif</th><th>Dû</th><th>Encaissé</th><th>État</th></tr></thead>
        <tbody>
          ${previewRows.map(item => `<tr>
            <td>${item.line}</td>
            <td>${escapeHtml(item.emp.registration)}</td>
            <td>${escapeHtml(item.emp.name)}</td>
            <td>${item.month}</td>
            <td>${item.effectif == null ? '—' : fmtNum(item.effectif)}</td>
            <td>${fmtNum(item.due)}</td>
            <td>${fmtNum(item.collected)}</td>
            <td>${escapeHtml(item.status)}${item.hasDetail ? ' · détail assurés' : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>${valid.length > previewRows.length ? `<p class="quality-help">Seules les ${previewRows.length} premières lignes sont affichées ; toutes les ${valid.length} lignes valides seront importées.</p>` : ''}` : ''}
    ${detailCount ? `<div class="notice" style="margin-top:12px">${ico('info')}<div><strong>${detailCount} ligne(s) concernent un mois couvert par le détail des assurés.</strong> Le dû global importé ne sera pas retenu pour ces mois, car le détail des assurés reste prioritaire. L’encaissement importé, lui, sera bien enregistré.</div></div>` : ''}
    ${warnings.length ? `<div class="notice" style="margin-top:12px">${ico('alert')}<div><strong>${warnings.length} doublon(s) détecté(s).</strong><br>${warnings.slice(0, 10).map(w => `Ligne ${w.line} : ${escapeHtml(w.message)}`).join('<br>')}${warnings.length > 10 ? '<br>…' : ''}</div></div>` : ''}
    ${errors.length ? `<div class="notice danger" style="margin-top:12px">${ico('alert')}<div><strong>${errors.length} ligne(s) ignorée(s) :</strong><br>${errors.slice(0, 12).map(err => `Ligne ${err.line} : ${escapeHtml(err.message)}`).join('<br>')}${errors.length > 12 ? '<br>…' : ''}</div></div>` : ''}
  `;

  openModal({
    title: 'Importer le suivi mensuel',
    subtitle: `${valid.length} ligne(s) valide(s) sur ${dataRows.length} — ${options.sourceLabel || 'fichier importé'}`,
    size: 'modal-lg',
    body,
    footer: `
      <button class="btn" type="button" data-close-modal>Annuler</button>
      <button class="btn" type="button" id="import-download-model">${ico('download')} Modèle CSV</button>
      <button class="btn btn-primary" type="button" id="apply-monthly-import" ${valid.length ? '' : 'disabled'}>Importer ${valid.length} ligne(s)</button>`,
    onMount(modal, close) {
      modal.querySelector('#import-download-model').addEventListener('click', downloadMonthlyImportModel);
      const applyBtn = modal.querySelector('#apply-monthly-import');
      if (!applyBtn || !valid.length) return;
      applyBtn.addEventListener('click', () => {
        valid.forEach(item => {
          if (!state.monthly[item.emp.id]) state.monthly[item.emp.id] = {};
          const target = state.monthly[item.emp.id][item.month] || {};
          target.dueGlobal = item.due;
          target.collected = item.collected;
          if (item.effectifProvided) target.effectif = item.effectif;
          state.monthly[item.emp.id][item.month] = target;
        });
        saveState();
        close();
        const ignored = errors.length ? `, ${errors.length} ligne(s) ignorée(s)` : '';
        const message = `${valid.length} ligne(s) traitée(s) : ${newCount} nouvelle(s), ${updateCount} mise(s) à jour, ${unchangedCount} inchangée(s)${ignored}.`;
        if (years.length === 1 && years[0] !== normalizeYear(ui.year)) {
          setYear(years[0], { toast: message + ` Année ${years[0]} affichée.` });
        } else {
          renderCurrentView();
          toast(message);
        }
      });
    }
  });
}

/* ---------------- Impression ---------------- */
function setPrintHead(title, subtitle) {
  const titleEl = $('#print-title');
  const metaEl = $('#print-meta');
  if (titleEl) titleEl.textContent = title || '';
  if (metaEl) {
    const parts = [];
    if (subtitle) parts.push(subtitle);
    parts.push(`Année ${normalizeYear(ui.year)}`);
    parts.push(`Édité le ${new Date().toLocaleDateString('fr-FR')}`);
    parts.push(`Date de référence : ${fmtDate(effectiveToday())}`);
    metaEl.textContent = parts.join(' · ');
  }
}

function runPrint(mode) {
  document.body.classList.add(mode);
  document.body.classList.toggle('print-landscape', mode === 'print-view' && (ui.route === 'monthly' || ui.route === 'situation'));
  const cleanup = () => document.body.classList.remove('print-view', 'print-fiche', 'print-letter', 'print-report', 'print-landscape');
  window.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 1200);
  }, 40);
}

function printCurrentView() {
  setPrintHead(
    $('#page-title') ? $('#page-title').textContent : '',
    $('#page-subtitle') ? $('#page-subtitle').textContent : ''
  );
  runPrint('print-view');
}

function printFiche() {
  runPrint('print-fiche');
}

function printCommitteeReport() {
  const host = document.getElementById('committee-report');
  if (!host) return;
  host.innerHTML = committeeReportHtml(buildCommitteeReport());
  runPrint('print-report');
}

function prepareBrowserPrint() {
  const root = $('#modal-root');
  if (root && !root.hidden && root.querySelector('.letter-paper')) {
    document.body.classList.add('print-letter');
    return;
  }
  const ficheOpen = root && !root.hidden && root.querySelector('.fiche-head');
  if (ficheOpen) {
    document.body.classList.add('print-fiche');
  } else {
    setPrintHead(
      $('#page-title') ? $('#page-title').textContent : '',
      $('#page-subtitle') ? $('#page-subtitle').textContent : ''
    );
    document.body.classList.add('print-view');
    document.body.classList.toggle('print-landscape', ui.route === 'monthly' || ui.route === 'situation');
  }
}

/* ---------------- Événements ---------------- */
function bindEvents() {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('input', onDocumentInput);
  document.addEventListener('change', onDocumentChange);
  document.addEventListener('submit', onDocumentSubmit);
  document.addEventListener('keydown', onDocumentKeydown);
  document.addEventListener('pointerdown', e => {
    const cell = e.target.closest && e.target.closest('.cell-input[data-monthly-emp]');
    if (cell) cell.dataset.caretEdit = '1';
  });
  window.addEventListener('hashchange', () => {
    renderCurrentView();
    closeSidebar();
  });
  const backdrop = $('#sidebar-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeSidebar);
  window.addEventListener('pagehide', flushPendingSave);
  window.addEventListener('beforeunload', flushPendingSave);
  window.addEventListener('resize', syncSidebarUi);
  window.addEventListener('beforeprint', prepareBrowserPrint);
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-view', 'print-fiche');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSave();
  });
}

function onDocumentClick(e) {
  const menuBtn = e.target.closest('#menu-btn');
  if (menuBtn) {
    if (desktopLayout()) setSidebarCollapsed(!sidebarCollapsed());
    else if ($('#sidebar').classList.contains('open')) closeSidebar();
    else openSidebar();
    return;
  }
  if (e.target.closest('#sidebar-backdrop')) { closeSidebar(); return; }
  if (e.target.closest('.nav-link')) { closeSidebar(); return; }
  if (e.target.closest('#today-chip')) { navigate('settings'); return; }

  const openEmp = e.target.closest('[data-open-employer]');
  if (openEmp) {
    e.preventDefault();
    openEmployerFiche(openEmp.getAttribute('data-open-employer'));
    return;
  }
  const editEmp = e.target.closest('[data-edit-employer]');
  if (editEmp) { e.preventDefault(); openEmployerForm(editEmp.getAttribute('data-edit-employer')); return; }
  const delEmp = e.target.closest('[data-delete-employer]');
  if (delEmp) { e.preventDefault(); deleteEmployer(delEmp.getAttribute('data-delete-employer')); return; }
  const addEmp = e.target.closest('[data-add-employer]');
  if (addEmp) { e.preventDefault(); openEmployerForm(); return; }

  const qualityBtn = e.target.closest('[data-quality-list]');
  if (qualityBtn) { e.preventDefault(); openDataQualityList(qualityBtn.getAttribute('data-quality-list')); return; }
  const applyStatusBtn = e.target.closest('[data-apply-status]');
  if (applyStatusBtn) {
    e.preventDefault();
    const emp = getEmployer(applyStatusBtn.getAttribute('data-apply-status'));
    if (emp) {
      emp.status = applyStatusBtn.getAttribute('data-status');
      saveState();
      const qualityList = applyStatusBtn.closest('[data-quality-kind]');
      const qualityKind = qualityList ? qualityList.getAttribute('data-quality-kind') : '';
      closeModal();
      renderCurrentView();
      toast('Statut mis à jour : ' + emp.status + '.');
      if (qualityKind) openDataQualityList(qualityKind);
    }
    return;
  }

  const editIns = e.target.closest('[data-edit-insured]');
  if (editIns) { e.preventDefault(); openInsuredForm(editIns.getAttribute('data-edit-insured')); return; }
  const delIns = e.target.closest('[data-delete-insured]');
  if (delIns) { e.preventDefault(); deleteInsured(delIns.getAttribute('data-delete-insured')); return; }

  const editJournal = e.target.closest('[data-edit-journal]');
  if (editJournal) { e.preventDefault(); openJournalForm(editJournal.getAttribute('data-edit-journal')); return; }
  const delJournal = e.target.closest('[data-delete-journal]');
  if (delJournal) { e.preventDefault(); deleteJournal(delJournal.getAttribute('data-delete-journal')); return; }

  const editSchedule = e.target.closest('[data-edit-schedule]');
  if (editSchedule) { e.preventDefault(); openScheduleForm(editSchedule.getAttribute('data-edit-schedule')); return; }
  const paySchedule = e.target.closest('[data-pay-schedule]');
  if (paySchedule) { e.preventDefault(); markSchedulePaid(paySchedule.getAttribute('data-pay-schedule')); return; }
  const delSchedule = e.target.closest('[data-delete-schedule]');
  if (delSchedule) { e.preventDefault(); deleteSchedule(delSchedule.getAttribute('data-delete-schedule')); return; }

  const modeBtn = e.target.closest('[data-monthly-mode]');
  if (modeBtn) {
    ui.monthlyMode = modeBtn.getAttribute('data-monthly-mode');
    renderCurrentView();
    return;
  }

  const restoreBackupBtn = e.target.closest('[data-restore-backup]');
  if (restoreBackupBtn) { e.preventDefault(); restoreLocalBackup(restoreBackupBtn.getAttribute('data-restore-backup')); return; }
  const deleteBackupBtn = e.target.closest('[data-delete-backup]');
  if (deleteBackupBtn) { e.preventDefault(); deleteLocalBackup(deleteBackupBtn.getAttribute('data-delete-backup')); return; }

  const themeChoice = e.target.closest('[data-theme-choice]');
  if (themeChoice) {
    e.preventDefault();
    const chosen = normalizeTheme(themeChoice.getAttribute('data-theme-choice'));
    applyTheme(chosen, { toast: true });
    themeChoice.closest('.theme-grid').querySelectorAll('[data-theme-choice]').forEach(card => {
      const active = normalizeTheme(card.getAttribute('data-theme-choice')) === chosen;
      card.classList.toggle('active', active);
      card.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    return;
  }

  const bulkMode = e.target.closest('[data-bulk-mode]');
  if (bulkMode) {
    e.preventDefault();
    window.bulkMail.selectVisible(bulkMode.getAttribute('data-bulk-mode'));
    return;
  }

  const quickFilter = e.target.closest('[data-quick-filter]');
  if (quickFilter) {
    e.preventDefault();
    const key = quickFilter.getAttribute('data-quick-filter');
    const active = ui.employerQuick || [];
    if (key === 'clear') ui.employerQuick = [];
    else if (active.includes(key)) ui.employerQuick = active.filter(k => k !== key);
    else ui.employerQuick = active.concat(key);
    renderCurrentView();
    return;
  }

  const button = e.target.closest('button');
  if (!button) return;
  switch (button.id) {
    case 'theme-toggle': openThemeModal(); break;
    case 'bulk-preview': window.bulkMail.preview(); break;
    case 'bulk-clear': window.bulkMail.clear(); break;
    case 'quick-export': exportJSON(); break;
    case 'storage-alert-export': exportJSON(); break;
    case 'print-page': printCurrentView(); break;
    case 'print-committee-report': printCommitteeReport(); break;
    case 'export-employers': exportEmployersCSV(); break;
    case 'add-employer': openEmployerForm(); break;
    case 'export-monthly': exportMonthlyCSV(); break;
    case 'export-monthly-xlsx': exportWorkbookXLSX(); break;
    case 'import-monthly': { const input = $('#monthly-import-file'); if (input) input.click(); break; }
    case 'monthly-import-model': downloadMonthlyImportModel(); break;
    case 'export-situation': exportSituationCSV(); break;
    case 'add-insured':
    case 'add-insured-empty': openInsuredForm(); break;
    case 'export-insured': exportInsuredCSV(); break;
    case 'insured-show-more': ui.insuredLimit += 500; renderCurrentView({ keepFocus: true }); break;
    case 'add-journal':
    case 'add-journal-empty': openJournalForm(); break;
    case 'export-journal': exportJournalCSV(); break;
    case 'add-schedule':
    case 'add-schedule-empty': openScheduleForm(); break;
    case 'export-schedules': exportSchedulesCSV(); break;
    case 'export-json': exportJSON(); break;
    case 'import-json': { const input = $('#import-file'); if (input) input.click(); break; }
    case 'export-all-csv': exportEmployersCSV(); break;
    case 'export-xlsx': exportWorkbookXLSX(); break;
    case 'reset-data': resetAllData(); break;
    case 'create-backup': createBackupNow(); break;
    case 'reset-settings-defaults': fillDefaultSettings(); break;
    case 'start-next-year': startNextYear(); break;
    case 'normalize-names-settings': openNameNormalization(); break;
    case 'auto-backup-pick': handleAutoBackupPick(); break;
    case 'auto-backup-grant': handleAutoBackupGrant(); break;
    case 'auto-backup-now': handleAutoBackupNow(); break;
    case 'notif-test': handleNotifTest(); break;
    default: break;
  }
}

const SEARCH_DEBOUNCE_MS = 250;
let searchRefreshTimer = null;
let searchRefreshRoute = '';

function scheduleSearchRefresh(route) {
  searchRefreshRoute = route;
  if (searchRefreshTimer) clearTimeout(searchRefreshTimer);
  searchRefreshTimer = setTimeout(() => {
    searchRefreshTimer = null;
    if (ui.route !== searchRefreshRoute) return;
    refreshSearchView();
  }, SEARCH_DEBOUNCE_MS);
}

function setResultCount(id, visible, total, suffix = '') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<strong>${visible}</strong> / ${total}${suffix}`;
}

function refreshSearchView() {
  if (ui.route === 'employers') {
    const { stats } = buildStats();
    const list = filteredEmployerStats(stats);
    const risk = riskScoring.analyze(stats);
    const tbody = document.getElementById('employers-tbody');
    if (tbody) {
      tbody.innerHTML = employersRowsHtml(list, risk.byId);
      setResultCount('employer-count', list.length, stats.length, ' employeurs');
      const quickBar = document.getElementById('employer-quick-filters');
      if (quickBar) quickBar.innerHTML = employerQuickFiltersHtml(stats);
      window.bulkMail.syncToolbar();
      return;
    }
  }
  if (ui.route === 'monthly') {
    const { stats, months } = buildStats();
    const query = ui.monthlySearch.trim().toLowerCase();
    const list = stats.filter(s => matchesEmployer(s.emp, query));
    if (ui.monthlyMode === 'entry') {
      const tbody = document.getElementById('monthly-tbody');
      if (tbody) {
        tbody.innerHTML = monthlyRowsHtml(list, ui.monthlyMonth);
        setResultCount('monthly-count', list.length, stats.length, ' employeurs');
        return;
      }
    } else {
      const tbody = document.getElementById('monthly-synthesis-tbody');
      if (tbody) {
        tbody.innerHTML = monthlySynthesisRowsHtml(list, months);
        setResultCount('monthly-synthesis-count', list.length, stats.length);
        return;
      }
    }
  }
  if (ui.route === 'situation') {
    const { stats } = buildStats();
    const query = ui.situationSearch.trim().toLowerCase();
    const list = stats.filter(s => matchesEmployer(s.emp, query));
    const detail = document.getElementById('situation-tbody');
    const matrix = document.getElementById('situation-matrix-tbody');
    if (detail && matrix) {
      detail.innerHTML = situationRowsHtml(list, ui.situationMonth);
      matrix.innerHTML = situationMatrixRowsHtml(list, monthsList());
      setResultCount('situation-count', list.length, stats.length);
      return;
    }
  }
  renderCurrentView({ keepFocus: true });
}

function formatAmountField(input) {
  const caret = typeof input.selectionStart === 'number' ? input.selectionStart : null;
  const digitsBefore = caret == null ? null : input.value.slice(0, caret).replace(/\D/g, '').length;
  const formatted = formatAmountInput(input.value);
  if (formatted === input.value) return;
  input.value = formatted;
  if (digitsBefore == null) return;
  let pos = 0;
  let seen = 0;
  while (pos < formatted.length && seen < digitsBefore) {
    if (/\d/.test(formatted[pos])) seen += 1;
    pos += 1;
  }
  input.setSelectionRange(pos, pos);
}

function onDocumentInput(e) {
  const target = e.target;
  if (target.matches && target.matches('[data-amount]')) formatAmountField(target);
  if (target.id === 'employer-search') {
    ui.employerSearch = target.value;
    scheduleSearchRefresh('employers');
    return;
  }
  if (target.id === 'monthly-search') {
    ui.monthlySearch = target.value;
    scheduleSearchRefresh('monthly');
    return;
  }
  if (target.id === 'situation-search') {
    ui.situationSearch = target.value;
    scheduleSearchRefresh('situation');
    return;
  }
  if (target.id === 'insured-search') {
    ui.insuredSearch = target.value;
    ui.insuredLimit = 500;
    scheduleSearchRefresh('insured');
    return;
  }
  if (target.matches('.cell-input[data-monthly-emp]')) {
    target.dataset.caretEdit = '1';
    return;
  }
  if (target.id === 'set-rate-employee' || target.id === 'set-rate-employer') {
    updateRatePreview();
  }
}

function onDocumentChange(e) {
  const target = e.target;

  if (target.matches && target.matches('[data-decimal]')) {
    target.value = fmtDecimal(target.value);
    return;
  }

  if (target.matches('[data-bulk-select]')) {
    window.bulkMail.setSelected(target.getAttribute('data-bulk-select'), target.checked);
    return;
  }
  if (target.id === 'bulk-select-all') {
    window.bulkMail.selectVisible(target.checked ? 'all' : 'none');
    return;
  }

  if (target.matches('.cell-input[data-monthly-emp]')) {
    target.dataset.caretEdit = '1';
    handleMonthlyChange(target);
    return;
  }

  if (target.id && target.id.indexOf('auto-backup-') === 0) {
    handleAutoBackupChange(target);
    return;
  }
  if (target.id && target.id.indexOf('notif-') === 0) {
    handleNotifChange(target);
    return;
  }

  const id = target.id;
  if (id === 'year-select' || id === 'set-year') { setYear(target.value); return; }
  if (id === 'employer-status-filter') { ui.employerStatus = target.value; renderCurrentView(); return; }
  if (id === 'employer-sort') { ui.employerSort = target.value; renderCurrentView(); return; }
  if (id === 'monthly-month') { ui.monthlyMonth = target.value; renderCurrentView(); return; }
  if (id === 'situation-month') { ui.situationMonth = target.value; renderCurrentView(); return; }
  if (id === 'insured-employer-filter') { ui.insuredEmployer = target.value; ui.insuredLimit = 500; renderCurrentView(); return; }
  if (id === 'insured-month-filter') { ui.insuredMonth = target.value; ui.insuredLimit = 500; renderCurrentView(); return; }
  if (id === 'journal-employer-filter') { ui.journalEmployer = target.value; renderCurrentView(); return; }
  if (id === 'journal-type-filter') { ui.journalType = target.value; renderCurrentView(); return; }
  if (id === 'journal-alert-filter') { ui.journalAlert = target.value; renderCurrentView(); return; }
  if (id === 'schedule-employer-filter') { ui.scheduleEmployer = target.value; renderCurrentView(); return; }
  if (id === 'schedule-status-filter') { ui.scheduleStatus = target.value; renderCurrentView(); return; }
  if (id === 'set-today-auto') {
    const todayInput = $('#set-today');
    if (todayInput) {
      todayInput.disabled = target.checked;
      if (target.checked) todayInput.value = todayISO();
    }
    return;
  }
  if (id === 'import-file') {
    const file = target.files && target.files[0];
    if (file) importJSONFile(file);
    target.value = '';
    return;
  }
  if (id === 'monthly-import-file') {
    const file = target.files && target.files[0];
    if (file) readMonthlyImportFile(file);
    target.value = '';
  }
}

/* ---------------- Fiabilité : sauvegardes et notifications ---------------- */
function refreshReliabilityUi() {
  if (!window.autoBackup || !window.notifier) return;
  const config = autoBackup.getConfig();
  const status = autoBackup.getStatus();
  const badge = $('#auto-backup-badge');
  if (badge) badge.innerHTML = autoBackupBadgeHtml(config, status);
  const notice = $('#auto-backup-notice');
  if (notice) notice.innerHTML = autoBackupNoticeHtml(config, status);
  const folder = $('#auto-backup-folder');
  if (folder) {
    folder.innerHTML = status.folderName
      ? `Dossier : <strong>${escapeHtml(status.folderName)}</strong>`
      : status.supported ? 'Aucun dossier choisi.' : 'Choix de dossier non disponible dans ce navigateur.';
  }
  const grant = $('#auto-backup-grant');
  if (grant) grant.hidden = status.permission !== 'prompt';
  const next = $('#auto-backup-next');
  if (next) next.textContent = autoBackupNextLabel(config, status);
  const history = autoBackup.getHistory();
  const historyBox = $('#auto-backup-history');
  if (historyBox) historyBox.innerHTML = autoBackupHistoryHtml(history);
  const historySummary = $('#auto-backup-history-summary');
  if (historySummary) historySummary.textContent = `Historique des sauvegardes externes (${history.length})`;
  const notifBadge = $('#notif-badge');
  if (notifBadge) notifBadge.innerHTML = notifBadgeHtml(notifier.getConfig(), notifier.permission());
  const notifPerm = $('#notif-permission');
  if (notifPerm) notifPerm.innerHTML = notifPermissionHtml(notifier.permission());
}

async function handleAutoBackupPick() {
  try {
    const handle = await window.autoBackup.pickDirectory();
    if (!handle) return;
    window.autoBackup.schedule();
    refreshReliabilityUi();
    toast('Dossier de sauvegarde autorisé : ' + handle.name);
  } catch (e) {
    toast(e && e.message ? e.message : 'Choix du dossier impossible.', 'error');
  }
}

async function handleAutoBackupGrant() {
  try {
    const name = await window.autoBackup.grantDirectoryAccess();
    window.autoBackup.schedule();
    refreshReliabilityUi();
    toast('Accès au dossier autorisé : ' + name);
  } catch (e) {
    toast(e && e.message ? e.message : 'Autorisation impossible.', 'error');
    refreshReliabilityUi();
  }
}

async function handleAutoBackupNow() {
  await window.autoBackup.runBackup('manual');
  refreshReliabilityUi();
}

async function handleNotifTest() {
  const result = await window.notifier.test();
  refreshReliabilityUi();
  if (result === 'sent') {
    toast('Notification de test envoyée.');
    return;
  }
  if (result === 'denied') toast('Notifications refusées par le navigateur.', 'error');
  else if (result === 'unsupported') toast('Ce navigateur ne prend pas en charge les notifications.', 'error');
  else toast('La notification n’a pas pu être affichée.', 'error');
}

function handleAutoBackupChange(target) {
  const config = window.autoBackup.getConfig();
  switch (target.id) {
    case 'auto-backup-enabled': {
      config.enabled = target.checked;
      window.autoBackup.saveConfig(config);
      const fieldset = $('#auto-backup-config');
      if (fieldset) fieldset.disabled = !config.enabled;
      break;
    }
    case 'auto-backup-frequency': {
      config.frequency = target.value;
      window.autoBackup.saveConfig(config);
      const weekday = $('#auto-backup-weekday-field');
      if (weekday) weekday.hidden = config.frequency !== 'weekly';
      break;
    }
    case 'auto-backup-time': config.time = target.value; window.autoBackup.saveConfig(config); break;
    case 'auto-backup-weekday': config.dayOfWeek = Number(target.value); window.autoBackup.saveConfig(config); break;
    case 'auto-backup-prefix': config.prefix = target.value; window.autoBackup.saveConfig(config); break;
    case 'auto-backup-keep': config.keepLast = Number(target.value); window.autoBackup.saveConfig(config); break;
    case 'auto-backup-retention': config.retentionDays = Number(target.value); window.autoBackup.saveConfig(config); break;
    case 'auto-backup-download-fallback': config.downloadFallback = target.checked; window.autoBackup.saveConfig(config); break;
    default: return;
  }
  window.autoBackup.schedule();
  refreshReliabilityUi();
}

async function handleNotifChange(target) {
  const config = window.notifier.getConfig();
  if (target.name === 'notif-cat') {
    config.categories[target.value] = target.checked;
    window.notifier.saveConfig(config);
    refreshReliabilityUi();
    return;
  }
  switch (target.id) {
    case 'notif-enabled': {
      config.enabled = target.checked;
      window.notifier.saveConfig(config);
      if (config.enabled) {
        const perm = await window.notifier.requestPermission();
        if (perm !== 'granted') {
          if (perm === 'denied') toast('Notifications bloquées par le navigateur. Autorisez-les dans ses réglages, puis rechargez la page.', 'error');
          else if (perm === 'unsupported') toast('Ce navigateur ne prend pas en charge les notifications.', 'error');
          config.enabled = false;
          window.notifier.saveConfig(config);
          const toggle = $('#notif-enabled');
          if (toggle) toggle.checked = false;
        }
      }
      const fieldset = $('#notif-config');
      if (fieldset) fieldset.disabled = !config.enabled;
      window.notifier.init();
      break;
    }
    case 'notif-schedule-days': config.scheduleDays = Number(target.value); window.notifier.saveConfig(config); window.notifier.updateTabBadge(); break;
    case 'notif-threshold-balance': config.thresholds.balance = num(target.value); window.notifier.saveConfig(config); break;
    case 'notif-threshold-age': config.thresholds.age = Number(target.value); window.notifier.saveConfig(config); break;
    case 'notif-quiet-start': config.quietHours.start = target.value; window.notifier.saveConfig(config); break;
    case 'notif-quiet-end': config.quietHours.end = target.value; window.notifier.saveConfig(config); break;
    default: return;
  }
  refreshReliabilityUi();
}

function initReliabilityModules() {
  if (window.autoBackup) {
    window.autoBackup.init()
      .then(() => { if (ui.route === 'settings') refreshReliabilityUi(); })
      .catch(e => console.warn('Sauvegarde automatique indisponible.', e));
  }
  if (window.notifier) window.notifier.init();
  window.addEventListener('auto-backup-done', () => {
    if (ui.route === 'settings') refreshReliabilityUi();
  });
}

function onDocumentSubmit(e) {
  if (e.target.id === 'settings-form') {
    e.preventDefault();
    handleSettingsSubmit(e.target);
  }
}

let pendingGAt = 0;

function onDocumentKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      exportJSON();
      return;
    }
    if ((e.key === 'k' || e.key === 'K') && !e.target.isContentEditable && !document.querySelector('#modal-root:not([hidden])')) {
      e.preventDefault();
      navigate('employers');
      setTimeout(() => {
        const search = $('#employer-search');
        if (search) { search.focus(); search.select(); }
      }, 60);
      return;
    }
  }
  const isField = e.target && typeof e.target.matches === 'function' && e.target.matches('input, select, textarea, [contenteditable="true"]');
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !isField && !document.querySelector('#modal-root:not([hidden])')) {
    const key = e.key.toLowerCase();
    if (key === 'g') {
      pendingGAt = Date.now();
      return;
    }
    if (pendingGAt && Date.now() - pendingGAt < 1200) {
      if (key === 'd' || key === 'e') {
        e.preventDefault();
        pendingGAt = 0;
        navigate(key === 'd' ? 'dashboard' : 'employers');
        return;
      }
    }
    pendingGAt = 0;
  }
  if (e.target.matches('.cell-input[data-monthly-emp]')) {
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    if (plain && e.key === 'Enter') {
      e.preventDefault();
      focusMonthlyMove(e.target, e.shiftKey ? 'up' : 'down');
      return;
    }
    if (plain && !e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      focusMonthlyMove(e.target, e.key === 'ArrowDown' ? 'down' : 'up');
      return;
    }
    if (plain && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.dataset.caretEdit) {
      e.preventDefault();
      focusMonthlyMove(e.target, e.key === 'ArrowRight' ? 'right' : 'left');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.target.blur();
      return;
    }
  }
  if (e.key === 'Escape') {
    const root = $('#modal-root');
    if (root && !root.hidden && !e.target.closest('input, select, textarea')) closeModal();
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-open-employer]')) {
    e.preventDefault();
    const id = e.target.getAttribute('data-open-employer');
    if (id) openEmployerFiche(id);
  }
}

/* ---------------- Contrôle d'intégrité au démarrage ---------------- */
function startupIssueMessage(issue) {
  if (issue.type === 'json') {
    return 'Le contenu enregistré dans le navigateur est incomplet ou endommagé : il n’a pas pu être relu. L’application démarre sur les données d’origine. <strong>Une copie du contenu illisible a été conservée</strong> et peut être téléchargée ci-dessous.';
  }
  if (issue.type === 'invalid') {
    return `Le contenu enregistré ne respecte pas le format attendu${issue.message ? ` (${escapeHtml(issue.message)})` : ''}. L’application démarre sur les données d’origine. <strong>Une copie du contenu a été conservée</strong>.`;
  }
  if (issue.type === 'newer') {
    return `Les données ont été enregistrées par une version plus récente de l’application (format ${escapeHtml(String(issue.dataVersion))}). Elles n’ont pas été chargées pour éviter une perte d’informations. Utilisez la version récente de l’application, ou restaurez une sauvegarde ci-dessous.`;
  }
  return 'L’empreinte des données a changé depuis le dernier enregistrement (modification externe, arrêt brutal, restauration partielle…). Les données ont été chargées, mais vérifiez les montants affichés avant de continuer.';
}

function showStartupIntegrityIssue() {
  const issue = getStateLoadIssue();
  if (!issue) return;
  clearStateLoadIssue();
  const blocking = issue.type !== 'signature';
  const backups = listLocalBackups().slice(0, 3);
  const canDownload = issue.type !== 'signature' && issue.raw;
  openModal({
    title: 'Contrôle des données enregistrées',
    subtitle: blocking ? 'Une anomalie a été détectée au démarrage' : 'Vérification d’intégrité',
    size: 'modal-lg',
    body: `
      <div class="notice ${blocking ? 'danger' : ''}">${ico('alert')}<div>${startupIssueMessage(issue)}</div></div>
      ${canDownload ? `<p class="quality-help">La copie de sécurité est aussi enregistrée dans le navigateur sous une clé distincte ; elle ne sera pas écrasée par les prochaines modifications.</p>` : ''}
      ${backups.length ? `<h4 style="margin:18px 0 8px">Dernières sauvegardes locales</h4>
        <div class="data-actions">
          ${backups.map(item => `<button class="data-action" type="button" data-restore-integrity="${escapeAttr(item.key)}">
            <span class="da-ico">${ico('refresh')}</span>
            <span><strong>${escapeHtml(backupDateLabel(item))}</strong><span>${item.employerCount != null ? item.employerCount + ' employeurs · ' : ''}${formatBytes(item.bytes)}</span></span>
          </button>`).join('')}
        </div>` : '<p class="quality-help" style="margin-top:14px">Aucune sauvegarde locale n’est disponible. Importez un fichier JSON exporté précédemment.</p>'}
      <input type="file" id="integrity-import-file" accept="application/json,.json" hidden>`,
    footer: `
      ${canDownload ? `<button class="btn" type="button" id="integrity-download">${ico('download')} Télécharger la copie illisible</button>` : ''}
      <button class="btn" type="button" data-close-modal>Fermer</button>
      <button class="btn" type="button" id="integrity-import">${ico('upload')} Importer une sauvegarde JSON</button>
      ${blocking ? '' : '<button class="btn btn-primary" type="button" id="integrity-accept">Accepter les données</button>'}`,
    onMount(modal, close) {
      const downloadBtn = modal.querySelector('#integrity-download');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          downloadFile(`donnees-illisibles-${todayISO()}.json`, issue.raw, 'application/json');
        });
      }
      const importBtn = modal.querySelector('#integrity-import');
      const fileInput = modal.querySelector('#integrity-import-file');
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (file) importJSONFile(file, close);
      });
      const acceptBtn = modal.querySelector('#integrity-accept');
      if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
          saveState();
          close();
          toast('Empreinte des données actualisée.');
        });
      }
      modal.querySelectorAll('[data-restore-integrity]').forEach(button => {
        button.addEventListener('click', () => {
          close();
          restoreLocalBackup(button.getAttribute('data-restore-integrity'));
        });
      });
    }
  });
}

/* ---------------- Démarrage ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  state = loadState();
  applyTheme(loadTheme());
  ui.year = defaultViewYear();
  const versionEl = $('#app-version');
  if (versionEl) versionEl.textContent = 'Version ' + APP_RELEASE;
  state.meta.viewYear = Number(ui.year);
  if (!getStateLoadIssue()) saveState();
  resetMonthSelections();
  bindEvents();
  syncSidebarUi();
  if (!location.hash) {
    try { history.replaceState(null, '', '#/dashboard'); }
    catch (e) { location.hash = '#/dashboard'; }
  }
  renderCurrentView();
  updateStorageStatus();
  initReliabilityModules();
  showStartupIntegrityIssue();
});
