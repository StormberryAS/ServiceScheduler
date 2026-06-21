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
  // Returns the highest competence level for the job's equipment + repairType combination.
  // Entries that match but carry no level are treated as level 1.
  const competenceLevel = (e, job) => {
    const matches = e.competence.filter((c) => c.equipment === job.equipment && c.repairType === job.repairType);
    if (!matches.length) return 0;
    return Math.max(...matches.map((c) => c.level ?? 1));
  };
  // Keep only values that are real, known certificate types. Guards against non-cert
  // controls (e.g. the Offshore checkbox, whose browser default value is "on") leaking
  // into a job's requiredCerts and excluding every engineer. Dedupes, preserves order.
  const filterKnownCerts = (values, certTypes) => {
    const known = new Set(certTypes || []);
    const seen = new Set();
    const out = [];
    for (const v of values || []) {
      if (known.has(v) && !seen.has(v)) { seen.add(v); out.push(v); }
    }
    return out;
  };
  const nextPick = (job, engineers, settings) => {
    const startMs = SB.dates.parseISO(job.startDate);
    const shortlist = [], excluded = [];
    for (const e of engineers) {
      const ev = SB.eligibility.evaluate(e, job, settings);
      if (!ev.eligible) { excluded.push({ id: e.id, name: e.name, failedRule: ev.failedRule }); continue; }
      const av = SB.rest.availabilityScore(e, startMs, settings);
      const level = competenceLevel(e, job);
      shortlist.push({ id: e.id, name: e.name, availability: av, overtime: av < 0,
        passportWarning: ev.passportWarning, reason: reasonFor(av, ev.passportWarning), level });
    }
    // Sort: competence level DESC, then availability score DESC, then name ASC.
    shortlist.sort((a, b) => b.level - a.level || b.availability - a.availability || a.name.localeCompare(b.name));
    return { shortlist, excluded };
  };
  SB.engine = { nextPick, filterKnownCerts };
})();
