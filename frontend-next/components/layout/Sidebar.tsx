'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, Building2, Package,
  BarChart2, AlertTriangle, SlidersHorizontal,
  UserCog, LogOut, CheckCircle, FileText, ChevronRight, Tags,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/cn'

const NAV_ITEMS = [
  { to: '/dashboard',                 label: 'Home',            icon: LayoutDashboard, exact: true },
  { to: '/dashboard/clientes',        label: 'Clientes',        icon: Building2 },
  { to: '/dashboard/grupos',          label: 'Grupos',          icon: Users },
  { to: '/dashboard/entregables',     label: 'Entregables',     icon: Package },
  { to: '/dashboard/indicadores',     label: 'Indicadores',     icon: BarChart2 },
  { to: '/dashboard/rca',             label: 'RCA',             icon: AlertTriangle },
  { to: '/dashboard/otras-variables', label: 'Otras Variables', icon: SlidersHorizontal },
]

const ADMIN_ITEMS = [
  { to: '/dashboard/usuarios',          label: 'Usuarios',          icon: UserCog },
  { to: '/dashboard/estatus',           label: 'Estatus',           icon: CheckCircle },
  { to: '/dashboard/entregable-tipos',  label: 'Tipos entregable',  icon: Tags },
  { to: '/dashboard/tipo-rca',          label: 'Tipo RCA',          icon: FileText },
]

export default function Sidebar() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  function handleLogout() {
    logout()
    router.replace('/login')
  }

  return (
    <aside
      className="flex flex-col w-64 shrink-0 h-screen relative overflow-hidden"
      style={{
        background: `
          linear-gradient(160deg,
            oklch(20% 0.08 252) 0%,
            oklch(15% 0.06 252) 60%,
            oklch(12% 0.05 252) 100%
          )
        `,
        borderRight: '1px solid oklch(100% 0 0 / 5%)',
      }}
    >
      {/* Orbe decorativo de fondo — sutil, no el centro */}
      <div
        className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, oklch(48% 0.13 240 / 60%), transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 -left-10 w-48 h-48 rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, oklch(52% 0.22 15 / 50%), transparent 70%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 relative" style={{ borderBottom: '1px solid oklch(100% 0 0 / 6%)' }}>
        <Image
          src="/logosyp.png"
          alt="Solutions & Payroll"
          width={160}
          height={52}
          className="object-contain"
          style={{ filter: 'brightness(0) invert(1)' }}
          priority
        />
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-0.5 relative">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === to : pathname.startsWith(to)
          return <NavItem key={to} to={to} label={label} icon={Icon} isActive={isActive} />
        })}

        {usuario?.es_admin && (
          <>
            <div className="mx-2 my-3 flex items-center gap-2">
              <div className="flex-1 h-px" style={{ backgroundColor: 'oklch(100% 0 0 / 8%)' }} />
              <span className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: 'oklch(100% 0 0 / 30%)' }}>Admin</span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'oklch(100% 0 0 / 8%)' }} />
            </div>
            {ADMIN_ITEMS.map(({ to, label, icon: Icon }) => {
              const isActive = pathname.startsWith(to)
              return <NavItem key={to} to={to} label={label} icon={Icon} isActive={isActive} />
            })}
          </>
        )}
      </nav>

      {/* Usuario */}
      <div className="px-3 pb-4 pt-3 relative" style={{ borderTop: '1px solid oklch(100% 0 0 / 6%)' }}>
        <motion.div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ backgroundColor: 'oklch(100% 0 0 / 4%)' }}
          whileHover={{ backgroundColor: 'oklch(100% 0 0 / 8%)' }}
          transition={{ duration: 0.15 }}
        >
          {/* Avatar con inicial */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent) 0%, oklch(45% 0.22 15) 100%)',
              boxShadow: '0 2px 8px oklch(52% 0.22 15 / 40%)',
            }}
          >
            {usuario?.nombre?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-white">{usuario?.nombre}</p>
            <p className="text-[10px] truncate" style={{ color: 'oklch(100% 0 0 / 40%)' }}>{usuario?.usuario}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-1.5 rounded-lg cursor-pointer transition-colors duration-150"
            style={{ color: 'oklch(100% 0 0 / 35%)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'oklch(100% 0 0 / 80%)'; e.currentTarget.style.backgroundColor = 'oklch(100% 0 0 / 8%)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'oklch(100% 0 0 / 35%)'; e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <LogOut size={13} />
          </button>
        </motion.div>
      </div>
    </aside>
  )
}

function NavItem({ to, label, icon: Icon, isActive }: { to: string; label: string; icon: React.ElementType; isActive: boolean }) {
  return (
    <Link href={to} className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 outline-none"
      style={{ color: isActive ? 'white' : 'oklch(100% 0 0 / 50%)' }}
    >
      {/* Fondo activo */}
      {isActive && (
        <motion.div
          layoutId="nav-active-bg"
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent) 0%, oklch(48% 0.20 15) 100%)',
            boxShadow: '0 4px 16px oklch(52% 0.22 15 / 35%)',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      {/* Hover fondo (solo cuando no activo) */}
      {!isActive && (
        <motion.div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100"
          style={{ backgroundColor: 'oklch(100% 0 0 / 6%)' }}
          transition={{ duration: 0.15 }}
        />
      )}

      <motion.div
        className="relative shrink-0"
        animate={{ scale: isActive ? 1.05 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <Icon
          size={16}
          className={cn('transition-opacity duration-150', isActive ? 'opacity-100' : 'opacity-50 group-hover:opacity-75')}
        />
      </motion.div>

      <span className="relative flex-1 truncate" style={{ letterSpacing: '-0.02em' }}>{label}</span>

      {isActive && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative"
        >
          <ChevronRight size={12} className="opacity-60" />
        </motion.div>
      )}
    </Link>
  )
}
