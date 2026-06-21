// src/ui.js
;(function () {
  const SB = (globalThis.SB ||= {});
  const $ = (id) => document.getElementById(id);
  const state = { settings: null, engineers: [], jobs: [], dirty: false, password: '' };

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
    state.settings = SB.demo.settings(); state.engineers = SB.demo.engineers(); state.password = '';
    state.jobs = SB.jobs.fromAssignments(state.engineers);
    SB.jobs.syncAssignments(state.engineers, state.jobs);
    showApp();
  });

  $('unlockBtn').addEventListener('click', async () => {
    $('lockError').hidden = true;
    const file = $('fileInput').files[0];
    if (!file) { showError('Choose a roster file first.'); return; }
    try {
      const env = JSON.parse(await file.text());
      const pw = $('pw').value;
      const payload = await SB.crypto.decrypt(env, pw);
      state.settings = payload.settings; state.engineers = payload.engineers; state.password = pw;
      state.jobs = payload.jobs || SB.jobs.fromAssignments(state.engineers);
      SB.jobs.syncAssignments(state.engineers, state.jobs);
      showApp();
    } catch (e) { showError(e.message); }
  });
  const showError = (msg) => { const el = $('lockError'); el.textContent = msg; el.hidden = false; };

  // tabs
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) =>
    b.addEventListener('click', () => showTab(b.dataset.tab)));
  function showTab(name) {
    document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    for (const t of ['roster','nextpick','compliance','settings','schedule']) $(t).hidden = (t !== name);
    if (name === 'roster') SB.ui.renderRoster();
    if (name === 'nextpick') SB.ui.renderNextPick();
    if (name === 'compliance') SB.ui.renderCompliance();
    if (name === 'settings') SB.ui.renderSettings();
    if (name === 'schedule') SB.ui.renderSchedule();
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
    const todayMs = today();
    const sorted = [...state.engineers].sort((a, b) =>
      SB.rest.availabilityScore(b, todayMs, state.settings) - SB.rest.availabilityScore(a, todayMs, state.settings));
    const rows = sorted.map((e) => {
      const av = SB.rest.availabilityScore(e, todayMs, state.settings);
      let avPill;
      if (av < 0) {
        avPill = `<span class="pill ot">${-av} rest days left</span>`;
      } else if (av === 0) {
        avPill = `<span class="pill ok">Available</span>`;
      } else if (av >= 900) {
        avPill = `<span class="pill ok">Available</span>`;
      } else {
        avPill = `<span class="pill ok">Available + ${av} days</span>`;
      }
      return `<tr data-id="${esc(e.id)}"><td><a href="#" data-id="${esc(e.id)}">${esc(e.name)}</a></td>
        <td>${esc(e.nationalities.join(', '))}</td><td>${e.competence.length} skills</td><td>${avPill}</td></tr>`;
    }).join('');
    $('roster').innerHTML = `<h2>Roster</h2>
      <div class="roster-header"><button id="newEngineerBtn">New engineer</button></div>
      <table><thead><tr><th>Name</th><th>Nationalities</th><th>Competence</th><th>Availability</th></tr></thead><tbody>${rows}</tbody></table><div id="detail"></div>`;
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
    const av = SB.rest.availabilityScore(e, today(), state.settings);
    const avDisplay = av >= 900 ? 'Available' : String(av);
    const detailEl = $('detail');
    detailEl.innerHTML = `<div class="card"><h3>${esc(e.name)}</h3>
      <p><strong>Nationalities:</strong> ${esc(e.nationalities.join(', '))}</p>
      <p><strong>Passports:</strong><ul>${list(e.passports, (p) => `<li>${esc(p.country)} ${esc(p.number)}, expires ${esc(SB.dates.toDisplay(p.expiry))}</li>`)}</ul></p>
      <p><strong>Visas:</strong><ul>${list(e.visas, (v) => `<li>${esc(v.country)}, ${esc(v.type)}, expires ${esc(SB.dates.toDisplay(v.expiry))}</li>`)}</ul></p>
      <p><strong>Certificates:</strong><ul>${list(e.certs, (c) => `<li>${esc(c.type)}, expires ${esc(SB.dates.toDisplay(c.expiry))}</li>`)}</ul></p>
      <p><strong>Competence:</strong><ul>${list(e.competence, (c) => `<li>${esc(c.equipment)} / ${esc(c.repairType)} (level ${c.level})</li>`)}</ul></p>
      <p><strong>Availability score:</strong> ${esc(avDisplay)}</p>
      <p><strong>Assignments:</strong> ${
        (e.assignments && e.assignments.length)
          ? e.assignments.map((a) => `${esc(a.jobTitle)}, ${esc(a.country)}, ${esc(SB.dates.toDisplay(a.start))} to ${esc(SB.dates.toDisplay(a.end))}`).join('<br>')
          : 'none'
      }</p>
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

      const vacations = [...form.querySelectorAll('.edit-list')[4].children].map((row) => ({
        start: readDate(row.querySelector('.inp-vac-start')),
        end: readDate(row.querySelector('.inp-vac-end')),
      })).filter((v) => v.start || v.end);

      const original = state.engineers.find((x) => x.id === id) || {};
      const updated = {
        ...original,
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

  // ---- Compliance calendar state ----
  const calState = { year: 0, month: 0 };

  function renderCompliance() {
    const todayMs = today();
    const now = new Date(todayMs);
    if (calState.year === 0) { calState.year = now.getUTCFullYear(); calState.month = now.getUTCMonth(); }
    const allAlerts = SB.compliance.expiryAlerts(state.engineers);
    renderComplianceCalendar(allAlerts);
  }

  function renderComplianceCalendar(allAlerts) {
    const el = $('compliance');
    el.innerHTML = '';

    // heading
    const h2 = document.createElement('h2');
    h2.textContent = 'Compliance';
    el.appendChild(h2);

    // calendar card
    const card = document.createElement('div');
    card.className = 'cal-card';

    // nav header
    const navRow = document.createElement('div');
    navRow.className = 'cal-nav';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'secondary';
    prevBtn.textContent = '< Prev';
    prevBtn.addEventListener('click', () => {
      if (calState.month === 0) { calState.month = 11; calState.year -= 1; }
      else { calState.month -= 1; }
      renderComplianceCalendar(allAlerts);
    });

    const monthLabel = document.createElement('span');
    monthLabel.className = 'cal-month-label';
    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthLabel.textContent = `${MONTH_NAMES[calState.month]} ${calState.year}`;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'secondary';
    nextBtn.textContent = 'Next >';
    nextBtn.addEventListener('click', () => {
      if (calState.month === 11) { calState.month = 0; calState.year += 1; }
      else { calState.month += 1; }
      renderComplianceCalendar(allAlerts);
    });

    const nextEventBtn = document.createElement('button');
    nextEventBtn.type = 'button';
    nextEventBtn.className = 'secondary';
    nextEventBtn.textContent = 'Next event';
    nextEventBtn.addEventListener('click', () => {
      // last day of current viewed month (UTC)
      const lastDay = SB.dates.formatISO(new Date(Date.UTC(calState.year, calState.month + 1, 0)).getTime());
      const ahead = allAlerts.find((a) => a.alertDate > lastDay);
      if (ahead) {
        const d = new Date(SB.dates.parseISO(ahead.alertDate));
        calState.year = d.getUTCFullYear();
        calState.month = d.getUTCMonth();
        renderComplianceCalendar(allAlerts);
      } else {
        noNextNote.hidden = false;
      }
    });

    navRow.appendChild(prevBtn);
    navRow.appendChild(monthLabel);
    navRow.appendChild(nextBtn);
    navRow.appendChild(nextEventBtn);
    card.appendChild(navRow);

    const noNextNote = document.createElement('p');
    noNextNote.className = 'muted cal-no-next';
    noNextNote.textContent = 'No further events ahead.';
    noNextNote.hidden = true;
    card.appendChild(noNextNote);

    // build grid
    const grid = document.createElement('div');
    grid.className = 'cal-grid';

    const DOW_HEADERS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    DOW_HEADERS.forEach((d) => {
      const hdr = document.createElement('div');
      hdr.className = 'cal-dow';
      hdr.textContent = d;
      grid.appendChild(hdr);
    });

    // first weekday of this month (Monday = 0)
    const firstDate = new Date(Date.UTC(calState.year, calState.month, 1));
    const startDow = (firstDate.getUTCDay() + 6) % 7; // 0=Mon
    const daysInMonth = new Date(Date.UTC(calState.year, calState.month + 1, 0)).getUTCDate();

    // alerts in this month indexed by day
    const pad2 = (n) => String(n).padStart(2, '0');
    const monthPrefix = `${calState.year}-${pad2(calState.month + 1)}-`;
    const alertsByDay = {};
    for (const a of allAlerts) {
      if (a.alertDate.startsWith(monthPrefix)) {
        const day = parseInt(a.alertDate.slice(8, 10), 10);
        if (!alertsByDay[day]) alertsByDay[day] = [];
        alertsByDay[day].push(a);
      }
    }

    // blank leading cells
    for (let i = 0; i < startDow; i++) {
      const blank = document.createElement('div');
      blank.className = 'cal-day cal-blank';
      grid.appendChild(blank);
    }

    // day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      const hasEvents = Boolean(alertsByDay[d]);
      if (hasEvents) cell.classList.add('has-event');
      const num = document.createElement('span');
      num.className = 'cal-day-num';
      num.textContent = String(d);
      cell.appendChild(num);
      if (hasEvents) {
        const dot = document.createElement('span');
        dot.className = 'cal-event-dot';
        cell.appendChild(dot);
        cell.addEventListener('click', () => {
          const iso = `${calState.year}-${pad2(calState.month + 1)}-${pad2(d)}`;
          // scroll / highlight the event list entries for this day
          el.querySelectorAll('.cal-event-row').forEach((row) => {
            row.classList.toggle('cal-event-highlight', row.dataset.alertDate === iso);
          });
        });
      }
      grid.appendChild(cell);
    }

    card.appendChild(grid);

    // in-month alert list
    const monthAlerts = allAlerts.filter((a) => a.alertDate.startsWith(monthPrefix));
    if (monthAlerts.length) {
      const listHead = document.createElement('h3');
      listHead.className = 'cal-list-head';
      listHead.textContent = 'Events this month';
      card.appendChild(listHead);
      monthAlerts.forEach((a) => {
        const row = document.createElement('p');
        row.className = 'cal-event-row';
        row.dataset.alertDate = a.alertDate;
        row.textContent = `${SB.dates.toDisplay(a.alertDate)} - ${a.who} - ${a.detail} will expire ${SB.dates.toDisplay(a.realExpiry)}`;
        card.appendChild(row);
      });
    } else {
      const none = document.createElement('p');
      none.className = 'muted';
      none.textContent = 'No expiry alerts this month.';
      card.appendChild(none);
    }

    el.appendChild(card);

    // availability / resting overview
    const resting = SB.compliance.availabilityOverview(state.engineers, today());
    const restHead = document.createElement('h3');
    restHead.textContent = 'Availability (currently resting)';
    el.appendChild(restHead);
    if (resting.length) {
      const table = document.createElement('table');
      table.innerHTML = `<thead><tr><th>Who</th><th>Availability</th></tr></thead><tbody>${
        resting.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.availability}</td></tr>`).join('')
      }</tbody>`;
      el.appendChild(table);
    } else {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'Everyone is fully rested.';
      el.appendChild(p);
    }
  }

  function renderNextPick() {
    const s = state.settings;
    const opts = (arr) => arr.map((x) => `<option>${esc(x)}</option>`).join('');
    const certChecks = s.certTypes.map((c) => `<label class="inline"><input type="checkbox" value="${esc(c)}" ${(s.offshoreRequiredCerts||[]).includes(c)?'checked':''}> ${esc(c)}</label>`).join(' ');
    $('nextpick').innerHTML = `<h2>Find next pick</h2>
      <div class="card">
        <label>Job title <input type="text" id="j_title" placeholder="Optional label"></label>
        <label>Equipment <select id="j_eq">${opts(s.equipment)}</select></label>
        <label>Repair type <select id="j_rep">${opts(s.repairTypes)}</select></label>
        <label>Destination country <select id="j_country">${opts(SB.countries)}</select></label>
        <label class="inline"><input type="checkbox" id="j_off" checked> Offshore</label>
        <label>Start date <input type="text" id="j_start" placeholder="dd/mm/yyyy" value="01/08/2026"></label>
        <label>Duration (days) <input type="number" id="j_dur" value="10" min="1"></label>
        <label>Team size <input type="number" id="j_team" value="1" min="1" step="1"></label>
        <div id="reqCerts">Required certificates:<br>${certChecks}</div>
        <button id="runPick">Find engineers</button>
      </div>
      <div id="pickResult"></div>`;
    $('runPick').addEventListener('click', runPick);
  }

  function runPick() {
    const titleVal = $('j_title').value.trim();
    const equipment = $('j_eq').value;
    const repairType = $('j_rep').value;
    const startDate = SB.dates.fromDisplay($('j_start').value);
    if (!startDate) { $('pickResult').innerHTML = '<p class="warn">Enter a valid start date as dd/mm/yyyy.</p>'; return; }
    const job = {
      equipment, repairType,
      country: $('j_country').value, offshore: $('j_off').checked,
      startDate, durationDays: Number($('j_dur').value),
      requiredCerts: SB.engine.filterKnownCerts(
        [...document.querySelectorAll('#reqCerts input[type=checkbox]:checked')].map((c) => c.value),
        state.settings.certTypes,
      ),
    };
    const teamSize = Number($('j_team').value) || 1;
    const r = SB.engine.nextPick(job, state.engineers, state.settings);
    const jobEndISO = SB.dates.formatISO(SB.eligibility.jobEndMs(job));

    const RULE = {
      'no-competence': 'no matching competence',
      'no-valid-passport': 'passport invalid within 6 months',
      'needs-visa': 'no valid visa for destination',
      'cert-missing-or-expired': 'required certificate missing or expired',
      'on-vacation': 'on vacation during the job',
      'double-booked': 'already booked on an overlapping job',
    };

    let html = '';

    // max-consecutive warning
    if (job.durationDays > state.settings.maxConsecutiveDays) {
      html += `<p class="warn">Warning: ${esc(String(job.durationDays))} days exceeds the maximum consecutive offshore days (${esc(String(state.settings.maxConsecutiveDays))}).</p>`;
    }

    // recommended team (lead + assistants), for any team size >= 2
    if (teamSize >= 2 && r.shortlist.length >= 1) {
      const team = r.shortlist.slice(0, teamSize);
      const assistants = team.slice(1).map((x) => esc(x.name)).join(', ');
      html += `<p><strong>Recommended team of ${esc(String(teamSize))}:</strong> Lead: ${esc(team[0].name)}${assistants ? ' | Assistants: ' + assistants : ''}</p>`;
      if (r.shortlist.length < teamSize) {
        html += `<p class="warn">Only ${esc(String(r.shortlist.length))} eligible engineer${r.shortlist.length === 1 ? '' : 's'} for a team of ${esc(String(teamSize))}.</p>`;
      }
    }

    html += '<h3>Shortlist</h3>';
    if (r.shortlist.length) {
      html += `<table><thead><tr><th>Rank</th><th>Name</th><th>Level</th><th>Status</th><th>Reason</th><th></th></tr></thead><tbody>`;
      r.shortlist.forEach((x, i) => {
        const pill = x.overtime
          ? '<span class="pill ot">overtime</span>'
          : '<span class="pill ok">available</span>';
        html += `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${esc(String(x.level !== undefined ? x.level : ''))}</td><td>${pill}</td><td>${esc(x.reason)}</td><td><button class="assign-btn" data-eng-id="${esc(String(x.id))}">Assign</button></td></tr>`;
      });
      html += '</tbody></table>';
    } else {
      html += '<p class="muted">No eligible engineers for this job.</p>';
    }

    const excluded = r.excluded.length
      ? `<h3>Excluded</h3><table class="excluded"><tbody>` + r.excluded.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(RULE[x.failedRule] || x.failedRule)}</td></tr>`).join('') + '</tbody></table>'
      : '';

    $('pickResult').innerHTML = html + excluded;

    // wire Assign buttons
    $('pickResult').querySelectorAll('.assign-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const engId = btn.dataset.engId;
        const eng = state.engineers.find((e) => String(e.id) === engId);
        if (!eng) return;
        const assignTitle = titleVal || `${equipment}, ${repairType}`;
        const spec = { title: assignTitle, equipment, repairType, country: job.country, start: job.startDate, end: jobEndISO };
        const res = SB.jobs.assignToJob(state.jobs, spec, eng.id);
        state.jobs = res.jobs;
        SB.jobs.syncAssignments(state.engineers, state.jobs);
        markDirty();
        const confirmation = document.createElement('p');
        confirmation.className = 'ok-note';
        confirmation.textContent = `Assigned ${eng.name}`;
        $('pickResult').prepend(confirmation);
        runPick();
      });
    });
  }

  // ---- Settings tab ----
  function renderSettings() {
    const s = state.settings;
    const el = $('settings');
    el.innerHTML = '<h2>Settings</h2>';

    // ---- Rotation rules ----
    const rotSection = document.createElement('div');
    rotSection.className = 'edit-section';
    const rotHeading = document.createElement('h3');
    rotHeading.textContent = 'Rotation rules';
    rotSection.appendChild(rotHeading);

    function numberSettingRow(labelText, key, min, step) {
      const row = document.createElement('p');
      const lbl = document.createElement('label');
      lbl.textContent = labelText + ' ';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = String(s[key] !== undefined ? s[key] : '');
      inp.min = String(min);
      if (step !== undefined) inp.step = String(step);
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) { s[key] = v; markDirty(); }
      });
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) { s[key] = v; markDirty(); }
      });
      lbl.appendChild(inp);
      row.appendChild(lbl);
      return row;
    }

    rotSection.appendChild(numberSettingRow('Rest multiplier', 'restMultiplier', 0, 0.1));
    rotSection.appendChild(numberSettingRow('Minimum rest days', 'minRestDays', 0, 1));
    rotSection.appendChild(numberSettingRow('Max consecutive offshore days', 'maxConsecutiveDays', 1, 1));
    el.appendChild(rotSection);

    // ---- Offshore-required certificates ----
    const offSection = document.createElement('div');
    offSection.className = 'edit-section';
    const offHeading = document.createElement('h3');
    offHeading.textContent = 'Offshore-required certificates';
    offSection.appendChild(offHeading);

    const offList = document.createElement('div');
    offList.className = 'edit-list';
    (s.offshoreRequiredCerts || []).forEach((cert) => {
      const row = document.createElement('div');
      row.className = 'edit-row';
      const span = document.createElement('span');
      span.textContent = cert;
      const rb = document.createElement('button');
      rb.type = 'button'; rb.textContent = 'Remove'; rb.className = 'btn-remove';
      rb.addEventListener('click', () => {
        s.offshoreRequiredCerts = (s.offshoreRequiredCerts || []).filter((x) => x !== cert);
        markDirty();
        renderSettings();
      });
      row.appendChild(span);
      row.appendChild(rb);
      offList.appendChild(row);
    });
    offSection.appendChild(offList);

    const addOffRow = document.createElement('div');
    addOffRow.className = 'edit-row';
    const offSel = document.createElement('select');
    (s.certTypes || []).forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      offSel.appendChild(opt);
    });
    const addOffBtn = document.createElement('button');
    addOffBtn.type = 'button'; addOffBtn.textContent = 'Add';
    addOffBtn.addEventListener('click', () => {
      const val = offSel.value;
      if (!val) return;
      if (!s.offshoreRequiredCerts) s.offshoreRequiredCerts = [];
      if (s.offshoreRequiredCerts.includes(val)) return;
      s.offshoreRequiredCerts.push(val);
      markDirty();
      renderSettings();
    });
    addOffRow.appendChild(offSel);
    addOffRow.appendChild(addOffBtn);
    offSection.appendChild(addOffRow);
    el.appendChild(offSection);

    // ---- Standard editable lists ----
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

  // ---- Schedule tab ----
  function renderSchedule() {
    const el = $('schedule');
    el.innerHTML = '';

    const h2 = document.createElement('h2');
    h2.textContent = 'Schedule';
    el.appendChild(h2);

    const jobs = [...state.jobs].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

    if (jobs.length === 0) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No jobs yet. Assign engineers from "Find next pick" to create a job.';
      el.appendChild(p);
      return;
    }

    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Job</th><th>Work</th><th>Country</th><th>From</th><th>To</th><th>Engineers</th></tr></thead>';
    const tbody = document.createElement('tbody');
    jobs.forEach((job) => {
      const names = job.engineerIds
        .map((id) => (state.engineers.find((e) => e.id === id) || {}).name)
        .filter(Boolean);
      const work = [job.equipment, job.repairType].filter(Boolean).join(' / ') || '—';
      const tr = document.createElement('tr');

      const tdJob = document.createElement('td');
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'link-btn';
      link.textContent = job.title || '(untitled job)';
      link.addEventListener('click', () => renderJobDetail(job.id));
      tdJob.appendChild(link);
      tr.appendChild(tdJob);

      tr.insertAdjacentHTML('beforeend',
        `<td>${esc(work)}</td><td>${esc(job.country || '—')}</td>` +
        `<td>${esc(SB.dates.toDisplay(job.start))}</td><td>${esc(SB.dates.toDisplay(job.end))}</td>` +
        `<td>${names.length ? esc(names.join(', ')) : '<span class="muted">none</span>'}</td>`);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    el.appendChild(table);
  }

  function jobDurationDays(job) {
    return SB.dates.daysBetween(SB.dates.parseISO(job.start), SB.dates.parseISO(job.end)) + 1;
  }

  // Informational eligibility warning for an engineer against a job (never blocks an add).
  // The engineer's own assignment to THIS job is ignored so it isn't flagged as a self-clash.
  function jobConflict(eng, job) {
    const others = { ...eng, assignments: (eng.assignments || []).filter((a) => a.jobId !== job.id) };
    const jobObj = {
      equipment: job.equipment, repairType: job.repairType, country: job.country, offshore: true,
      startDate: job.start, durationDays: jobDurationDays(job), requiredCerts: [],
    };
    const ev = SB.eligibility.evaluate(others, jobObj, state.settings);
    if (ev.eligible) return '';
    // Migrated jobs may carry no equipment/repair type; skip the competence check then.
    if (ev.failedRule === 'no-competence' && !(job.equipment && job.repairType)) return '';
    const RULE = {
      'no-competence': 'no matching competence', 'no-valid-passport': 'passport invalid within 6 months',
      'needs-visa': 'no valid visa for destination', 'cert-missing-or-expired': 'required certificate missing',
      'on-vacation': 'on vacation during the job', 'double-booked': 'already booked on an overlapping job',
    };
    return RULE[ev.failedRule] || ev.failedRule;
  }

  function renderJobDetail(jobId) {
    const el = $('schedule');
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) { renderSchedule(); return; }
    el.innerHTML = '';

    const back = document.createElement('button');
    back.type = 'button'; back.className = 'secondary'; back.textContent = '← Back to schedule';
    back.addEventListener('click', renderSchedule);
    el.appendChild(back);

    const h2 = document.createElement('h2');
    h2.textContent = job.title || '(untitled job)';
    el.appendChild(h2);

    const work = [job.equipment, job.repairType].filter(Boolean).join(' / ') || '—';
    const meta = document.createElement('p');
    meta.className = 'muted';
    meta.textContent = `${work} · ${job.country || '—'} · ${SB.dates.toDisplay(job.start)} → ${SB.dates.toDisplay(job.end)}`;
    el.appendChild(meta);

    // editable job fields
    const fields = document.createElement('div');
    fields.className = 'card';
    fields.innerHTML =
      `<label>Job title <input type="text" id="jd_title" value="${esc(job.title || '')}"></label>` +
      `<label>Country <input type="text" id="jd_country" value="${esc(job.country || '')}"></label>` +
      `<label>Start date <input type="text" id="jd_start" value="${esc(SB.dates.toDisplay(job.start))}" placeholder="dd/mm/yyyy"></label>` +
      `<label>End date <input type="text" id="jd_end" value="${esc(SB.dates.toDisplay(job.end))}" placeholder="dd/mm/yyyy"></label>`;
    el.appendChild(fields);

    // assigned engineers
    const engH = document.createElement('h3');
    engH.textContent = `Engineers (${job.engineerIds.length})`;
    el.appendChild(engH);

    const list = document.createElement('div');
    if (job.engineerIds.length === 0) {
      list.innerHTML = '<p class="muted">No engineers assigned.</p>';
    } else {
      job.engineerIds.forEach((id) => {
        const eng = state.engineers.find((e) => e.id === id);
        const conflict = eng ? jobConflict(eng, job) : '';
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<span>${esc(eng ? eng.name : id)}</span>` +
          (conflict ? ` <span class="conflict">(${esc(conflict)})</span>` : '');
        const rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'btn-remove'; rm.textContent = 'Remove';
        rm.addEventListener('click', () => {
          state.jobs = SB.jobs.removeEngineerFromJob(state.jobs, job.id, id);
          SB.jobs.syncAssignments(state.engineers, state.jobs);
          markDirty();
          renderJobDetail(job.id);
        });
        row.appendChild(rm);
        list.appendChild(row);
      });
    }
    el.appendChild(list);

    // add an engineer
    const available = state.engineers.filter((e) => !job.engineerIds.includes(e.id));
    if (available.length) {
      const addRow = document.createElement('div');
      addRow.className = 'row';
      const sel = document.createElement('select');
      sel.id = 'jd_addeng';
      available.forEach((e) => {
        const c = jobConflict(e, job);
        const o = document.createElement('option');
        o.value = e.id;
        o.textContent = e.name + (c ? ` — ${c}` : '');
        sel.appendChild(o);
      });
      const addBtn = document.createElement('button');
      addBtn.type = 'button'; addBtn.textContent = 'Add engineer';
      addBtn.addEventListener('click', () => {
        state.jobs = SB.jobs.addEngineerToJob(state.jobs, job.id, sel.value);
        SB.jobs.syncAssignments(state.engineers, state.jobs);
        markDirty();
        renderJobDetail(job.id);
      });
      addRow.appendChild(sel);
      addRow.appendChild(addBtn);
      el.appendChild(addRow);
    }

    // notes
    const notesH = document.createElement('h3');
    notesH.textContent = 'Notes';
    el.appendChild(notesH);
    const n = job.notes || SB.jobs.emptyNotes();
    const notes = document.createElement('div');
    notes.className = 'card';
    notes.innerHTML =
      `<label>Customer <input type="text" id="jd_customer" value="${esc(n.customer || '')}"></label>` +
      `<label>Contact person <input type="text" id="jd_contact" value="${esc(n.contact || '')}"></label>` +
      `<label>Phone <input type="text" id="jd_phone" value="${esc(n.phone || '')}"></label>` +
      `<label>Email <input type="text" id="jd_email" value="${esc(n.email || '')}"></label>` +
      `<label>Notes <textarea id="jd_text" rows="4">${esc(n.text || '')}</textarea></label>`;
    el.appendChild(notes);

    // save / delete
    const actions = document.createElement('div');
    actions.className = 'row';
    const saveJobBtn = document.createElement('button');
    saveJobBtn.type = 'button'; saveJobBtn.textContent = 'Save job details';
    saveJobBtn.addEventListener('click', () => {
      const start = SB.dates.fromDisplay($('jd_start').value);
      const end = SB.dates.fromDisplay($('jd_end').value);
      if (!start || !end) { window.alert('Enter valid start and end dates as dd/mm/yyyy.'); return; }
      if (end < start) { window.alert('End date cannot be before the start date.'); return; }
      const idx = state.jobs.findIndex((j) => j.id === job.id);
      if (idx === -1) return;
      state.jobs[idx] = {
        ...job,
        title: $('jd_title').value.trim(),
        country: $('jd_country').value.trim(),
        start, end,
        notes: {
          customer: $('jd_customer').value.trim(), contact: $('jd_contact').value.trim(),
          phone: $('jd_phone').value.trim(), email: $('jd_email').value.trim(), text: $('jd_text').value.trim(),
        },
      };
      SB.jobs.syncAssignments(state.engineers, state.jobs);
      markDirty();
      renderJobDetail(job.id);
    });
    const delJobBtn = document.createElement('button');
    delJobBtn.type = 'button'; delJobBtn.className = 'btn-remove'; delJobBtn.textContent = 'Delete job';
    delJobBtn.addEventListener('click', () => {
      if (!window.confirm('Delete this job and unassign its engineers?')) return;
      state.jobs = SB.jobs.deleteJob(state.jobs, job.id);
      SB.jobs.syncAssignments(state.engineers, state.jobs);
      markDirty();
      renderSchedule();
    });
    actions.appendChild(saveJobBtn);
    actions.appendChild(delJobBtn);
    el.appendChild(actions);
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
      const payload = { meta: { appVersion: 2 }, settings: state.settings, engineers: state.engineers, jobs: state.jobs };
      const env = await SB.crypto.encrypt(payload, pw);
      const blob = new Blob([JSON.stringify(env)], { type: 'application/json' });
      const d = new Date();
      const name = `service-scheduler-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.sbs`;
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
    state.engineers = []; state.settings = null; state.jobs = []; state.password = '';
    state.dirty = false; $('fileState').textContent = 'No roster loaded';
    $('tabs').hidden = true;
    for (const t of ['roster','nextpick','compliance','settings','schedule']) $(t).hidden = true;
    const panel = $('savePanel');
    if (panel) panel.hidden = true;
    // reset lock screen inputs
    $('fileInput').value = ''; $('pw').value = '';
    const m = $('meter'); m.className = 'meter'; m.innerHTML = '<span></span>';
    const ml = $('meterLabel'); if (ml) ml.textContent = '';
    $('lockError').hidden = true;
    $('lock').hidden = false;
  });

  SB.ui = { state, calState, markDirty, markClean, showTab, renderRoster, renderEngineerDetail, renderCompliance, renderNextPick, renderSettings, renderSchedule };
})();
