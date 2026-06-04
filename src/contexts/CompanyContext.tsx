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

const STORAGE_KEY = 'finance_active_company_id'

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | 'consolidated'>(
    () => localStorage.getItem(STORAGE_KEY) ?? 'consolidated'
  )
  const [loading, setLoading] = useState(false)

  const setActiveCompanyId = (id: string | 'consolidated') => {
    setActiveCompanyIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const fetchCompanies = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    const list = data ?? []
    setCompanies(list)
    setLoading(false)

    if (list.length === 0) return

    // Restaura seleção salva; se não existe mais, usa a primeira empresa
    const stored = localStorage.getItem(STORAGE_KEY)
    const stillValid = stored && stored !== 'consolidated' && list.some((c) => c.id === stored)
    if (!stillValid) {
      setActiveCompanyId(list[0].id)
    }
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
