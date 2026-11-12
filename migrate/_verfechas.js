const fs = require('fs');
const path = require('path');
const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ids = ['35.078', '35.238'];
for (const g of j.entregables) {
  for (const grupo of g.sub_entregables || []) {
    for (const s of grupo.filas) {
      if (ids.includes(s.id)) {
        console.log(`sub ${s.id} · general ${g.id} · cliente "${g.cliente}"`);
        console.log(`  indicador: ${grupo.indicador}`);
        console.log(`  entregable: ${s.entregable}`);
        console.log(`  meta_date: "${s.meta_date}"`);
        console.log(`  meta_result: "${s.meta_result}"`);
        console.log(`  meta_number: "${s.meta_number}"`);
        console.log('');
      }
    }
  }
}
