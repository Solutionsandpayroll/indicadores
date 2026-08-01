'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Home',
  '/dashboard/clientes': 'Clientes',
  '/dashboard/grupos': 'Grupos',
  '/dashboard/entregables': 'Entregables',
  '/dashboard/indicadores': 'Indicadores',
  '/dashboard/rca': 'RCA',
  '/dashboard/otras-variables': 'Otras Variables',
  '/dashboard/usuarios': 'Usuarios',
  '/dashboard/estatus': 'Estatus',
  '/dashboard/tipo-rca': 'Tipo RCA',
}

export default function Topbar() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? 'Dashboard'

  return (
    <header
      className="h-14 shrink-0 flex items-center px-6 lg:px-8"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <h1
        className="text-[15px] font-semibold tracking-tight"
        style={{ color: 'var(--color-ink)' }}
      >
        {title}
      </h1>
    </header>
  )
}
