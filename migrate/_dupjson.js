const fs = require('fs');
const path = require('path');
const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scraper', 'output', 'entregables-2023-diciembre.json'), 'utf8'));

const grupos = new Map();
for (const g of j.entregables) {
  for (const grupo of g.sub_entregables || []) {
    for (const sub of grupo.filas) {
      const clave = `${g.cliente}|${grupo.indicador}|${sub.entregable}|${sub.responsable}`;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(sub);
    }
  }
}
let dupGrupos = 0, dupRegistros = 0, difieren = 0;
for (const [clave, arr] of grupos) {
  if (arr.length < 2) continue;
  dupGrupos++;
  dupRegistros += arr.length - 1;
  // Comparar campos relevantes
  const campos = ['meta_date', 'meta_number', 'meta_result', 'verified_date'];
  const distintos = new Set(arr.map((s) => campos.map((c) => s[c]).join('~')));
  if (distintos.size > 1) {
    difieren++;
    if (difieren <= 5) {
      console.log(`DIFIEREN [${clave}]`);
      for (const s of arr) console.log('   ', JSON.stringify({ id: s.id, meta_date: s.meta_date, meta_number: s.meta_number, meta_result: s.meta_result, verified_date: s.verified_date }));
    }
  }
}
console.log(`Grupos con duplicados: ${dupGrupos} | Registros duplicados: ${dupRegistros} | Grupos que difieren en campos: ${difieren}`);
