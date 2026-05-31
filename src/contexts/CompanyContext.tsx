import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Company } from '../types'
import { useAuth } from './AuthContext'

interface CompanyContextValue {
  companies: Company[]
  activeCompanyId: string | 'consolidated'
  setActiveCompanyId: (id: string | 'consolidated') => void
  activeCompany: Company | null
  loading: boolean
  refreshCompanies: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [activeCompanyId, setActiveCompanyId] = useState<string | 'consolidated'>('consolidated')
  const [loading, setLoading] = useState(false)

  const fetchCompanies = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    setCompanies(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void fetchCompanies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const activeCompany =
    activeCompanyId === 'consolidated'
      ? null
      : companies.find((c) => c.id === activeCompanyId) ?? null

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompanyId,
        setActiveCompanyId,
        activeCompany,
        loading,
        refreshCompanies: fetchCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany deve ser usado dentro de CompanyProvider')
  return ctx
}
