const fs = require('fs');
const path = require('path');
const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scraper', 'output', 'entregables-2023-diciembre.json'), 'utf8'));

const generales = j.entregables.filter((g) => (g.cliente || '').trim().toUpperCase() === 'HL COLOMBIA');
console.log('Generales de HL COLOMBIA:', generales.length);

let subTot = 0;
const porGrupo = new Map(); // clave -> {count, distinct, muestras}
for (const g of generales) {
  for (const grupo of g.sub_entregables || []) {
    for (const sub of grupo.filas) {
      subTot++;
      const clave = `${grupo.indicador}|${sub.entregable}|${sub.responsable}`;
      if (!porGrupo.has(clave)) porGrupo.set(clave, { count: 0, ids: new Set(), fechas: new Set(), muestras: [] });
      const p = porGrupo.get(clave);
      p.count++;
      p.ids.add(sub.id);
      const fec = `${sub.meta_date}|${sub.meta_number}|${sub.meta_result}|${sub.verified_date}`;
      p.fechas.add(fec);
      p.muestras.push(sub);
    }
  }
}
console.log('Sub-entregables totales:', subTot);
console.log('Claves únicas (indicador|entregable|responsable):', porGrupo.size);

let conDuplicados = 0, extraExactos = 0, extraDistintos = 0;
for (const [clave, p] of porGrupo) {
  if (p.count < 2) continue;
  conDuplicados++;
  const extra = p.count - 1;
  if (p.fechas.size === 1) { extraExactos += extra; } else { extraDistintos += extra; }
}
console.log(`Grupos con duplicados: ${conDuplicados} | Extras exactos (mismas fechas): ${extraExactos} | Extras distintos: ${extraDistintos}`);

// Mostrar algunos grupos con muchos duplicados
console.log('\nGrupos con más repeticiones:');
[...porGrupo.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10).forEach(([clave, p]) => {
  console.log(`  ${p.count}x [${clave}] fechas distintas: ${p.fechas.size}`);
});
