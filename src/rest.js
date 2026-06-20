;(function () {
  const SB = (globalThis.SB ||= {});
  // settings.restMultiplier (default 1) scales the trip length to compute rest days.
  // settings.minRestDays (default 0) provides a floor.
  // restDaysOverride always wins when set.
  const restDays = (e, settings = {}) => {
    const a = e.availability || {};
    if (a.restDaysOverride != null) return a.restDaysOverride;
    const base = a.lastOffshore ? a.lastOffshore.durationDays : 0;
    return Math.max(settings.minRestDays || 0, Math.round(base * (settings.restMultiplier || 1)));
  };
  const restCompleteDate = (e, settings = {}) => {
    const a = e.availability || {};
    if (!a.lastOffshore) return null;
    return SB.dates.addDays(SB.dates.parseISO(a.lastOffshore.end), restDays(e, settings));
  };
  const restDaysBank = (e, refMs, settings = {}) => {
    const rc = restCompleteDate(e, settings);
    return rc == null ? 0 : Math.max(0, SB.dates.daysBetween(refMs, rc));
  };
  // Signed availability: negative = rest days still owed (e.g. -8), 0 = available today,
  // positive = days available since rest completed. No offshore history = long-available (999).
  const availabilityScore = (e, refMs, settings = {}) => {
    const rc = restCompleteDate(e, settings);
    if (rc == null) return 999;
    return SB.dates.daysBetween(rc, refMs);
  };
  SB.rest = { restDays, restCompleteDate, restDaysBank, availabilityScore };
})();
