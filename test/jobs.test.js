import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/jobs.js';
const { nextJobId, fromAssignments, syncAssignments, assignToJob, addEngineerToJob, removeEngineerFromJob, deleteJob } = globalThis.SB.jobs;

const eng = (id, assignments) => ({ id, name: id, assignments });

test('nextJobId returns the smallest unused jN', () => {
  assert.equal(nextJobId([]), 'j1');
  assert.equal(nextJobId([{ id: 'j1' }, { id: 'j2' }]), 'j3');
  assert.equal(nextJobId([{ id: 'j1' }, { id: 'j3' }]), 'j2'); // fills the gap
});

test('fromAssignments collapses shared assignments into one job with both engineers', () => {
  const a = { jobTitle: 'Crane overhaul', equipment: 'offshore crane', repairType: 'overhaul', country: 'United Kingdom', start: '2026-07-28', end: '2026-08-10' };
  const jobs = fromAssignments([eng('e1', [a]), eng('e2', [{ ...a }]), eng('e3', [])]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Crane overhaul');
  assert.equal(jobs[0].equipment, 'offshore crane');
  assert.deepEqual(jobs[0].engineerIds.sort(), ['e1', 'e2']);
  assert.deepEqual(jobs[0].notes, { customer: '', contact: '', phone: '', email: '', text: '' });
  assert.equal(jobs[0].id, 'j1');
});

test('fromAssignments keeps distinct jobs separate and ids them sequentially', () => {
  const jobs = fromAssignments([
    eng('e1', [{ jobTitle: 'A', country: 'Norway', start: '2026-01-01', end: '2026-01-05' }]),
    eng('e2', [{ jobTitle: 'B', country: 'Brazil', start: '2026-02-01', end: '2026-02-05' }]),
  ]);
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map((j) => j.id), ['j1', 'j2']);
});

test('syncAssignments rebuilds each engineer assignment list from jobs, with jobId', () => {
  const engs = [eng('e1', []), eng('e2', []), eng('e3', [])];
  const jobs = [{ id: 'j1', title: 'Crane', country: 'UK', start: '2026-07-28', end: '2026-08-10', engineerIds: ['e1', 'e2'] }];
  syncAssignments(engs, jobs);
  assert.deepEqual(engs[0].assignments, [{ jobId: 'j1', jobTitle: 'Crane', country: 'UK', start: '2026-07-28', end: '2026-08-10' }]);
  assert.deepEqual(engs[1].assignments.map((a) => a.jobId), ['j1']);
  assert.deepEqual(engs[2].assignments, []);
});

test('assignToJob finds an existing matching job and adds the engineer (no duplicate job)', () => {
  const spec = { title: 'Crane', equipment: 'offshore crane', repairType: 'overhaul', country: 'UK', start: '2026-07-28', end: '2026-08-10' };
  let { jobs, jobId } = assignToJob([], spec, 'e1');
  assert.equal(jobs.length, 1);
  assert.equal(jobId, 'j1');
  ({ jobs, jobId } = assignToJob(jobs, spec, 'e2')); // same spec -> same job
  assert.equal(jobs.length, 1);
  assert.deepEqual(jobs[0].engineerIds, ['e1', 'e2']);
  // assigning the same engineer again is a no-op
  ({ jobs } = assignToJob(jobs, spec, 'e1'));
  assert.deepEqual(jobs[0].engineerIds, ['e1', 'e2']);
});

test('assignToJob creates a new job when the spec differs', () => {
  const s1 = { title: 'A', equipment: 'x', repairType: 'y', country: 'UK', start: '2026-01-01', end: '2026-01-02' };
  const s2 = { ...s1, country: 'Norway' };
  let { jobs } = assignToJob([], s1, 'e1');
  ({ jobs } = assignToJob(jobs, s2, 'e1'));
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map((j) => j.id), ['j1', 'j2']);
});

test('add/remove/delete operate immutably on jobs', () => {
  const jobs = [{ id: 'j1', engineerIds: ['e1'] }, { id: 'j2', engineerIds: [] }];
  const added = addEngineerToJob(jobs, 'j1', 'e2');
  assert.deepEqual(added[0].engineerIds, ['e1', 'e2']);
  assert.deepEqual(jobs[0].engineerIds, ['e1']); // original untouched
  const removed = removeEngineerFromJob(added, 'j1', 'e1');
  assert.deepEqual(removed[0].engineerIds, ['e2']);
  const deleted = deleteJob(jobs, 'j1');
  assert.deepEqual(deleted.map((j) => j.id), ['j2']);
});
