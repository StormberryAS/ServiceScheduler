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
  const toDisplay = (iso) => { if (!iso || typeof iso !== 'string') return ''; const [y,m,d] = iso.split('-'); if (!y || !m || !d) return ''; return `${d}/${m}/${y}`; };
  const fromDisplay = (s) => { if (!s || typeof s !== 'string') return ''; const [d,m,y] = s.split('/'); if (!d || !m || !y) return ''; return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; };
  SB.dates = { parseISO, formatISO, addDays, addMonths, daysBetween, today, toDisplay, fromDisplay, MS_DAY };
})();
