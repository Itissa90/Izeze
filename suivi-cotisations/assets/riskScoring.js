/* ============================================================
   Score de risque de recouvrement
   ============================================================ */

const RISK_LEVELS = {
  balanced: { key: 'balanced', label: 'Soldé', tone: 'green', min: 0, advice: 'Aucun solde impayé : aucun risque de recouvrement.' },
  low: { key: 'low', label: 'Faible', tone: 'green', min: 0, advice: 'Suivi standard ; aucune action particulière n’est nécessaire.' },
  medium: { key: 'medium', label: 'Modéré', tone: 'amber', min: 31, advice: 'Surveillez ce dossier et programmez une relance si le solde ne baisse pas.' },
  high: { key: 'high', label: 'Élevé', tone: 'orange', min: 61, advice: 'Relance prioritaire recommandée, par téléphone puis par courrier.' },
  critical: { key: 'critical', label: 'Critique', tone: 'red', min: 81, advice: 'Mise en demeure recommandée ; envisagez un échéancier ou un contentieux.' }
};

const RISK_FACTORS = [
  { key: 'age', label: 'Ancienneté de la dette', weight: 25 },
  { key: 'regularity', label: 'Régularité des paiements', weight: 25 },
  { key: 'schedules', label: 'Respect des échéanciers', weight: 20 },
  { key: 'trend', label: 'Tendance du solde', weight: 15 },
  { key: 'recovery', label: 'Taux de recouvrement', weight: 15 }
];

function riskClamp(value) {
  return Math.max(0, Math.min(100, Math.round(num(value))));
}

function riskLevelFor(score) {
  const value = riskClamp(score);
  if (value > 80) return RISK_LEVELS.critical;
  if (value > 60) return RISK_LEVELS.high;
  if (value > 30) return RISK_LEVELS.medium;
  return RISK_LEVELS.low;
}

function riskScheduleScore(employerId) {
  if (!state || !Array.isArray(state.schedules) || !employerId) return 0;
  const list = state.schedules.filter(item => item.employerId === employerId);
  if (!list.length) return 0;
  const overdue = list.filter(item => scheduleStats(item).status === 'En retard').length;
  return riskClamp((overdue / list.length) * 100);
}

function riskTrendScore(months) {
  const active = Object.values(months || {})
    .filter(item => num(item.dueRetained) > 0 || num(item.collected) > 0)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (!active.length) return 0;
  const recent = active.slice(-3).reduce((sum, item) => sum + num(item.balance), 0);
  const previous = active.slice(-6, -3).reduce((sum, item) => sum + num(item.balance), 0);
  if (active.length <= 3) return recent > 0 ? 50 : 0;
  if (previous <= 0) return recent > 0 ? 70 : 0;
  return riskClamp(50 + ((recent - previous) / Math.abs(previous)) * 50);
}

function riskCompute(stat) {
  if (!stat) {
    return { score: 0, level: RISK_LEVELS.balanced, balanced: true, factors: [], employerId: '' };
  }
  const employerId = stat.emp ? stat.emp.id : '';
  const months = stat.months || {};
  const monthList = Object.values(months).sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const dueMonths = monthList.filter(item => num(item.dueRetained) > 0);
  const paidMonths = dueMonths.filter(item => num(item.collected) > 0);
  const age = stat.ageDays == null ? 0 : riskClamp((num(stat.ageDays) / 365) * 100);
  const regularity = dueMonths.length
    ? riskClamp((1 - paidMonths.length / dueMonths.length) * 100)
    : 0;
  const schedules = riskScheduleScore(employerId);
  const trend = riskTrendScore(months);
  const totalDue = num(stat.due) + num(stat.priorDue);
  const totalCollected = num(stat.collected) + num(stat.priorCollected);
  const recovery = totalDue > 0 ? riskClamp((1 - totalCollected / totalDue) * 100) : 0;
  const values = { age, regularity, schedules, trend, recovery };
  const factors = RISK_FACTORS.map(factor => Object.assign({}, factor, { value: values[factor.key] }));
  const balanced = num(stat.totalBalance) <= 0;
  const score = balanced
    ? 0
    : riskClamp(factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0) / 100);
  const level = balanced ? RISK_LEVELS.balanced : riskLevelFor(score);

  return {
    employerId,
    score,
    level,
    balanced,
    factors,
    totalBalance: num(stat.totalBalance),
    ageDays: stat.ageDays == null ? null : num(stat.ageDays),
    dueMonths: dueMonths.length,
    paidMonths: paidMonths.length
  };
}

function riskDistribution(list) {
  const counts = { low: 0, medium: 0, high: 0, critical: 0, balanced: 0 };
  list.forEach(item => {
    const key = item.level ? item.level.key : 'low';
    counts[key] = (counts[key] || 0) + 1;
  });
  const total = list.length || 1;
  return ['critical', 'high', 'medium', 'low', 'balanced'].map(key => ({
    key,
    label: RISK_LEVELS[key].label,
    tone: RISK_LEVELS[key].tone,
    count: counts[key],
    share: counts[key] / total
  }));
}

function riskTop(list, limit = 5) {
  return list
    .filter(item => !item.balanced && item.score > 0)
    .sort((a, b) => b.score - a.score || b.totalBalance - a.totalBalance)
    .slice(0, limit);
}

function riskAnalyze(stats) {
  const list = (stats || []).map(riskCompute);
  const byId = new Map(list.map(item => [item.employerId, item]));
  return {
    list,
    byId,
    distribution: riskDistribution(list),
    top: riskTop(list, 5)
  };
}

window.riskScoring = {
  LEVELS: RISK_LEVELS,
  FACTORS: RISK_FACTORS,
  levelFor: riskLevelFor,
  compute: riskCompute,
  analyze: riskAnalyze,
  distribution: riskDistribution,
  top: riskTop
};
