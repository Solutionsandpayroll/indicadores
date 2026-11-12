const fs = require('fs');
const path = require('path');
const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const nombre = process.argv[3];
const g = j.entregables.find((e) => (e.cliente || '').trim() === nombre);
if (!g) { console.log('No encontrado:', nombre); process.exit(0); }
const lid = new Set(); const resp = new Set(); let n = 0;
(g.sub_entregables || []).forEach((x) => x.filas.forEach((s) => { lid.add(s.verified_user); resp.add(s.responsable); n++; }));
console.log(`General ${g.id} - Subs: ${n}`);
console.log(`Líder(es): ${[...lid].join(', ')}`);
console.log(`Responsable(s): ${[...resp].join(', ')}`);
