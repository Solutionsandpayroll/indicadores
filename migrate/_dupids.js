const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'scraper', 'output');
console.log('Archivo'.padEnd(40), 'Filas', 'IDs únicos', 'Duplicados');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const ids = new Set();
  let total = 0;
  for (const g of j.entregables || []) {
    for (const grupo of g.sub_entregables || []) {
      for (const sub of grupo.filas || []) { total++; ids.add(sub.id); }
    }
  }
  const dup = total - ids.size;
  console.log(f.padEnd(40), String(total).padStart(5), String(ids.size).padStart(10), String(dup).padStart(10), dup > 0 ? ' <-- DUPLICADOS' : '');
}
