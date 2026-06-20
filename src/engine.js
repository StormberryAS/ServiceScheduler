;(function () {
  const SB = (globalThis.SB ||= {});
  const reasonFor = (bank, warn) => {
    let r = bank === 0 ? 'Rested and available'
      : `${bank} rest day${bank === 1 ? '' : 's'} remaining, overtime applies`;
    if (warn) r += '; passport nearing the validity limit';
    return r;
  };
  const nextPick = (job, engineers, settings) => {
    const startMs = SB.dates.parseISO(job.startDate);
    const shortlist = [], excluded = [];
    for (const e of engineers) {
      const ev = SB.eligibility.evaluate(e, job, settings);
      if (!ev.eligible) { excluded.push({ id: e.id, name: e.name, failedRule: ev.failedRule }); continue; }
      const bank = SB.rest.restDaysBank(e, startMs);
      shortlist.push({ id: e.id, name: e.name, restDaysBank: bank, overtime: bank > 0,
        passportWarning: ev.passportWarning, reason: reasonFor(bank, ev.passportWarning) });
    }
    shortlist.sort((a, b) => a.restDaysBank - b.restDaysBank || a.name.localeCompare(b.name));
    return { shortlist, excluded };
  };
  SB.engine = { nextPick };
})();
