# Comandos del proyecto

## Iniciar servidores

**Backend** (puerto 3000)
```powershell
cd c:\Users\juanc\Documents\indicadores\backend
npm run start:dev
```

**Frontend** (puerto 3001)
```powershell
cd c:\Users\juanc\Documents\indicadores\frontend-next
npm run dev
```

---

## Matar un puerto ocupado

```powershell
# Ver qué proceso usa el puerto (ej: 3000)
netstat -ano | findstr :3000

# Matar el proceso por su PID (reemplaza 12345 con el PID real)
taskkill /PID 12345 /F
```

Atajo de una sola línea (mata directamente el proceso en el puerto 3000):
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

---

## Migraciones de base de datos

Las migraciones están en `backend/supabase/migrations/`. Supabase **no** ejecuta DDL
por API, así que se aplican pegando el archivo en:
**Supabase Dashboard → SQL Editor → New query → Run**.

Después de aplicar una migración, verifica que quedó bien:
```powershell
cd c:\Users\juanc\Documents\indicadores\backend
node supabase\verificar-002.js   # columnas de seguimiento + historial
node supabase\verificar-004.js   # bitácora de avances
```
Y reinicia el backend para refrescar el schema cache de PostgREST.

> Nota: los INSERT sí pasan por la API (así se sembró `entregable_tipos`),
> pero el DDL —crear tablas o columnas— solo se puede aplicar desde el SQL Editor.

---

## Otros comandos útiles

**Ver qué hay corriendo en los puertos del proyecto:**
```powershell
netstat -ano | findstr ":3000 :3001"
```

**Reinstalar dependencias (si algo falla al iniciar):**
```powershell
# Backend
cd c:\Users\juanc\Documents\indicadores\backend ; npm install

# Frontend
cd c:\Users\juanc\Documents\indicadores\frontend-next ; npm install
```

**Build de producción del frontend:**
```powershell
cd c:\Users\juanc\Documents\indicadores\frontend-next
npm run build
npm run start
```

**Variables de entorno:**
- Backend: `backend\.env`
- Frontend: `frontend-next\.env.local`
