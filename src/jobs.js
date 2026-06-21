// src/jobs.js
// First-class job records are the source of truth for who is assigned to what.
// Each engineer's `assignments` list is a derived projection of these jobs, kept in
// sync so eligibility (double-booking) and the schedule view keep working unchanged.
;(function () {
  const SB = (globalThis.SB ||= {});

  const emptyNotes = () => ({ customer: '', contact: '', phone: '', email: '', text: '' });

  // Smallest 'jN' identifier not already used by the given jobs. Deterministic (testable).
  const nextJobId = (jobs) => {
    const used = new Set((jobs || []).map((j) => j.id));
    let n = 1;
    while (used.has('j' + n)) n++;
    return 'j' + n;
  };

  const assignmentKey = (a) => [a.jobTitle, a.country, a.start, a.end].join('||');
  const jobSpecKey = (s) => [s.title, s.equipment, s.repairType, s.country, s.start, s.end].join('||');

  // Reconstruct first-class jobs from engineers' legacy assignment lists. Assignments
  // that share title+country+start+end collapse into one job. Used to migrate old files
  // and to seed jobs for the demo roster.
  const fromAssignments = (engineers) => {
    const byKey = new Map();
    for (const e of engineers || []) {
      for (const a of e.assignments || []) {
        const k = assignmentKey(a);
        if (!byKey.has(k)) {
          byKey.set(k, {
            id: '', title: a.jobTitle || '', equipment: a.equipment || '', repairType: a.repairType || '',
            country: a.country || '', start: a.start, end: a.end, engineerIds: [], notes: emptyNotes(),
          });
        }
        const job = byKey.get(k);
        if (!job.engineerIds.includes(e.id)) job.engineerIds.push(e.id);
      }
    }
    const jobs = [...byKey.values()];
    jobs.forEach((j, i) => { j.id = 'j' + (i + 1); });
    return jobs;
  };

  // Rebuild each engineer's derived assignment list from the jobs (jobs are authoritative).
  const syncAssignments = (engineers, jobs) => {
    for (const e of engineers || []) {
      e.assignments = (jobs || [])
        .filter((j) => j.engineerIds.includes(e.id))
        .map((j) => ({ jobId: j.id, jobTitle: j.title, country: j.country, start: j.start, end: j.end }));
    }
    return engineers;
  };

  // Find a job matching the full spec (title+equipment+repairType+country+dates); create it
  // if absent. Then add the engineer if not already on it. Returns the new jobs array and jobId.
  const assignToJob = (jobs, spec, engineerId) => {
    const list = jobs ? jobs.map((j) => ({ ...j, engineerIds: [...j.engineerIds] })) : [];
    let job = list.find((j) => jobSpecKey(j) === jobSpecKey(spec));
    if (!job) {
      job = {
        id: nextJobId(list), title: spec.title || '', equipment: spec.equipment || '',
        repairType: spec.repairType || '', country: spec.country || '', start: spec.start, end: spec.end,
        engineerIds: [], notes: emptyNotes(),
      };
      list.push(job);
    }
    if (!list.find((j) => j.id === job.id).engineerIds.includes(engineerId)) {
      list.find((j) => j.id === job.id).engineerIds.push(engineerId);
    }
    return { jobs: list, jobId: job.id };
  };

  const addEngineerToJob = (jobs, jobId, engineerId) =>
    (jobs || []).map((j) => j.id === jobId && !j.engineerIds.includes(engineerId)
      ? { ...j, engineerIds: [...j.engineerIds, engineerId] }
      : j);

  const removeEngineerFromJob = (jobs, jobId, engineerId) =>
    (jobs || []).map((j) => j.id === jobId
      ? { ...j, engineerIds: j.engineerIds.filter((id) => id !== engineerId) }
      : j);

  const deleteJob = (jobs, jobId) => (jobs || []).filter((j) => j.id !== jobId);

  SB.jobs = {
    emptyNotes, nextJobId, fromAssignments, syncAssignments,
    assignToJob, addEngineerToJob, removeEngineerFromJob, deleteJob,
  };
})();
