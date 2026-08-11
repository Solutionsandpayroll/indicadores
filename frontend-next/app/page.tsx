'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function RootPage() {
  const { isAuthenticated, hydrated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!hydrated) return
    router.replace(isAuthenticated ? '/dashboard' : '/login')
  }, [hydrated, isAuthenticated, router])

  return null
}
