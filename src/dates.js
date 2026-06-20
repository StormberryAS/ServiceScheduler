;(function () {
  const SB = (globalThis.SB ||= {});
  const MS_DAY = 86400000;
  const parseISO = (s) => { const [y,m,d] = s.split('-').map(Number); return Date.UTC(y, m-1, d); };
  const formatISO = (ms) => { const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`; };
  const addDays = (ms, n) => ms + n * MS_DAY;
  const addMonths = (ms, n) => { const d = new Date(ms); d.setUTCMonth(d.getUTCMonth()+n); return d.getTime(); };
  const daysBetween = (a, b) => Math.round((b - a) / MS_DAY);
  const today = () => { const n = new Date(); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()); };
  SB.dates = { parseISO, formatISO, addDays, addMonths, daysBetween, today, MS_DAY };
})();
