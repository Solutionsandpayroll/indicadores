/**
 * Reconocimiento de la BD: formato de fechas, indicadores, tipos, usuarios y clientes.
 * Uso: node recon.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', '@supabase', 'supabase-js'));

// Carga manual del .env del backend
function loadEnv() {
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
}
loadEnv();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: inds } = await supabase.from('indicadores').select('id, nombre').order('id');
  console.log('=== INDICADORES ===');
  console.log(JSON.stringify(inds, null, 2));

  const { data: ents } = await supabase.from('entregables')
    .select('id, mes, anio, fecha_compromiso, resultado, cantidad_compromiso, resultado_cantidad, indicador_id, es_nuevo_modelo')
    .limit(8);
  console.log('\n=== ENTREGABLES MUESTRA ===');
  console.log(JSON.stringify(ents, null, 2));

  const { data: tipos } = await supabase.from('entregable_tipos').select('id, cliente_id, indicador_id, nombre').limit(10);
  console.log('\n=== TIPOS MUESTRA ===');
  console.log(JSON.stringify(tipos, null, 2));

  const { data: users } = await supabase.from('usuarios').select('id, usuario, nombre, rol').limit(10);
  console.log('\n=== USUARIOS MUESTRA ===');
  console.log(JSON.stringify(users, null, 2));

  const { data: clientes } = await supabase.from('clientes').select('id, cliente').limit(10);
  console.log('\n=== CLIENTES MUESTRA ===');
  console.log(JSON.stringify(clientes, null, 2));

  // Conteos
  const { count: nClientes } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
  const { count: nUsuarios } = await supabase.from('usuarios').select('*', { count: 'exact', head: true });
  const { count: nTipos } = await supabase.from('entregable_tipos').select('*', { count: 'exact', head: true });
  const { count: nEntregables } = await supabase.from('entregables').select('*', { count: 'exact', head: true });
  console.log('\n=== CONTEOS ===');
  console.log(`clientes=${nClientes} usuarios=${nUsuarios} tipos=${nTipos} entregables=${nEntregables}`);
})();
