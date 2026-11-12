/** Mapeo de líderes y responsables para los clientes nuevos de agosto. */
const fs = require('fs');
const path = require('path');
const j = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'scraper', 'output', 'entregables-2026-agosto.json'), 'utf8'));

const clientes = [
  'RIVERMATE COSTA RICA', 'GARANTI PLUS COSTA RICA', 'NAZDAR INK TECHNOLOGIES',
  'MARKETING DOCTORS LLC', 'FLEXIBLE STEEL LACING CO', 'ONCEHUB LTD',
  'NEO SOLUCIONES INFORMATICAS SL', 'HEMMERSBACH GMBH & CO. KG 5742OC',
  'HEMMERSBACH GMBH & CO. KG 7072OC', 'HEMMERSBACH GMBH & CO. KG 8822OC',
  'HEMMERSBACH GMBH & CO. KG 8832OC', 'HEMMERSBACH GMBH & CO. KG 8862OC',
  'HONG KONG YONYOU XINFUSHE CLOUD TECHNOLOGY CO., LIMITED',
  'BUBBLE DO BRASIL SERVICOS TECNOLOGICOS LTDA', 'ACTION ADVERTISING AGENCY LLC',
  'POCPHARMA', 'SIFFI', 'BETEBUNA', 'ELEPHANT', 'SAILGLOBAL', 'MARCOPAYROLL',
  'SUNCHINE AU PAIR', 'EMATYS INTERNATIONAL',
];

const porCliente = new Map();
for (const c of j.entregables) {
  const nombre = (c.cliente || '').trim();
  if (!clientes.includes(nombre)) continue;
  if (!porCliente.has(nombre)) porCliente.set(nombre, { lideres: new Set(), resp: new Set(), subs: 0 });
  const e = porCliente.get(nombre);
  (c.sub_entregables || []).forEach((g) => g.filas.forEach((s) => {
    e.lideres.add(s.verified_user);
    e.resp.add(s.responsable);
    e.subs++;
  }));
}

console.log('Cliente | Líder(es) | Responsable(s) | Subs');
console.log('-'.repeat(80));
for (const c of clientes) {
  const e = porCliente.get(c);
  if (!e) { console.log(`${c} | (sin datos)`); continue; }
  console.log(`${c} | ${[...e.lideres].join(', ')} | ${[...e.resp].join(', ')} | ${e.subs}`);
}
