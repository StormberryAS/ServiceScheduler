;(function () {
  const SB = (globalThis.SB ||= {});
  const EQUIP = ['offshore crane','winch system','Launch and Recovery System (LARS)','lifeboat/davit system','hydraulic power unit (HPU) / control system'];
  const REPAIRS = ['preventive (scheduled) service','corrective (breakdown) repair','overhaul and recertification (including load test)'];
  const CERTS = ['offshore safety course','sea survival','H2S awareness','working at height','first aid'];
  const COUNTRIES = ['Norway','United Kingdom','Netherlands','Brazil','United Arab Emirates','Angola','Australia','Syria'];
  const settings = () => ({ restRule:'equal-to-previous-trip', passportInvalidMonths:6, passportBufferMonths:12,
    equipment:[...EQUIP], repairTypes:[...REPAIRS], certTypes:[...CERTS], countries:[...COUNTRIES] });

  const allCerts = (expiry) => CERTS.map((type) => ({ type, expiry }));
  const comp = (equipment, repairType, level) => ({ equipment, repairType, level });

  const engineers = () => ([
    // 1. clean, fully rested, obvious pick
    { id:'e01', name:'Lars Pedersen', nationalities:['Norway'],
      passports:[{country:'Norway',number:'NO11111',expiry:'2031-04-01'}], visas:[{country:'United Kingdom',type:'Work (Service Supplier visa)',expiry:'2028-01-01'}],
      certs:allCerts('2028-01-01'), competence:[comp('offshore crane','preventive (scheduled) service',3), comp('winch system','corrective (breakdown) repair',2)],
      availability:{ lastOffshore:{ end:'2026-05-01', durationDays:14 }, restDaysOverride:null, vacations:[] } },
    // 2. still resting -> overtime flag
    { id:'e02', name:'Ingrid Solheim', nationalities:['Norway'],
      passports:[{country:'Norway',number:'NO22222',expiry:'2030-06-01'}], visas:[{country:'United Kingdom',type:'Work (Service Supplier visa)',expiry:'2027-09-01'}],
      certs:allCerts('2027-06-01'), competence:[comp('offshore crane','preventive (scheduled) service',3)],
      availability:{ lastOffshore:{ end:'2026-07-25', durationDays:21 }, restDaysOverride:null, vacations:[] } },
    // 3. passport inside 6-month invalid window for an Aug job
    { id:'e03', name:'Tom Eriksen', nationalities:['Norway'],
      passports:[{country:'Norway',number:'NO33333',expiry:'2026-10-01'}], visas:[{country:'United Kingdom',type:'Work (Service Supplier visa)',expiry:'2027-01-01'}],
      certs:allCerts('2027-01-01'), competence:[comp('offshore crane','preventive (scheduled) service',2)],
      availability:{ lastOffshore:null, restDaysOverride:null, vacations:[] } },
    // 4. on vacation across early August
    { id:'e04', name:'Sofia Haugen', nationalities:['Norway'],
      passports:[{country:'Norway',number:'NO44444',expiry:'2031-01-01'}], visas:[{country:'United Kingdom',type:'Work (Service Supplier visa)',expiry:'2028-01-01'}],
      certs:allCerts('2028-01-01'), competence:[comp('offshore crane','preventive (scheduled) service',3)],
      availability:{ lastOffshore:{ end:'2026-04-01', durationDays:10 }, restDaysOverride:null, vacations:[{ start:'2026-07-25', end:'2026-08-15' }] } },
    // 5. dual national, no UK visa needed
    { id:'e05', name:'James Olsen', nationalities:['Norway','United Kingdom'],
      passports:[{country:'Norway',number:'NO55555',expiry:'2030-01-01'},{country:'United Kingdom',number:'UK55555',expiry:'2030-01-01'}], visas:[],
      certs:allCerts('2027-08-01'), competence:[comp('offshore crane','preventive (scheduled) service',3)],
      availability:{ lastOffshore:{ end:'2026-05-15', durationDays:12 }, restDaysOverride:null, vacations:[] } },
    // 6. matches crane but missing offshore safety course (expired)
    { id:'e06', name:'Nora Berg', nationalities:['Norway'],
      passports:[{country:'Norway',number:'NO66666',expiry:'2031-01-01'}], visas:[{country:'United Kingdom',type:'Work (Service Supplier visa)',expiry:'2028-01-01'}],
      certs:[{type:'offshore safety course',expiry:'2026-06-01'},{type:'sea survival',expiry:'2028-01-01'},{type:'H2S awareness',expiry:'2028-01-01'},{type:'working at height',expiry:'2028-01-01'},{type:'first aid',expiry:'2028-01-01'}],
      competence:[comp('offshore crane','preventive (scheduled) service',2)],
      availability:{ lastOffshore:null, restDaysOverride:null, vacations:[] } },
    // 7-15: varied ordinary engineers across equipment, countries, rest states
    { id:'e07', name:'Mateus Almeida', nationalities:['Brazil'], passports:[{country:'Brazil',number:'BR70000',expiry:'2029-03-01'}],
      visas:[{country:'United Kingdom',type:'Work (Service Supplier visa)',expiry:'2027-05-01'},{country:'Norway',type:'Work (residence permit)',expiry:'2027-05-01'},{country:'Norway',type:'Norway temporary residency',expiry:'2027-08-01'}], certs:allCerts('2027-10-01'),
      competence:[comp('winch system','overhaul and recertification (including load test)',3), comp('Launch and Recovery System (LARS)','corrective (breakdown) repair',2)],
      availability:{ lastOffshore:{ end:'2026-06-10', durationDays:18 }, restDaysOverride:null, vacations:[] } },
    { id:'e08', name:'Wouter Smit', nationalities:['Netherlands'], passports:[{country:'Netherlands',number:'NL80000',expiry:'2030-09-01'}],
      visas:[{country:'United Kingdom',type:'Work (Service Supplier visa)',expiry:'2028-01-01'},{country:'Norway',type:'Norway permanent residency',expiry:'2031-03-01'}], certs:allCerts('2028-02-01'),
      competence:[comp('hydraulic power unit (HPU) / control system','preventive (scheduled) service',3)],
      availability:{ lastOffshore:{ end:'2026-03-20', durationDays:9 }, restDaysOverride:null, vacations:[] } },
    { id:'e09', name:'Aisha Rahman', nationalities:['United Kingdom','Syria'],
      passports:[{country:'United Kingdom',number:'UK90000',expiry:'2031-02-01'},{country:'Syria',number:'SY90000',expiry:'2031-02-01'}],
      visas:[{country:'Norway',type:'Norway temporary residency',expiry:'2027-11-01'}], certs:allCerts('2027-12-01'), competence:[comp('lifeboat/davit system','overhaul and recertification (including load test)',2)],
      availability:{ lastOffshore:null, restDaysOverride:null, vacations:[] } },
    { id:'e10', name:'Kari Nilsen', nationalities:['Norway'], passports:[{country:'Norway',number:'NO10000',expiry:'2029-11-01'}],
      visas:[{country:'Angola',type:'Work visa',expiry:'2027-03-01'}], certs:allCerts('2027-04-01'),
      competence:[comp('winch system','preventive (scheduled) service',2)],
      availability:{ lastOffshore:{ end:'2026-05-20', durationDays:15 }, restDaysOverride:null, vacations:[] } },
    { id:'e11', name:'Diego Santos', nationalities:['Brazil'], passports:[{country:'Brazil',number:'BR11000',expiry:'2028-07-01'}],
      visas:[{country:'United Kingdom',type:'Work (Service Supplier visa)',expiry:'2027-02-01'},{country:'Norway',type:'Norway permanent residency',expiry:'2032-06-01'}], certs:allCerts('2027-03-01'),
      competence:[comp('offshore crane','corrective (breakdown) repair',2), comp('winch system','corrective (breakdown) repair',3)],
      availability:{ lastOffshore:{ end:'2026-06-15', durationDays:20 }, restDaysOverride:null, vacations:[] } },
    { id:'e12', name:'Elena Costa', nationalities:['Brazil','United Kingdom'],
      passports:[{country:'Brazil',number:'BR12000',expiry:'2030-01-01'},{country:'United Kingdom',number:'UK12000',expiry:'2030-01-01'}],
      visas:[{country:'Norway',type:'Norway temporary residency',expiry:'2027-06-01'}], certs:allCerts('2028-01-01'), competence:[comp('lifeboat/davit system','preventive (scheduled) service',3)],
      availability:{ lastOffshore:{ end:'2026-04-25', durationDays:11 }, restDaysOverride:null, vacations:[] } },
    { id:'e13', name:'Henrik Dahl', nationalities:['Norway'], passports:[{country:'Norway',number:'NO13000',expiry:'2027-02-15'}],
      visas:[{country:'United Kingdom',type:'Work (Service Supplier visa)',expiry:'2028-01-01'}], certs:allCerts('2027-07-01'),
      competence:[comp('hydraulic power unit (HPU) / control system','corrective (breakdown) repair',2)],
      availability:{ lastOffshore:{ end:'2026-05-05', durationDays:13 }, restDaysOverride:null, vacations:[] } },
    { id:'e14', name:'Liam Murphy', nationalities:['United Kingdom'], passports:[{country:'United Kingdom',number:'UK14000',expiry:'2031-06-01'}],
      visas:[{country:'Norway',type:'Work (residence permit)',expiry:'2028-01-01'},{country:'Norway',type:'Norway permanent residency',expiry:'2031-09-01'}], certs:allCerts('2028-03-01'),
      competence:[comp('Launch and Recovery System (LARS)','overhaul and recertification (including load test)',3)],
      availability:{ lastOffshore:{ end:'2026-06-01', durationDays:16 }, restDaysOverride:null, vacations:[] } },
    { id:'e15', name:'Mia Johansen', nationalities:['Norway'], passports:[{country:'Norway',number:'NO15000',expiry:'2030-12-01'}],
      visas:[{country:'United Kingdom',type:'Work (Service Supplier visa)',expiry:'2027-11-01'}], certs:allCerts('2027-09-01'),
      competence:[comp('offshore crane','preventive (scheduled) service',1), comp('lifeboat/davit system','corrective (breakdown) repair',2)],
      availability:{ lastOffshore:null, restDaysOverride:null, vacations:[] } },
  ]);
  SB.demo = { settings, engineers };
})();
