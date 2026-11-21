/* ============================================================
   Lecture des classeurs Excel (SheetJS) — aide à l'import
   ============================================================ */

window.excelTools = (function () {
  function normalizeKey(value) {
    return String(value == null ? '' : value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function mapMonthlyColumns(headers) {
    const keys = (headers || []).map(normalizeKey);
    const find = aliases => keys.findIndex(key => aliases.includes(key));
    const registration = keys.findIndex(key => key.includes('immatriculation') || key === 'matricule' || key === 'n employeur' || key === 'numero employeur');
    let month = keys.findIndex(key => key === 'mois' || key === 'periode');
    if (month < 0) month = keys.findIndex(key => key.includes('mois') && !key.includes('montant'));
    const due = find(['du global', 'du global saisi', 'du', 'montant du', 'cotisations dues', 'cotisation due', 'du cotisations']);
    const collected = find(['encaisse', 'encaissement', 'encaissements', 'montant encaisse', 'recouvre', 'montant recouvre', 'paye', 'versements']);
    const effectif = find(['effectif', 'effectifs', 'effectif total', 'nombre employes', 'nb employes', 'nombre d employes']);
    return { registration, month, due, collected, effectif };
  }

  function isMonthlyHeader(row) {
    const columns = mapMonthlyColumns(row);
    return columns.registration >= 0 && columns.month >= 0 && (columns.due >= 0 || columns.collected >= 0);
  }

  function findMonthlyHeaderRow(rows, limit) {
    const max = Math.min(rows.length, limit == null ? 15 : limit);
    for (let i = 0; i < max; i += 1) {
      if (isMonthlyHeader(rows[i])) return i;
    }
    return -1;
  }

  function cellValue(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
    }
    return value;
  }

  function cellText(value) {
    const v = cellValue(value);
    return v == null ? '' : String(v).trim();
  }

  function sheetRows(worksheet) {
    if (!worksheet || typeof XLSX === 'undefined') return [];
    return XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '', blankrows: false });
  }

  function monthlyCandidates(workbook) {
    if (!workbook || !Array.isArray(workbook.SheetNames)) return [];
    const candidates = [];
    workbook.SheetNames.forEach(name => {
      const rows = sheetRows(workbook.Sheets[name]);
      if (rows.length < 2) return;
      const headerIndex = findMonthlyHeaderRow(rows);
      if (headerIndex < 0 || headerIndex >= rows.length - 1) return;
      const header = rows[headerIndex].map(cellText);
      const body = rows.slice(headerIndex + 1)
        .map(row => row.map(cellValue))
        .filter(row => row.some(value => cellText(value) !== ''));
      if (!body.length) return;
      candidates.push({ sheet: name, headerIndex, rows: [header].concat(body) });
    });
    return candidates;
  }

  return {
    normalizeKey,
    mapMonthlyColumns,
    isMonthlyHeader,
    findMonthlyHeaderRow,
    cellValue,
    cellText,
    sheetRows,
    monthlyCandidates
  };
})();
