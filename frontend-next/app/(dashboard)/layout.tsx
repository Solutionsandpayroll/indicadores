'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/login')
    }
  }, [hydrated, isAuthenticated, router])

  if (!hydrated) {
    return (
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="flex-1 flex items-center justify-center" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {isAuthenticated ? children : (
            <div className="flex-1 flex items-center justify-center" />
          )}
        </main>
      </div>
    </div>
  )
}
