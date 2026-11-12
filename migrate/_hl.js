const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', '@supabase', 'supabase-js'));
function loadEnv() {
  const c = fs.readFileSync(path.join(__dirname, '..', 'backend', '.env'), 'utf8');
  for (const l of c.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv();
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const dir = path.join(__dirname, '..', 'scraper', 'output');
  let totalJson = 0;
  const porMes = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    let n = 0;
    for (const g of j.entregables || []) {
      if ((g.cliente || '').trim().toUpperCase() !== 'HL COLOMBIA') continue;
      for (const grupo of g.sub_entregables || []) n += (grupo.filas || []).length;
    }
    if (n > 0) { porMes[f] = n; totalJson += n; }
  }
  console.log('Sub-entregables HL COLOMBIA por JSON:');
  for (const [f, n] of Object.entries(porMes)) console.log(`  ${f}: ${n}`);
  console.log('TOTAL en JSONs:', totalJson);

  const { count: bdTotal } = await s.from('entregables').select('*', { count: 'exact', head: true }).eq('cliente_id', 1);
  const { count: bdDic } = await s.from('entregables').select('*', { count: 'exact', head: true }).eq('cliente_id', 1).eq('anio', 2023).eq('mes', 12);
  console.log('En BD - HL COLOMBIA total:', bdTotal, '| dic 2023:', bdDic);
})();
