/* ============================================================
   Graphiques de tendance — SVG autonomes, sans dépendance externe
   ============================================================ */

function chartCompact(value) {
  return typeof fmtCompact === 'function' ? fmtCompact(value) : fmtNum(value);
}

function chartEmpty(detail) {
  return `<div class="chart-empty"><div><strong>Aucune donnée sur la période</strong>${escapeHtml(detail)}</div></div>`;
}

function chartMonthLabel(monthKey) {
  const month = Number(String(monthKey).slice(5, 7));
  return MONTHS_SHORT[Math.max(0, Math.min(11, month - 1))];
}

function chartScale(values) {
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) max = min + 1;
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;
  return { min, max };
}

function balanceTrendChart(stats, months) {
  const W = 780;
  const H = 260;
  const padL = 62;
  const padR = 18;
  const padT = 18;
  const padB = 34;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  let running = stats.reduce((sum, stat) => sum + num(stat.priorBalance), 0);
  const values = months.map(month => {
    running += stats.reduce((sum, stat) => sum + num(stat.months[month].balance), 0);
    return { month, value: running };
  });
  const hasData = values.some(item => item.value !== 0);
  const bounds = chartScale(values.map(item => item.value));
  const zeroY = padT + ((bounds.max - 0) / (bounds.max - bounds.min)) * chartH;
  const xAt = index => padL + (chartW * (index + 0.5)) / values.length;
  const yAt = value => padT + ((bounds.max - value) / (bounds.max - bounds.min)) * chartH;

  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const value = bounds.min + ((bounds.max - bounds.min) * i) / 4;
    const y = yAt(value);
    grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`;
    grid += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" fill="var(--muted)" font-size="9">${chartCompact(value)}</text>`;
  }

  const points = values.map((item, index) => ({ x: xAt(index), y: yAt(item.value), item }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L${points[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
  const dots = points.map(point => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.8" fill="var(--primary)" stroke="var(--surface)" stroke-width="1.4">
      <title>${monthLong(point.item.month)} — Solde cumulé : ${fmtMoney(point.item.value)}</title>
    </circle>`).join('');
  const labels = points.map(point => `<text x="${point.x.toFixed(1)}" y="${H - 12}" text-anchor="middle" fill="var(--muted)" font-size="9">${chartMonthLabel(point.item.month)}</text>`).join('');

  return `<div class="chart-box">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du solde cumulé sur l’année">
      <title>Solde cumulé à la fin de chaque mois</title>
      ${grid}
      <line x1="${padL}" y1="${zeroY}" x2="${W - padR}" y2="${zeroY}" stroke="var(--line-strong)" stroke-width="1" stroke-dasharray="4 3"/>
      <path d="${area}" fill="var(--primary)" fill-opacity=".11" stroke="none"/>
      <path d="${line}" fill="none" stroke="var(--primary)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${labels}
    </svg>
    ${hasData ? '' : chartEmpty('Saisissez les cotisations dues et les encaissements dans « Suivi mensuel ».')}
  </div>`;
}

function recoveryRateChart(stats, months) {
  const W = 780;
  const H = 260;
  const padL = 50;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const groupW = chartW / months.length;
  const barW = Math.min(20, Math.max(6, groupW * 0.42));
  const series = months.map(month => {
    const due = stats.reduce((sum, stat) => sum + num(stat.months[month].dueRetained), 0);
    const collected = stats.reduce((sum, stat) => sum + num(stat.months[month].collected), 0);
    return { month, due, collected, rate: due > 0 ? Math.max(0, Math.min(1, collected / due)) : null };
  });
  const hasData = series.some(item => item.due > 0);
  const grid = [0, 25, 50, 75, 100].map(percent => {
    const y = padT + chartH - (percent / 100) * chartH;
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--line)" stroke-width="1"/>
      <text x="${padL - 8}" y="${y + 3}" text-anchor="end" fill="var(--muted)" font-size="9">${percent} %</text>`;
  }).join('');
  const bars = series.map((item, index) => {
    const cx = padL + groupW * index + groupW / 2;
    const height = item.rate == null ? 0 : item.rate * chartH;
    const y = padT + chartH - height;
    const color = item.rate == null ? 'var(--line-strong)' : item.rate >= 0.8 ? 'var(--green)' : item.rate >= 0.5 ? 'var(--amber)' : 'var(--red)';
    const title = item.due > 0
      ? `${monthLong(item.month)} — ${fmtPct(item.rate)} (encaissé ${fmtMoney(item.collected)} sur ${fmtMoney(item.due)})`
      : `${monthLong(item.month)} — aucun dû saisi`;
    return `<g>
      <rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, height).toFixed(1)}" rx="3" fill="${color}">
        <title>${title}</title>
      </rect>
      <text x="${cx.toFixed(1)}" y="${H - 12}" text-anchor="middle" fill="var(--muted)" font-size="9">${chartMonthLabel(item.month)}</text>
    </g>`;
  }).join('');
  const threshold = padT + chartH - 0.8 * chartH;

  return `<div class="chart-box">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Taux de recouvrement mois par mois">
      <title>Taux de recouvrement mensuel</title>
      ${grid}
      <line x1="${padL}" y1="${threshold}" x2="${W - padR}" y2="${threshold}" stroke="var(--green)" stroke-width="1" stroke-dasharray="4 4" opacity=".55"/>
      ${bars}
    </svg>
    ${hasData ? '' : chartEmpty('Le taux apparaîtra dès qu’un montant dû sera saisi pour un mois.')}
  </div>`;
}

function topDebtorsChart(stats, limit = 8) {
  const debtors = stats
    .filter(stat => num(stat.totalBalance) > 0)
    .sort((a, b) => b.totalBalance - a.totalBalance)
    .slice(0, limit);
  const W = 780;
  const rowH = 31;
  const top = 12;
  const bottom = 8;
  const H = top + bottom + Math.max(1, debtors.length) * rowH;
  const labelX = 8;
  const barX = 224;
  const amountW = 86;
  const barMax = W - barX - amountW - 8;
  const max = Math.max(1, ...debtors.map(stat => stat.totalBalance));
  const rows = debtors.map((stat, index) => {
    const y = top + index * rowH;
    const width = Math.max(2, (stat.totalBalance / max) * barMax);
    const name = truncate(stat.emp.name, 30);
    return `<g>
      <text x="${labelX}" y="${y + 14}" fill="var(--ink-2)" font-size="10.5">${escapeHtml(name)}</text>
      <rect x="${barX}" y="${y + 4}" width="${barMax}" height="13" rx="6.5" fill="var(--surface-3)" opacity=".7"/>
      <rect x="${barX}" y="${y + 4}" width="${width.toFixed(1)}" height="13" rx="6.5" fill="var(--primary)">
        <title>${escapeHtml(stat.emp.name)} — ${fmtMoney(stat.totalBalance)}</title>
      </rect>
      <text x="${W - 8}" y="${y + 14}" text-anchor="end" fill="var(--red)" font-size="10.5" font-weight="700">${fmtNum(stat.totalBalance)}</text>
    </g>`;
  }).join('');

  return `<div class="chart-box">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Employeurs ayant le solde impayé le plus élevé">
      <title>Principaux soldes impayés</title>
      ${rows}
    </svg>
    ${debtors.length ? '' : chartEmpty('Aucun solde impayé à afficher.')}
  </div>`;
}

window.trendCharts = {
  balance: balanceTrendChart,
  recovery: recoveryRateChart,
  topDebtors: topDebtorsChart
};
