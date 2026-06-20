;(function () {
  const SB = (globalThis.SB ||= {});
  const reasonFor = (av, warn) => {
    let r;
    if (av >= 900) r = 'Available';
    else if (av > 0) r = `Available, idle ${av} day${av === 1 ? '' : 's'}`;
    else if (av === 0) r = 'Available now';
    else r = `${-av} rest day${-av === 1 ? '' : 's'} remaining, overtime applies`;
    if (warn) r += '; passport nearing the validity limit';
    return r;
  };
  const nextPick = (job, engineers, settings) => {
    const startMs = SB.dates.parseISO(job.startDate);
    const shortlist = [], excluded = [];
    for (const e of engineers) {
      const ev = SB.eligibility.evaluate(e, job, settings);
      if (!ev.eligible) { excluded.push({ id: e.id, name: e.name, failedRule: ev.failedRule }); continue; }
      const av = SB.rest.availabilityScore(e, startMs);
      shortlist.push({ id: e.id, name: e.name, availability: av, overtime: av < 0,
        passportWarning: ev.passportWarning, reason: reasonFor(av, ev.passportWarning) });
    }
    shortlist.sort((a, b) => b.availability - a.availability || a.name.localeCompare(b.name));
    return { shortlist, excluded };
  };
  SB.engine = { nextPick };
})();
