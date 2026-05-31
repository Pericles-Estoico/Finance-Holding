import { useState, useEffect, useCallback } from 'react'
import {
  getCorporateChart,
  createCorporateAccount,
  updateCorporateAccount,
  softDeleteCorporateAccount,
  seedCorporateChart,
} from '../services/corporateChartApi'
import type { ChartAccountV2, ChartAccountV2Insert } from '../services/corporateChartApi'

interface UseCorporateChartReturn {
  accounts: ChartAccountV2[]
  loading: boolean
  error: string | null
  seeding: boolean
  reload: () => Promise<void>
  create: (payload: ChartAccountV2Insert) => Promise<void>
  update: (id: string, payload: Parameters<typeof updateCorporateAccount>[1]) => Promise<void>
  softDelete: (id: string) => Promise<void>
  seed: () => Promise<{ seeded: boolean; message: string }>
}

export function useCorporateChart(companyId: string | null): UseCorporateChartReturn {
  const [accounts, setAccounts] = useState<ChartAccountV2[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const reload = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getCorporateChart(companyId)
      setAccounts(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar plano de contas')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(async (payload: ChartAccountV2Insert) => {
    await createCorporateAccount(payload)
    await reload()
  }, [reload])

  const update = useCallback(async (
    id: string,
    payload: Parameters<typeof updateCorporateAccount>[1]
  ) => {
    await updateCorporateAccount(id, payload)
    await reload()
  }, [reload])

  const softDelete = useCallback(async (id: string) => {
    await softDeleteCorporateAccount(id)
    await reload()
  }, [reload])

  const seed = useCallback(async () => {
    if (!companyId) return { seeded: false, message: 'Empresa não selecionada' }
    setSeeding(true)
    try {
      const result = await seedCorporateChart(companyId)
      if (result.seeded) await reload()
      return result
    } finally {
      setSeeding(false)
    }
  }, [companyId, reload])

  return { accounts, loading, error, seeding, reload, create, update, softDelete, seed }
}
