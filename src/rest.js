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
  SB.rest = { restDays, restCompleteDate, restDaysBank };
})();
