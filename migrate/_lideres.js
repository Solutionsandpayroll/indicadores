const fs = require('fs');
const path = require('path');
const j = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'scraper', 'output', 'entregables-2026-junio.json'), 'utf8'));

const objetivos = [
  'GUATEMALA S&P HL',
  'ZAMBON COLOMBIA SAS',
];

for (const nombre of objetivos) {
  const general = j.entregables.find((e) => e.cliente === nombre);
  if (!general) { console.log(`${nombre}: NO encontrado en el JSON`); continue; }
  const líderes = new Set();
  const responsables = new Set();
  (general.sub_entregables || []).forEach((g) => g.filas.forEach((s) => {
    líderes.add(s.verified_user);
    responsables.add(s.responsable);
  }));
  console.log(`\n=== ${nombre} (general ${general.id}) ===`);
  console.log(`  Líder(es): ${[...líderes].join(', ')}`);
  console.log(`  Responsable(s): ${[...responsables].join(', ')}`);
  console.log(`  Sub-entregables: ${(general.sub_entregables || []).reduce((s, g) => s + g.filas.length, 0)}`);
}
