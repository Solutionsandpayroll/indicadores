'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Building2, Package, BarChart3, TrendingUp, Activity, Zap } from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'
import { api } from '@/lib/api'
import { easeOut } from '@/lib/easing'
import { useAuth } from '@/context/AuthContext'

interface Overview { clientes: number; entregables: number; indicadores: number }

// Datos demo para sparklines hasta que la API tenga series temporales
const sparkClientes = [4,7,5,9,8,12,10,14,11,16,13,18]
const sparkEntregables = [10,14,12,18,16,22,19,25,21,28,24,31]
const sparkIndicadores = [2,3,2,4,3,5,4,6,5,7,6,8]

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }
const cardAnim = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOut } },
}

function AnimatedNumber({ value, loading }: { value: number; loading: boolean }) {
  return loading ? (
    <div className="h-10 w-20 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-border)' }} />
  ) : (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="text-4xl font-bold tracking-tight"
      style={{ letterSpacing: '-0.06em' }}
    >
      {value}
    </motion.span>
  )
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const formatted = data.map((v, i) => ({ v, i }))
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={formatted} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#sg-${color.replace('#','')})`}
          dot={false}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="text-xs px-2 py-1 rounded-lg shadow-lg" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                {payload[0].value}
              </div>
            ) : null
          }
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function KpiCard({
  label, value, subtext, icon: Icon, spark, color, accent, delay, loading,
}: {
  label: string; value: number; subtext: string; icon: React.ElementType
  spark: number[]; color: string; accent?: boolean; delay: number; loading: boolean
}) {
  return (
    <motion.div
      variants={cardAnim}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px oklch(0% 0 0 / 6%)',
      }}
      whileHover={{ y: -2, boxShadow: '0 8px 32px oklch(0% 0 0 / 10%)' }}
      transition={{ duration: 0.2, ease: easeOut }}
    >
      {/* Top */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: accent ? 'var(--color-accent-muted)' : 'var(--color-primary-muted)', color: accent ? 'var(--color-accent)' : 'var(--color-primary)' }}
          >
            <Icon size={18} />
          </div>
          <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--color-success-muted)', color: 'var(--color-success)' }}>
            <TrendingUp size={10} />
            <span>+12%</span>
          </div>
        </div>

        <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-ink-muted)' }}>{label}</p>
        <AnimatedNumber value={value} loading={loading} />
        <p className="text-xs mt-1" style={{ color: 'var(--color-ink-subtle)' }}>{subtext}</p>
      </div>

      {/* Sparkline al fondo */}
      <div className="mt-auto">
        <Sparkline data={spark} color={color} />
      </div>
    </motion.div>
  )
}

function ActivityRing({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / Math.max(max, 1)) * 100)
  const data = [{ value: pct, fill: color }]
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <RadialBarChart
          width={80} height={80}
          innerRadius={28} outerRadius={38}
          data={data}
          startAngle={90} endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'var(--color-border)' }} />
        </RadialBarChart>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>{pct}%</span>
        </div>
      </div>
      <span className="text-xs font-medium text-center" style={{ color: 'var(--color-ink-muted)' }}>{label}</span>
    </div>
  )
}

export default function HomePage() {
  const { usuario } = useAuth()
  const { data, isLoading } = useQuery<Overview>({
    queryKey: ['stats-overview'],
    queryFn: async () => { const { data } = await api.get<Overview>('/stats/overview'); return data },
    staleTime: 60_000,
  })

  const [greeting, setGreeting] = useState('Buenos días')
  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches')
  }, [])
  const firstName = usuario?.nombre?.split(' ')[0] ?? 'Usuario'

  const clientes   = data?.clientes   ?? 0
  const entregables = data?.entregables ?? 0
  const indicadores = data?.indicadores ?? 0

  return (
    <div className="max-w-6xl space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Activity size={14} style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-accent)', letterSpacing: '0.1em' }}>
            Panel de control
          </span>
        </div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.05em' }}>
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-muted)', maxWidth: 'unset' }}>
          Aquí está el resumen operacional al día de hoy.
        </p>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-3 gap-5"
      >
        <KpiCard label="Clientes activos" value={clientes} subtext="registrados en el sistema"
          icon={Building2} spark={sparkClientes} color="oklch(27% 0.09 252)" delay={0} loading={isLoading} />
        <KpiCard label="Entregables" value={entregables} subtext="registrados este ciclo"
          icon={Package} spark={sparkEntregables} color="oklch(48% 0.13 240)" delay={0.08} loading={isLoading} />
        <KpiCard label="Indicadores" value={indicadores} subtext="activos con seguimiento"
          icon={BarChart3} spark={sparkIndicadores} color="oklch(52% 0.22 15)" accent delay={0.16} loading={isLoading} />
      </motion.div>

      {/* Panel de actividad */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.28, ease: easeOut }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-5"
      >
        {/* Distribución visual */}
        <div
          className="lg:col-span-1 rounded-2xl p-6"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Zap size={14} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>Distribución</h2>
          </div>
          <div className="flex justify-around items-end">
            <ActivityRing label="Clientes" value={clientes} max={Math.max(clientes, entregables, indicadores)} color="oklch(27% 0.09 252)" />
            <ActivityRing label="Entregables" value={entregables} max={Math.max(clientes, entregables, indicadores)} color="oklch(48% 0.13 240)" />
            <ActivityRing label="Indicadores" value={indicadores} max={Math.max(clientes, entregables, indicadores)} color="oklch(52% 0.22 15)" />
          </div>
        </div>

        {/* Bienvenida / guía rápida */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 flex flex-col justify-between"
          style={{
            background: 'linear-gradient(135deg, oklch(20% 0.08 252) 0%, oklch(15% 0.06 252) 100%)',
            border: '1px solid oklch(100% 0 0 / 6%)',
          }}
        >
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'oklch(100% 0 0 / 40%)', letterSpacing: '0.1em' }}>
              Acceso rápido
            </p>
            <h3 className="text-lg font-bold text-white mb-1" style={{ letterSpacing: '-0.04em' }}>
              Gestiona tus indicadores operacionales
            </h3>
            <p className="text-sm" style={{ color: 'oklch(100% 0 0 / 50%)', maxWidth: 'unset' }}>
              Navega a cualquier módulo desde el menú lateral para registrar clientes, entregables, RCAs e indicadores de desempeño.
            </p>
          </div>
          <div className="flex gap-3 mt-5 flex-wrap">
            {[
              { label: 'Ver clientes', href: '/dashboard/clientes', color: 'var(--color-primary-mid)' },
              { label: 'Entregables', href: '/dashboard/entregables', color: 'var(--color-blue-mid)' },
              { label: 'RCA', href: '/dashboard/rca', color: 'var(--color-accent)' },
            ].map(({ label, href, color }) => (
              <motion.a
                key={href}
                href={href}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: color, boxShadow: `0 2px 8px ${color}40` }}
                transition={{ duration: 0.15, ease: easeOut }}
              >
                {label}
              </motion.a>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
