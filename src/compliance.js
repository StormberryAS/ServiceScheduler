;(function () {
  const SB = (globalThis.SB ||= {});
  const D = () => SB.dates;
  const expiringDocuments = (engineers, asOfMs) => {
    const b = { d30: [], d60: [], d90: [] };
    const add = (days, item) => { if (days < 0) return;
      if (days <= 30) b.d30.push(item); else if (days <= 60) b.d60.push(item); else if (days <= 90) b.d90.push(item); };
    for (const e of engineers) {
      for (const p of e.passports) add(D().daysBetween(asOfMs, D().parseISO(p.expiry)),
        { who:e.name, kind:'Passport', detail:`${p.country} ${p.number}`, expiry:p.expiry, days:D().daysBetween(asOfMs, D().parseISO(p.expiry)) });
      for (const v of e.visas) add(D().daysBetween(asOfMs, D().parseISO(v.expiry)),
        { who:e.name, kind:'Visa', detail:v.type ? v.country + ', ' + v.type : v.country, expiry:v.expiry, days:D().daysBetween(asOfMs, D().parseISO(v.expiry)) });
      for (const c of e.certs) add(D().daysBetween(asOfMs, D().parseISO(c.expiry)),
        { who:e.name, kind:'Certificate', detail:c.type, expiry:c.expiry, days:D().daysBetween(asOfMs, D().parseISO(c.expiry)) });
    }
    for (const k of ['d30','d60','d90']) b[k].sort((a, c) => a.days - c.days);
    return b;
  };
  const availabilityOverview = (engineers, asOfMs) =>
    engineers.map((e) => ({ id:e.id, name:e.name, availability: SB.rest.availabilityScore(e, asOfMs) }))
      .filter((x) => x.availability < 0).sort((a, b) => a.availability - b.availability);
  SB.compliance = { expiringDocuments, availabilityOverview };
})();
