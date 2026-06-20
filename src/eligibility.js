;(function () {
  const SB = (globalThis.SB ||= {});
  const D = () => SB.dates;
  const jobEndMs = (job) => D().addDays(D().parseISO(job.startDate), job.durationDays - 1);

  const hasCompetence = (e, job) =>
    e.competence.some((c) => c.equipment === job.equipment && c.repairType === job.repairType);

  const usablePassports = (e, job, settings) => {
    const cutoff = D().addMonths(jobEndMs(job), settings.passportInvalidMonths);
    return e.passports.filter((p) => D().parseISO(p.expiry) >= cutoff);
  };
  const travel = (e, job, settings) => {
    if (e.nationalities.includes(job.country)) return { ok: true };
    if (usablePassports(e, job, settings).length === 0) return { ok: false, rule: 'no-valid-passport' };
    const end = jobEndMs(job);
    const visa = e.visas.find((v) => v.country === job.country && D().parseISO(v.expiry) >= end);
    return visa ? { ok: true } : { ok: false, rule: 'needs-visa' };
  };
  const certsOk = (e, job) => {
    const end = jobEndMs(job);
    // Required certificates are exactly what the job asks for. The next-pick form pre-ticks the
    // offshore certs (settings.offshoreRequiredCerts) as sensible, removable defaults, so an empty
    // list deliberately means no certificate filter.
    return job.requiredCerts.every((t) => e.certs.some((c) => c.type === t && D().parseISO(c.expiry) >= end));
  };
  const onVacation = (e, job) => {
    const s = D().parseISO(job.startDate), end = jobEndMs(job);
    return (e.availability.vacations || []).some((v) => D().parseISO(v.start) <= end && D().parseISO(v.end) >= s);
  };
  // An engineer is double-booked if any existing assignment overlaps the job window [start, end] inclusive.
  const isDoubleBooked = (e, job) => {
    const s = D().parseISO(job.startDate), end = jobEndMs(job);
    return (e.assignments || []).some((a) => D().parseISO(a.start) <= end && D().parseISO(a.end) >= s);
  };
  const passportWarning = (e, job, settings) => {
    const usable = usablePassports(e, job, settings);
    if (!usable.length) return false;
    const warn = D().addMonths(jobEndMs(job), settings.passportBufferMonths);
    return usable.every((p) => D().parseISO(p.expiry) < warn);
  };

  // Hard-filter order: competence -> travel -> certs -> vacation -> double-booked.
  const evaluate = (e, job, settings) => {
    if (!hasCompetence(e, job)) return { eligible: false, failedRule: 'no-competence', passportWarning: false };
    const t = travel(e, job, settings);
    if (!t.ok) return { eligible: false, failedRule: t.rule, passportWarning: false };
    if (!certsOk(e, job)) return { eligible: false, failedRule: 'cert-missing-or-expired', passportWarning: false };
    if (onVacation(e, job)) return { eligible: false, failedRule: 'on-vacation', passportWarning: false };
    if (isDoubleBooked(e, job)) return { eligible: false, failedRule: 'double-booked', passportWarning: false };
    return { eligible: true, failedRule: null, passportWarning: passportWarning(e, job, settings) };
  };
  SB.eligibility = { evaluate, jobEndMs };
})();
