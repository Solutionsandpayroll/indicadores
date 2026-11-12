/** Quita filas duplicadas por ID de sub-entregable en cada JSON (conserva la primera).
 *  Hace backup en output/backup/ antes de modificar. */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'scraper', 'output');
const backupDir = path.join(dir, 'backup');
fs.mkdirSync(backupDir, { recursive: true });

const solo = process.argv.slice(2); // archivos opcionales
const files = fs.readdirSync(dir)
  .filter((f) => f.startsWith('entregables-') && f.endsWith('.json'))
  .filter((f) => !solo.length || solo.includes(f));

let totalFilas = 0, totalQuitas = 0;
for (const f of files) {
  const full = path.join(dir, f);
  const j = JSON.parse(fs.readFileSync(full, 'utf8'));
  const vistos = new Set();
  let quitas = 0, filas = 0;
  for (const g of j.entregables || []) {
    for (const grupo of g.sub_entregables || []) {
      const antes = (grupo.filas || []).length;
      grupo.filas = (grupo.filas || []).filter((s) => {
        filas++;
        if (s.id && vistos.has(s.id)) { quitas++; return false; }
        if (s.id) vistos.add(s.id);
        return true;
      });
    }
  }
  totalFilas += filas; totalQuitas += quitas;
  if (quitas === 0) { console.log(`${f}: 0 duplicados (sin cambios)`); continue; }
  fs.copyFileSync(full, path.join(backupDir, f));
  fs.writeFileSync(full, JSON.stringify(j, null, 2));
  console.log(`${f}: ${filas} filas -> ${filas - quitas} (quitados ${quitas}) [backup ok]`);
}
console.log(`\nTOTAL: ${totalFilas} filas, ${totalQuitas} duplicados quitados`);
