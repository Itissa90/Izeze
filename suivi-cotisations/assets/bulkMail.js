/* ============================================================
   Courriers groupés : sélection d’employeurs et aperçu avant impression
   ============================================================ */

window.bulkMail = (function () {
  const selected = new Set();
  const TYPE_LABELS = {
    rappel: 'Rappel simple',
    relance: 'Relance amiable',
    mise: 'Mise en demeure'
  };

  function isSelected(employerId) {
    return selected.has(employerId);
  }

  function setSelected(employerId, checked) {
    if (!employerId) return;
    if (checked) selected.add(employerId);
    else selected.delete(employerId);
    syncToolbar();
  }

  function clear() {
    selected.clear();
    syncToolbar();
  }

  function count() {
    return selected.size;
  }

  function selectedStats() {
    const { stats } = buildStats();
    return stats
      .filter(stat => selected.has(stat.emp.id) && num(stat.totalBalance) > 0)
      .sort((a, b) => a.emp.name.localeCompare(b.emp.name, 'fr'));
  }

  function visibleRows() {
    return $$('#employers-tbody tr[data-bulk-row]');
  }

  function selectVisible(mode) {
    selected.clear();
    if (mode === 'none') {
      syncToolbar();
      return;
    }
    visibleRows().forEach(row => {
      const checkbox = row.querySelector('[data-bulk-select]');
      if (!checkbox || checkbox.disabled) return;
      const id = row.getAttribute('data-bulk-row');
      if (mode === 'critical' && row.getAttribute('data-risk-level') !== 'critical') return;
      selected.add(id);
    });
    syncToolbar();
  }

  function syncToolbar() {
    if (state && Array.isArray(state.employers)) {
      const debtors = new Set(
        buildStats().stats.filter(stat => num(stat.totalBalance) > 0).map(stat => stat.emp.id)
      );
      Array.from(selected).forEach(id => {
        if (!debtors.has(id)) selected.delete(id);
      });
    }
    const rows = visibleRows();
    const enabled = rows
      .map(row => row.querySelector('[data-bulk-select]'))
      .filter(box => box && !box.disabled);
    let checkedVisible = 0;
    enabled.forEach(box => {
      const on = selected.has(box.getAttribute('data-bulk-select'));
      box.checked = on;
      if (on) checkedVisible += 1;
    });
    const all = enabled.length > 0 && checkedVisible === enabled.length;
    const header = $('#bulk-select-all');
    if (header) {
      header.checked = all;
      header.indeterminate = checkedVisible > 0 && !all;
      header.disabled = enabled.length === 0;
    }
    const countEl = $('#bulk-count');
    if (countEl) {
      countEl.textContent = count() === 0
        ? 'Aucun employeur sélectionné'
        : `${count()} ${plural(count(), 'employeur sélectionné', 'employeurs sélectionnés')}`;
    }
    ['bulk-preview', 'bulk-clear'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = count() === 0;
    });
  }

  function typeFromToolbar() {
    const select = $('#bulk-letter-type');
    const value = select ? select.value : 'relance';
    return TYPE_LABELS[value] ? value : 'relance';
  }

  function preview() {
    const list = selectedStats();
    if (!list.length) {
      toast('Sélectionnez au moins un employeur ayant un solde impayé.', 'error');
      return;
    }
    const { year } = buildStats();
    let letterType = typeFromToolbar();
    const typeOptions = Object.keys(TYPE_LABELS)
      .map(key => `<option value="${key}"${key === letterType ? ' selected' : ''}>${TYPE_LABELS[key]}</option>`)
      .join('');
    const body = `
      <div class="bulk-preview-controls letter-controls no-print">
        <label for="bulk-modal-type">Type de courrier</label>
        <select class="select" id="bulk-modal-type">${typeOptions}</select>
        <span class="letter-hint">${list.length} ${plural(list.length, 'courrier sera imprimé', 'courriers seront imprimés')}, un par page.</span>
      </div>
      <div class="bulk-preview-summary no-print">
        <strong>${list.length} ${plural(list.length, 'destinataire', 'destinataires')}</strong>
        <span>Solde cumulé concerné : ${fmtMoney(list.reduce((sum, stat) => sum + Math.max(0, stat.totalBalance), 0))}</span>
      </div>
      <div class="bulk-letters" id="bulk-letters">
        ${list.map(stat => `<article class="letter-paper bulk-letter-paper" data-bulk-paper="${escapeAttr(stat.emp.id)}">
          ${buildEmployerLetterHtml(stat, year, letterType)}
        </article>`).join('')}
      </div>`;
    openModal({
      title: 'Courriers groupés',
      subtitle: `${list.length} ${plural(list.length, 'courrier prêt', 'courriers prêts')} à imprimer`,
      size: 'modal-xl',
      body,
      footer: `
        <button class="btn" type="button" data-close-modal>Fermer</button>
        <button class="btn btn-primary" type="button" id="bulk-preview-print">${ico('printer')} Imprimer tout</button>`,
      onMount(modal) {
        const select = modal.querySelector('#bulk-modal-type');
        const byId = new Map(list.map(stat => [stat.emp.id, stat]));
        select.addEventListener('change', () => {
          const next = TYPE_LABELS[select.value] ? select.value : 'relance';
          if (next === letterType) return;
          letterType = next;
          modal.querySelectorAll('[data-bulk-paper]').forEach(paper => {
            const stat = byId.get(paper.getAttribute('data-bulk-paper'));
            if (stat) paper.innerHTML = buildEmployerLetterHtml(stat, year, letterType);
          });
          const subtitle = modal.querySelector('.modal-head p');
          if (subtitle) subtitle.textContent = `${list.length} ${plural(list.length, 'courrier prêt', 'courriers prêts')} · ${TYPE_LABELS[letterType]}`;
        });
        modal.querySelector('#bulk-preview-print').addEventListener('click', () => runPrint('print-letter'));
      }
    });
  }

  return {
    isSelected,
    setSelected,
    selectVisible,
    clear,
    count,
    syncToolbar,
    preview
  };
})();
