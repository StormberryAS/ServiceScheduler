;(function () {
  const SB = (globalThis.SB ||= {});
  const restDays = (e) => {
    const a = e.availability || {};
    if (a.restDaysOverride != null) return a.restDaysOverride;
    return a.lastOffshore ? a.lastOffshore.durationDays : 0;
  };
  const restCompleteDate = (e) => {
    const a = e.availability || {};
    if (!a.lastOffshore) return null;
    return SB.dates.addDays(SB.dates.parseISO(a.lastOffshore.end), restDays(e));
  };
  const restDaysBank = (e, refMs) => {
    const rc = restCompleteDate(e);
    return rc == null ? 0 : Math.max(0, SB.dates.daysBetween(refMs, rc));
  };
  // Signed availability: negative = rest days still owed (e.g. -8), 0 = available today,
  // positive = days available since rest completed. No offshore history = long-available (999).
  const availabilityScore = (e, refMs) => {
    const rc = restCompleteDate(e);
    if (rc == null) return 999;
    return SB.dates.daysBetween(rc, refMs);
  };
  SB.rest = { restDays, restCompleteDate, restDaysBank, availabilityScore };
})();
