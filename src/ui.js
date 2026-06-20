// src/ui.js
;(function () {
  const SB = (globalThis.SB ||= {});
  const $ = (id) => document.getElementById(id);
  const state = { settings: null, engineers: [], dirty: false };

  const showApp = () => {
    $('lock').hidden = true; $('tabs').hidden = false;
    showTab('roster'); markClean();
  };
  const markDirty = () => { state.dirty = true; $('fileState').textContent = 'Unsaved changes'; };
  const markClean = () => { state.dirty = false; $('fileState').textContent = 'Roster loaded'; };

  // password meter
  $('pw').addEventListener('input', (e) => {
    const s = SB.strength.passwordStrength(e.target.value);
    const m = $('meter'); m.className = 'meter m-' + s;
    m.innerHTML = '<span></span>';
    let lbl = $('meterLabel'); if (!lbl) { lbl = document.createElement('div'); lbl.id='meterLabel'; lbl.className='meter-label'; m.after(lbl); }
    lbl.textContent = 'Password: ' + s.replace('-', ' ');
  });

  $('newBtn').addEventListener('click', () => {
    state.settings = SB.demo.settings(); state.engineers = SB.demo.engineers(); showApp();
  });

  $('unlockBtn').addEventListener('click', async () => {
    $('lockError').hidden = true;
    const file = $('fileInput').files[0];
    if (!file) { showError('Choose a roster file first.'); return; }
    try {
      const env = JSON.parse(await file.text());
      const payload = await SB.crypto.decrypt(env, $('pw').value);
      state.settings = payload.settings; state.engineers = payload.engineers; showApp();
    } catch (e) { showError(e.message); }
  });
  const showError = (msg) => { const el = $('lockError'); el.textContent = msg; el.hidden = false; };

  // tabs
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) =>
    b.addEventListener('click', () => showTab(b.dataset.tab)));
  function showTab(name) {
    document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    for (const t of ['roster','nextpick','compliance']) $(t).hidden = (t !== name);
    if (name === 'roster') SB.ui.renderRoster();
    if (name === 'nextpick') SB.ui.renderNextPick();
    if (name === 'compliance') SB.ui.renderCompliance();
  }

  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
  const today = () => SB.dates.today();

  function renderRoster() {
    const rows = state.engineers.map((e) => {
      const bank = SB.rest.restDaysBank(e, today());
      const rest = bank > 0 ? `<span class="pill ot">${bank} rest days left</span>` : `<span class="pill ok">rested</span>`;
      return `<tr data-id="${e.id}"><td><a href="#" data-id="${e.id}">${esc(e.name)}</a></td>
        <td>${esc(e.nationalities.join(', '))}</td><td>${e.competence.length} skills</td><td>${rest}</td></tr>`;
    }).join('');
    $('roster').innerHTML = `<h2>Roster</h2><table><thead><tr><th>Name</th><th>Nationalities</th><th>Competence</th><th>Rest</th></tr></thead><tbody>${rows}</tbody></table><div id="detail"></div>`;
    $('roster').querySelectorAll('a[data-id]').forEach((a) =>
      a.addEventListener('click', (ev) => { ev.preventDefault(); renderEngineerDetail(a.dataset.id); }));
  }

  function renderEngineerDetail(id) {
    const e = state.engineers.find((x) => x.id === id); if (!e) return;
    const list = (arr, fn) => arr.map(fn).join('') || '<li class="muted">none</li>';
    $('detail').innerHTML = `<div class="card"><h3>${esc(e.name)}</h3>
      <p><strong>Nationalities:</strong> ${esc(e.nationalities.join(', '))}</p>
      <p><strong>Passports:</strong><ul>${list(e.passports, (p) => `<li>${esc(p.country)} ${esc(p.number)}, expires ${esc(p.expiry)}</li>`)}</ul></p>
      <p><strong>Visas:</strong><ul>${list(e.visas, (v) => `<li>${esc(v.country)}, ${esc(v.type)}, expires ${esc(v.expiry)}</li>`)}</ul></p>
      <p><strong>Certificates:</strong><ul>${list(e.certs, (c) => `<li>${esc(c.type)}, expires ${esc(c.expiry)}</li>`)}</ul></p>
      <p><strong>Competence:</strong><ul>${list(e.competence, (c) => `<li>${esc(c.equipment)} / ${esc(c.repairType)} (level ${c.level})</li>`)}</ul></p>
      <p><strong>Rest days remaining:</strong> ${SB.rest.restDaysBank(e, today())}</p></div>`;
  }

  function renderCompliance() {
    const b = SB.compliance.expiringDocuments(state.engineers, today());
    const block = (title, items) => `<h3>${title}</h3>` + (items.length
      ? `<table><thead><tr><th>Who</th><th>Type</th><th>Detail</th><th>Expires</th><th>Days</th></tr></thead><tbody>` +
        items.map((i) => `<tr><td>${esc(i.who)}</td><td>${esc(i.kind)}</td><td>${esc(i.detail)}</td><td>${esc(i.expiry)}</td><td>${i.days}</td></tr>`).join('') + `</tbody></table>`
      : `<p class="muted">Nothing in this window.</p>`);
    const rest = SB.compliance.restOverview(state.engineers, today());
    const restBlock = rest.length
      ? `<table><thead><tr><th>Who</th><th>Rest days remaining</th></tr></thead><tbody>` +
        rest.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.restDaysBank}</td></tr>`).join('') + `</tbody></table>`
      : `<p class="muted">Everyone is fully rested.</p>`;
    $('compliance').innerHTML = `<h2>Compliance</h2>${block('Expiring within 30 days', b.d30)}${block('31 to 60 days', b.d60)}${block('61 to 90 days', b.d90)}<h3>Currently resting</h3>${restBlock}`;
  }

  function renderNextPick() {
    const s = state.settings;
    const opts = (arr) => arr.map((x) => `<option>${esc(x)}</option>`).join('');
    const certChecks = s.certTypes.map((c) => `<label class="inline"><input type="checkbox" value="${esc(c)}" ${c==='offshore safety course'?'checked':''}> ${esc(c)}</label>`).join(' ');
    $('nextpick').innerHTML = `<h2>Find next pick</h2>
      <div class="card">
        <label>Equipment <select id="j_eq">${opts(s.equipment)}</select></label>
        <label>Repair type <select id="j_rep">${opts(s.repairTypes)}</select></label>
        <label>Destination country <select id="j_country">${opts(s.countries)}</select></label>
        <label class="inline"><input type="checkbox" id="j_off" checked> Offshore</label>
        <label>Start date <input type="date" id="j_start" value="2026-08-01"></label>
        <label>Duration (days) <input type="number" id="j_dur" value="10" min="1"></label>
        <div>Required certificates:<br>${certChecks}</div>
        <button id="runPick">Find engineers</button>
      </div>
      <div id="pickResult"></div>`;
    $('runPick').addEventListener('click', runPick);
  }

  function runPick() {
    const job = {
      title: 'Ad hoc job', equipment: $('j_eq').value, repairType: $('j_rep').value,
      country: $('j_country').value, offshore: $('j_off').checked,
      startDate: $('j_start').value, durationDays: Number($('j_dur').value),
      requiredCerts: [...document.querySelectorAll('#nextpick input[type=checkbox]:checked')].filter((c) => c.value).map((c) => c.value),
    };
    const r = SB.engine.nextPick(job, state.engineers, state.settings);
    const shortlist = r.shortlist.length
      ? `<table><thead><tr><th>Rank</th><th>Name</th><th>Status</th><th>Reason</th></tr></thead><tbody>` +
        r.shortlist.map((x, i) => `<tr><td>${i+1}</td><td>${esc(x.name)}</td><td>${x.overtime?'<span class="pill ot">overtime</span>':'<span class="pill ok">rested</span>'}</td><td>${esc(x.reason)}</td></tr>`).join('') + `</tbody></table>`
      : `<p class="muted">No eligible engineers for this job.</p>`;
    const RULE = { 'no-competence':'no matching competence', 'no-valid-passport':'passport invalid within 6 months', 'needs-visa':'no valid visa for destination', 'cert-missing-or-expired':'required certificate missing or expired', 'on-vacation':'on vacation during the job' };
    const excluded = r.excluded.length
      ? `<h3>Excluded</h3><table class="excluded"><tbody>` + r.excluded.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(RULE[x.failedRule]||x.failedRule)}</td></tr>`).join('') + `</tbody></table>`
      : '';
    $('pickResult').innerHTML = `<h3>Shortlist</h3>${shortlist}${excluded}`;
  }

  async function save() {
    const payload = { meta: { appVersion: 1 }, settings: state.settings, engineers: state.engineers };
    const env = await SB.crypto.encrypt(payload, $('pw').value);
    const blob = new Blob([JSON.stringify(env)], { type: 'application/json' });
    const d = new Date();
    const name = `scheduler-roster-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.sbs`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href); markClean();
  }
  $('saveBtn').addEventListener('click', save);

  SB.ui = { state, markDirty, markClean, showTab, renderRoster, renderEngineerDetail, renderCompliance, renderNextPick };
})();
