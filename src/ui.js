// src/ui.js
;(function () {
  const SB = (globalThis.SB ||= {});
  const $ = (id) => document.getElementById(id);
  const state = { settings: null, engineers: [], dirty: false, password: '' };

  const showApp = () => {
    $('lock').hidden = true; $('tabs').hidden = false;
    showTab('roster'); markClean();
  };
  const markDirty = () => { state.dirty = true; $('fileState').textContent = 'Unsaved changes'; };
  const markClean = () => { state.dirty = false; $('fileState').textContent = 'Roster loaded'; };

  // password meter (lock screen)
  $('pw').addEventListener('input', (e) => {
    const s = SB.strength.passwordStrength(e.target.value);
    const m = $('meter'); m.className = 'meter m-' + s;
    m.innerHTML = '<span></span>';
    let lbl = $('meterLabel'); if (!lbl) { lbl = document.createElement('div'); lbl.id='meterLabel'; lbl.className='meter-label'; m.after(lbl); }
    lbl.textContent = 'Password: ' + s.replace('-', ' ');
  });

  $('newBtn').addEventListener('click', () => {
    state.settings = SB.demo.settings(); state.engineers = SB.demo.engineers(); state.password = ''; showApp();
  });

  $('unlockBtn').addEventListener('click', async () => {
    $('lockError').hidden = true;
    const file = $('fileInput').files[0];
    if (!file) { showError('Choose a roster file first.'); return; }
    try {
      const env = JSON.parse(await file.text());
      const pw = $('pw').value;
      const payload = await SB.crypto.decrypt(env, pw);
      state.settings = payload.settings; state.engineers = payload.engineers; state.password = pw; showApp();
    } catch (e) { showError(e.message); }
  });
  const showError = (msg) => { const el = $('lockError'); el.textContent = msg; el.hidden = false; };

  // tabs
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) =>
    b.addEventListener('click', () => showTab(b.dataset.tab)));
  function showTab(name) {
    document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    for (const t of ['roster','nextpick','compliance','settings']) $(t).hidden = (t !== name);
    if (name === 'roster') SB.ui.renderRoster();
    if (name === 'nextpick') SB.ui.renderNextPick();
    if (name === 'compliance') SB.ui.renderCompliance();
    if (name === 'settings') SB.ui.renderSettings();
  }

  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
  const today = () => SB.dates.today();

  // ---- unique id for new engineers ----
  function newEngineerId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    let max = 0;
    for (const e of state.engineers) {
      const m = String(e.id).match(/(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
    }
    return 'e' + String(max + 1).padStart(2, '0');
  }

  function renderRoster() {
    const rows = state.engineers.map((e) => {
      const av = SB.rest.availabilityScore(e, today());
      const rest = av < 0
        ? `<span class="pill ot">${-av} rest days left</span>`
        : `<span class="pill ok">available</span>`;
      return `<tr data-id="${e.id}"><td><a href="#" data-id="${e.id}">${esc(e.name)}</a></td>
        <td>${esc(e.nationalities.join(', '))}</td><td>${e.competence.length} skills</td><td>${rest}</td></tr>`;
    }).join('');
    $('roster').innerHTML = `<h2>Roster</h2>
      <div class="roster-header"><button id="newEngineerBtn">New engineer</button></div>
      <table><thead><tr><th>Name</th><th>Nationalities</th><th>Competence</th><th>Rest</th></tr></thead><tbody>${rows}</tbody></table><div id="detail"></div>`;
    $('roster').querySelectorAll('a[data-id]').forEach((a) =>
      a.addEventListener('click', (ev) => { ev.preventDefault(); renderEngineerDetail(a.dataset.id); }));
    $('newEngineerBtn').addEventListener('click', () => {
      const id = newEngineerId();
      const eng = { id, name: 'New engineer', nationalities: [], passports: [], visas: [], certs: [], competence: [],
        availability: { lastOffshore: null, restDaysOverride: null, vacations: [] } };
      state.engineers.push(eng);
      markDirty();
      renderRoster();
      renderEngineerEditForm(id);
    });
  }

  function renderEngineerDetail(id) {
    const e = state.engineers.find((x) => x.id === id); if (!e) return;
    const list = (arr, fn) => arr.map(fn).join('') || '<li class="muted">none</li>';
    const av = SB.rest.availabilityScore(e, today());
    const avDisplay = av >= 900 ? 'Available' : String(av);
    const detailEl = $('detail');
    detailEl.innerHTML = `<div class="card"><h3>${esc(e.name)}</h3>
      <p><strong>Nationalities:</strong> ${esc(e.nationalities.join(', '))}</p>
      <p><strong>Passports:</strong><ul>${list(e.passports, (p) => `<li>${esc(p.country)} ${esc(p.number)}, expires ${esc(SB.dates.toDisplay(p.expiry))}</li>`)}</ul></p>
      <p><strong>Visas:</strong><ul>${list(e.visas, (v) => `<li>${esc(v.country)}, ${esc(v.type)}, expires ${esc(SB.dates.toDisplay(v.expiry))}</li>`)}</ul></p>
      <p><strong>Certificates:</strong><ul>${list(e.certs, (c) => `<li>${esc(c.type)}, expires ${esc(SB.dates.toDisplay(c.expiry))}</li>`)}</ul></p>
      <p><strong>Competence:</strong><ul>${list(e.competence, (c) => `<li>${esc(c.equipment)} / ${esc(c.repairType)} (level ${c.level})</li>`)}</ul></p>
      <p><strong>Availability score:</strong> ${esc(avDisplay)}</p>
      <button data-edit-id="${esc(e.id)}">Edit</button></div>`;
    detailEl.querySelector('button[data-edit-id]').addEventListener('click', () => {
      renderEngineerEditForm(id);
    });
  }

  // ---- engineer edit form ----

  function renderEngineerEditForm(id) {
    const e = state.engineers.find((x) => x.id === id); if (!e) return;
    const s = state.settings;
    const detailEl = $('detail');

    const form = document.createElement('div');
    form.className = 'card';
    form.setAttribute('data-edit-id', id);

    const h = document.createElement('h3');
    h.textContent = 'Edit engineer';
    form.appendChild(h);

    function fieldRow(labelText, inputEl) {
      const row = document.createElement('p');
      const lbl = document.createElement('label');
      lbl.textContent = labelText + ' ';
      lbl.appendChild(inputEl);
      row.appendChild(lbl);
      return row;
    }

    function textInput(value) {
      const el = document.createElement('input');
      el.type = 'text'; el.value = value || '';
      return el;
    }

    // date input: text field with dd/mm/yyyy display
    function dateInput(isoValue) {
      const el = document.createElement('input');
      el.type = 'text'; el.placeholder = 'dd/mm/yyyy';
      el.value = SB.dates.toDisplay(isoValue || '');
      el.className = 'inp-date';
      return el;
    }

    function numberInput(value, placeholder) {
      const el = document.createElement('input');
      el.type = 'number'; el.value = (value !== null && value !== undefined) ? value : '';
      if (placeholder) el.placeholder = placeholder;
      return el;
    }

    // select with fallback: if storedValue is not in opts, add it as a selected option
    function selectEl(opts, storedValue) {
      const el = document.createElement('select');
      const options = [...opts];
      if (storedValue && !options.includes(storedValue)) {
        const extra = document.createElement('option');
        extra.value = storedValue; extra.textContent = storedValue; extra.selected = true;
        el.appendChild(extra);
      }
      options.forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o; opt.textContent = o;
        if (o === storedValue) opt.selected = true;
        el.appendChild(opt);
      });
      return el;
    }

    function removeBtn() {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Remove';
      b.className = 'btn-remove';
      return b;
    }

    function buildListSection(title, rows, buildRow, addText) {
      const section = document.createElement('div');
      section.className = 'edit-section';
      const heading = document.createElement('strong');
      heading.textContent = title;
      section.appendChild(heading);

      const list = document.createElement('div');
      list.className = 'edit-list';

      rows.forEach((item) => { list.appendChild(buildRow(item)); });

      const addBtn = document.createElement('button');
      addBtn.type = 'button'; addBtn.textContent = addText;
      addBtn.addEventListener('click', () => { list.appendChild(buildRow(null)); });

      section.appendChild(list);
      section.appendChild(addBtn);
      return { section, list };
    }

    // --- name ---
    const nameInput = textInput(e.name);
    form.appendChild(fieldRow('Name', nameInput));

    // --- nationalities ---
    function buildNationalityRow(nat) {
      const row = document.createElement('div');
      row.className = 'edit-row';
      const inp = textInput(nat || '');
      inp.placeholder = 'Nationality';
      inp.className = 'inp-nationality';
      const rb = removeBtn();
      rb.addEventListener('click', () => row.remove());
      row.appendChild(inp);
      row.appendChild(rb);
      return row;
    }
    const { section: natSection } = buildListSection(
      'Nationalities', e.nationalities, buildNationalityRow, 'Add nationality');
    form.appendChild(natSection);

    // --- passports ---
    function buildPassportRow(p) {
      const row = document.createElement('div');
      row.className = 'edit-row';
      const country = textInput(p ? p.country : ''); country.placeholder = 'Country'; country.className = 'inp-pp-country';
      const number = textInput(p ? p.number : ''); number.placeholder = 'Number'; number.className = 'inp-pp-number';
      const expiry = dateInput(p ? p.expiry : ''); expiry.className += ' inp-pp-expiry';
      const rb = removeBtn(); rb.addEventListener('click', () => row.remove());
      [country, number, expiry, rb].forEach((el) => row.appendChild(el));
      return row;
    }
    const { section: ppSection } = buildListSection(
      'Passports', e.passports, buildPassportRow, 'Add passport');
    form.appendChild(ppSection);

    // --- visas ---
    function buildVisaRow(v) {
      const row = document.createElement('div');
      row.className = 'edit-row';
      const countrySel = selectEl(SB.countries, v ? v.country : (SB.countries[0] || ''));
      countrySel.className = 'inp-visa-country';
      const typeSel = selectEl(s.visaTypes || [], v ? v.type : ((s.visaTypes || [])[0] || ''));
      typeSel.className = 'inp-visa-type';
      const expiry = dateInput(v ? v.expiry : ''); expiry.className += ' inp-visa-expiry';
      const rb = removeBtn(); rb.addEventListener('click', () => row.remove());
      [countrySel, typeSel, expiry, rb].forEach((el) => row.appendChild(el));
      return row;
    }
    const { section: visaSection } = buildListSection(
      'Visas', e.visas, buildVisaRow, 'Add visa');
    form.appendChild(visaSection);

    // --- certificates ---
    function buildCertRow(c) {
      const row = document.createElement('div');
      row.className = 'edit-row';
      const typeSel = selectEl(s.certTypes || [], c ? c.type : ((s.certTypes || [])[0] || ''));
      typeSel.className = 'inp-cert-type';
      const expiry = dateInput(c ? c.expiry : ''); expiry.className += ' inp-cert-expiry';
      const rb = removeBtn(); rb.addEventListener('click', () => row.remove());
      [typeSel, expiry, rb].forEach((el) => row.appendChild(el));
      return row;
    }
    const { section: certSection } = buildListSection(
      'Certificates', e.certs, buildCertRow, 'Add certificate');
    form.appendChild(certSection);

    // --- competence ---
    function buildCompRow(c) {
      const row = document.createElement('div');
      row.className = 'edit-row';
      const eqSel = selectEl(s.equipment, c ? c.equipment : s.equipment[0]);
      eqSel.className = 'inp-comp-eq';
      const repSel = selectEl(s.repairTypes, c ? c.repairType : s.repairTypes[0]);
      repSel.className = 'inp-comp-rep';
      const lvlSel = selectEl(['1','2','3'], c ? String(c.level) : '1');
      lvlSel.className = 'inp-comp-lvl';
      const rb = removeBtn(); rb.addEventListener('click', () => row.remove());
      [eqSel, repSel, lvlSel, rb].forEach((el) => row.appendChild(el));
      return row;
    }
    const { section: compSection } = buildListSection(
      'Competence', e.competence, buildCompRow, 'Add competence');
    form.appendChild(compSection);

    // --- availability ---
    const availSection = document.createElement('div');
    availSection.className = 'edit-section';
    const availHeading = document.createElement('strong');
    availHeading.textContent = 'Availability';
    availSection.appendChild(availHeading);

    const lo = e.availability.lastOffshore;
    const loEndInput = dateInput(lo ? lo.end : '');
    loEndInput.id = 'edit-lo-end';
    const loDurInput = numberInput(lo ? lo.durationDays : '', 'Days');
    loDurInput.id = 'edit-lo-dur';
    const loRow = document.createElement('p');
    loRow.innerHTML = '<label>Last offshore end: </label>';
    loRow.querySelector('label').appendChild(loEndInput);
    loRow.innerHTML += ' ';
    const durLabel = document.createElement('label');
    durLabel.textContent = 'Duration (days): ';
    durLabel.appendChild(loDurInput);
    loRow.appendChild(durLabel);
    availSection.appendChild(loRow);

    const rdo = e.availability.restDaysOverride;
    const rdoInput = numberInput(rdo !== null && rdo !== undefined ? rdo : '', 'Leave blank for automatic');
    rdoInput.id = 'edit-rdo';
    availSection.appendChild(fieldRow('Rest days override (blank = automatic):', rdoInput));

    // vacations
    function buildVacRow(v) {
      const row = document.createElement('div');
      row.className = 'edit-row';
      const start = dateInput(v ? v.start : ''); start.className += ' inp-vac-start'; start.placeholder = 'dd/mm/yyyy';
      const end = dateInput(v ? v.end : ''); end.className += ' inp-vac-end'; end.placeholder = 'dd/mm/yyyy';
      const rb = removeBtn(); rb.addEventListener('click', () => row.remove());
      const startLabel = document.createElement('label');
      startLabel.textContent = 'Start: '; startLabel.appendChild(start);
      const endLabel = document.createElement('label');
      endLabel.textContent = ' End: '; endLabel.appendChild(end);
      [startLabel, endLabel, rb].forEach((el) => row.appendChild(el));
      return row;
    }
    const vacList = document.createElement('div');
    vacList.className = 'edit-list';
    (e.availability.vacations || []).forEach((v) => vacList.appendChild(buildVacRow(v)));
    const addVacBtn = document.createElement('button');
    addVacBtn.type = 'button'; addVacBtn.textContent = 'Add vacation';
    addVacBtn.addEventListener('click', () => vacList.appendChild(buildVacRow(null)));
    availSection.appendChild(document.createElement('br'));
    const vacLabel = document.createElement('strong');
    vacLabel.textContent = 'Vacations:';
    availSection.appendChild(vacLabel);
    availSection.appendChild(vacList);
    availSection.appendChild(addVacBtn);

    form.appendChild(availSection);

    // --- save / cancel ---
    const btnRow = document.createElement('div');
    btnRow.className = 'edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button'; saveBtn.textContent = 'Save changes';
    saveBtn.addEventListener('click', () => {
      const nat = [...form.querySelectorAll('.inp-nationality')]
        .map((el) => el.value.trim()).filter(Boolean);

      // helper: read dd/mm/yyyy text field and convert back to ISO
      const readDate = (el) => SB.dates.fromDisplay(el.value.trim());

      const passports = [...form.querySelectorAll('.edit-list')[0].children].map((row) => ({
        country: row.querySelector('.inp-pp-country').value.trim(),
        number: row.querySelector('.inp-pp-number').value.trim(),
        expiry: readDate(row.querySelector('.inp-pp-expiry')),
      })).filter((p) => p.country || p.number || p.expiry);

      const visas = [...form.querySelectorAll('.edit-list')[1].children].map((row) => ({
        country: row.querySelector('.inp-visa-country').value,
        type: row.querySelector('.inp-visa-type').value,
        expiry: readDate(row.querySelector('.inp-visa-expiry')),
      })).filter((v) => v.country || v.type || v.expiry);

      const certs = [...form.querySelectorAll('.edit-list')[2].children].map((row) => ({
        type: row.querySelector('.inp-cert-type').value,
        expiry: readDate(row.querySelector('.inp-cert-expiry')),
      })).filter((c) => c.type || c.expiry);

      const competence = [...form.querySelectorAll('.edit-list')[3].children].map((row) => ({
        equipment: row.querySelector('.inp-comp-eq').value,
        repairType: row.querySelector('.inp-comp-rep').value,
        level: Number(row.querySelector('.inp-comp-lvl').value),
      }));

      const loEndRaw = readDate(form.querySelector('#edit-lo-end'));
      const loDur = form.querySelector('#edit-lo-dur').value;
      const lastOffshore = loEndRaw ? { end: loEndRaw, durationDays: Number(loDur) || 0 } : null;

      const rdoVal = form.querySelector('#edit-rdo').value.trim();
      const restDaysOverride = rdoVal !== '' ? Number(rdoVal) : null;

      const vacations = [...form.querySelectorAll('.edit-list')[5].children].map((row) => ({
        start: readDate(row.querySelector('.inp-vac-start')),
        end: readDate(row.querySelector('.inp-vac-end')),
      })).filter((v) => v.start || v.end);

      const updated = {
        id,
        name: nameInput.value.trim() || 'Unnamed engineer',
        nationalities: nat,
        passports,
        visas,
        certs,
        competence,
        availability: { lastOffshore, restDaysOverride, vacations },
      };

      const idx = state.engineers.findIndex((x) => x.id === id);
      if (idx !== -1) state.engineers[idx] = updated;
      markDirty();
      renderRoster();
      renderEngineerDetail(id);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button'; cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => { renderEngineerDetail(id); });

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    form.appendChild(btnRow);

    detailEl.innerHTML = '';
    detailEl.appendChild(form);
  }

  function renderCompliance() {
    const b = SB.compliance.expiringDocuments(state.engineers, today());
    const block = (title, items) => `<h3>${title}</h3>` + (items.length
      ? `<table><thead><tr><th>Who</th><th>Type</th><th>Detail</th><th>Expires</th><th>Days</th></tr></thead><tbody>` +
        items.map((i) => `<tr><td>${esc(i.who)}</td><td>${esc(i.kind)}</td><td>${esc(i.detail)}</td><td>${esc(SB.dates.toDisplay(i.expiry))}</td><td>${i.days}</td></tr>`).join('') + `</tbody></table>`
      : `<p class="muted">Nothing in this window.</p>`);
    const resting = SB.compliance.availabilityOverview(state.engineers, today());
    const restBlock = resting.length
      ? `<table><thead><tr><th>Who</th><th>Availability</th></tr></thead><tbody>` +
        resting.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.availability}</td></tr>`).join('') + `</tbody></table>`
      : `<p class="muted">Everyone is fully rested.</p>`;
    $('compliance').innerHTML = `<h2>Compliance</h2>${block('Expiring within 30 days', b.d30)}${block('31 to 60 days', b.d60)}${block('61 to 90 days', b.d90)}<h3>Availability (currently resting)</h3>${restBlock}`;
  }

  function renderNextPick() {
    const s = state.settings;
    const opts = (arr) => arr.map((x) => `<option>${esc(x)}</option>`).join('');
    const certChecks = s.certTypes.map((c) => `<label class="inline"><input type="checkbox" value="${esc(c)}" ${c==='offshore safety course'?'checked':''}> ${esc(c)}</label>`).join(' ');
    $('nextpick').innerHTML = `<h2>Find next pick</h2>
      <div class="card">
        <label>Equipment <select id="j_eq">${opts(s.equipment)}</select></label>
        <label>Repair type <select id="j_rep">${opts(s.repairTypes)}</select></label>
        <label>Destination country <select id="j_country">${opts(SB.countries)}</select></label>
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
        r.shortlist.map((x, i) => {
          const pill = x.overtime
            ? '<span class="pill ot">overtime</span>'
            : '<span class="pill ok">available</span>';
          return `<tr><td>${i+1}</td><td>${esc(x.name)}</td><td>${pill}</td><td>${esc(x.reason)}</td></tr>`;
        }).join('') + `</tbody></table>`
      : `<p class="muted">No eligible engineers for this job.</p>`;
    const RULE = { 'no-competence':'no matching competence', 'no-valid-passport':'passport invalid within 6 months', 'needs-visa':'no valid visa for destination', 'cert-missing-or-expired':'required certificate missing or expired', 'on-vacation':'on vacation during the job' };
    const excluded = r.excluded.length
      ? `<h3>Excluded</h3><table class="excluded"><tbody>` + r.excluded.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(RULE[x.failedRule]||x.failedRule)}</td></tr>`).join('') + `</tbody></table>`
      : '';
    $('pickResult').innerHTML = `<h3>Shortlist</h3>${shortlist}${excluded}`;
  }

  // ---- Settings tab ----
  function renderSettings() {
    const s = state.settings;
    const el = $('settings');
    el.innerHTML = '<h2>Settings</h2>';

    const lists = [
      { key: 'equipment', label: 'Equipment' },
      { key: 'repairTypes', label: 'Repair types' },
      { key: 'certTypes', label: 'Certificate types' },
      { key: 'visaTypes', label: 'Visa types' },
    ];

    lists.forEach(({ key, label }) => {
      const section = document.createElement('div');
      section.className = 'edit-section';

      const heading = document.createElement('h3');
      heading.textContent = label;
      section.appendChild(heading);

      const itemsDiv = document.createElement('div');
      itemsDiv.className = 'edit-list';
      (s[key] || []).forEach((item) => {
        const row = document.createElement('div');
        row.className = 'edit-row';
        const span = document.createElement('span');
        span.textContent = item;
        const rb = document.createElement('button');
        rb.type = 'button'; rb.textContent = 'Remove'; rb.className = 'btn-remove';
        rb.addEventListener('click', () => {
          s[key] = s[key].filter((x) => x !== item);
          markDirty();
          renderSettings();
        });
        row.appendChild(span);
        row.appendChild(rb);
        itemsDiv.appendChild(row);
      });
      section.appendChild(itemsDiv);

      const addRow = document.createElement('div');
      addRow.className = 'edit-row';
      const inp = document.createElement('input');
      inp.type = 'text'; inp.placeholder = 'New item';
      const addBtn = document.createElement('button');
      addBtn.type = 'button'; addBtn.textContent = 'Add';
      addBtn.addEventListener('click', () => {
        const val = inp.value.trim();
        if (!val) return;
        if (!s[key]) s[key] = [];
        s[key].push(val);
        markDirty();
        renderSettings();
      });
      addRow.appendChild(inp);
      addRow.appendChild(addBtn);
      section.appendChild(addRow);

      el.appendChild(section);
    });
  }

  // ---- Save with password prompt ----
  function openSavePanel() {
    let panel = $('savePanel');
    if (panel) { panel.hidden = false; return; }

    panel = document.createElement('div');
    panel.id = 'savePanel';
    panel.className = 'save-panel card';

    const title = document.createElement('p');
    title.innerHTML = '<strong>Set a password for this file (leave blank for no password)</strong>';
    panel.appendChild(title);

    const pwInput = document.createElement('input');
    pwInput.type = 'password'; pwInput.id = 'savePw'; pwInput.autocomplete = 'off';
    pwInput.value = state.password || '';
    panel.appendChild(pwInput);

    const meterDiv = document.createElement('div');
    meterDiv.id = 'saveMeter'; meterDiv.className = 'meter';
    meterDiv.innerHTML = '<span></span>';
    panel.appendChild(meterDiv);

    const meterLbl = document.createElement('div');
    meterLbl.id = 'saveMeterLabel'; meterLbl.className = 'meter-label';
    panel.appendChild(meterLbl);

    // update meter on input
    pwInput.addEventListener('input', () => {
      const s = SB.strength.passwordStrength(pwInput.value);
      meterDiv.className = 'meter m-' + s;
      meterDiv.innerHTML = '<span></span>';
      meterLbl.textContent = 'Password: ' + s.replace('-', ' ');
    });

    // initialise meter for prefilled value
    if (state.password) {
      const s = SB.strength.passwordStrength(state.password);
      meterDiv.className = 'meter m-' + s;
      meterDiv.innerHTML = '<span></span>';
      meterLbl.textContent = 'Password: ' + s.replace('-', ' ');
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'row';

    const doSaveBtn = document.createElement('button');
    doSaveBtn.type = 'button'; doSaveBtn.textContent = 'Save file';
    doSaveBtn.addEventListener('click', async () => {
      const pw = pwInput.value;
      const payload = { meta: { appVersion: 1 }, settings: state.settings, engineers: state.engineers };
      const env = await SB.crypto.encrypt(payload, pw);
      const blob = new Blob([JSON.stringify(env)], { type: 'application/json' });
      const d = new Date();
      const name = `scheduler-roster-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.sbs`;
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
      URL.revokeObjectURL(a.href);
      state.password = pw;
      markClean();
      panel.hidden = true;
    });

    const cancelSaveBtn = document.createElement('button');
    cancelSaveBtn.type = 'button'; cancelSaveBtn.textContent = 'Cancel'; cancelSaveBtn.className = 'secondary';
    cancelSaveBtn.addEventListener('click', () => { panel.hidden = true; });

    btnRow.appendChild(doSaveBtn);
    btnRow.appendChild(cancelSaveBtn);
    panel.appendChild(btnRow);

    // insert above the tabs nav
    const tabs = $('tabs');
    tabs.parentNode.insertBefore(panel, tabs);
  }

  $('saveBtn').addEventListener('click', openSavePanel);

  // ---- Quit ----
  $('quitBtn').addEventListener('click', () => {
    if (state.dirty) {
      if (!window.confirm('You have unsaved changes. Quit without saving?')) return;
    }
    state.engineers = []; state.settings = null; state.password = '';
    state.dirty = false; $('fileState').textContent = 'No roster loaded';
    $('tabs').hidden = true;
    for (const t of ['roster','nextpick','compliance','settings']) $(t).hidden = true;
    const panel = $('savePanel');
    if (panel) panel.hidden = true;
    // reset lock screen inputs
    $('fileInput').value = ''; $('pw').value = '';
    const m = $('meter'); m.className = 'meter'; m.innerHTML = '<span></span>';
    const ml = $('meterLabel'); if (ml) ml.textContent = '';
    $('lockError').hidden = true;
    $('lock').hidden = false;
  });

  SB.ui = { state, markDirty, markClean, showTab, renderRoster, renderEngineerDetail, renderCompliance, renderNextPick, renderSettings };
})();
