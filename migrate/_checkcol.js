/** Verifica si la columna entregable_tipos.nombre ya fue ampliada a 255. */
const fs = require('fs');
const path = require('path');
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

(async () => {
  const base = process.env.SUPABASE_URL + '/rest/v1/';
  const res = await fetch(base, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const spec = await res.json();
  const defs = spec.definitions || spec.components?.schemas || {};
  // Buscar la definición de entregable_tipos
  for (const [name, def] of Object.entries(defs)) {
    if (name.toLowerCase().includes('entregable_tipos') || name.toLowerCase().includes('entregabletipos')) {
      const props = def.properties || {};
      if (props.nombre) {
        console.log(`Definición ${name}: nombre maxLength=${props.nombre.maxLength || props.nombre.length || 'N/A'}`, JSON.stringify(props.nombre));
      }
    }
  }
  // También buscar en la tabla entregables.tipo
  for (const [name, def] of Object.entries(defs)) {
    if (name.toLowerCase() === 'entregables' || name.toLowerCase().includes('entregables')) {
      const props = def.properties || {};
      if (props.tipo) console.log(`entregables.tipo:`, JSON.stringify(props.tipo));
    }
  }
})();
