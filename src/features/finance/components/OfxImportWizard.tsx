import { useState, useRef, useCallback } from 'react'
import {
  Upload, CheckCircle, AlertCircle, Loader2, X, Brain,
  TrendingUp, TrendingDown, ChevronRight, Ban,
} from 'lucide-react'
import { parseOfx } from '../../../lib/ofxParser'
import type { OfxTransaction } from '../../../lib/ofxParser'
import {
  savePendingOfxEntries,
  getPendingOfxEntries,
  classifyOfxEntry,
  ignoreOfxEntry,
  getClassificationRules,
  applyClassificationRules,
} from '../services/ofxApi'
import type { OfxPendingEntry, OfxClassificationRule } from '../services/ofxApi'
import type { ChartAccount } from '../types/finance.types'
import type { ChartAccountV2 } from '../services/corporateChartApi'

interface Props {
  companyId: string
  chartAccounts: ChartAccount[]
  chartAccountsV2: ChartAccountV2[]
  onImported?: () => void
}

interface ReviewRow extends OfxTransaction {
  autoChartAccountId?: string
  autoChartAccountV2Id?: string
  autoEntryType?: 'receivable' | 'payable'
}

type WizardStep = 'upload' | 'review' | 'pending'

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function OfxImportWizard({ companyId, chartAccounts, chartAccountsV2, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<WizardStep>('upload')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Review step
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [rules, setRules] = useState<OfxClassificationRule[]>([])
  const [importResult, setImportResult] = useState<{ inserted: number; duplicates: number } | null>(null)

  // Pending step
  const [pending, setPending] = useState<OfxPendingEntry[]>([])
  const [classifyingId, setClassifyingId] = useState<string | null>(null)
  const [pendingForms, setPendingForms] = useState<
    Record<string, { chartAccountId: string; entryType: 'receivable' | 'payable'; saveRule: boolean }>
  >({})

  const useV2 = chartAccountsV2.length > 0

  const loadPending = useCallback(async () => {
    const items = await getPendingOfxEntries(companyId)
    setPending(items)
    setPendingForms(prev => {
      const next = { ...prev }
      for (const item of items) {
        if (!next[item.id]) {
          next[item.id] = {
            chartAccountId: '',
            entryType: item.entry_type ?? (item.ofx_type === 'CREDIT' ? 'receivable' : 'payable'),
            saveRule: true,
          }
        }
      }
      return next
    })
  }, [companyId])

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.ofx') && !file.name.toLowerCase().endsWith('.qfx')) {
      setError('Selecione um arquivo .OFX ou .QFX exportado pelo seu banco.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const text = await file.text()
      const statement = parseOfx(text)

      if (statement.transactions.length === 0) {
        setError('Nenhuma transação encontrada no arquivo. Verifique se o arquivo OFX está correto.')
        setLoading(false)
        return
      }

      // Carrega regras de auto-classificação
      const savedRules = await getClassificationRules(companyId)
      setRules(savedRules)

      // Aplica regras nas transações
      const enriched = applyClassificationRules(statement.transactions, savedRules) as ReviewRow[]
      setRows(enriched)
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao ler arquivo OFX.')
    }

    setLoading(false)
  }

  const handleImportAll = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await savePendingOfxEntries(companyId, rows)
      setImportResult(result)
      await loadPending()
      setStep('pending')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao importar transações.')
    }

    setLoading(false)
  }

  const handleClassify = async (pendingId: string) => {
    const form = pendingForms[pendingId]
    if (!form?.chartAccountId) {
      setError('Selecione uma conta contábil para classificar.')
      return
    }

    setClassifyingId(pendingId)
    setError(null)

    try {
      await classifyOfxEntry(pendingId, {
        chartAccountId:   form.chartAccountId,
        entryType:        form.entryType,
        companyId,
        saveRule:         form.saveRule,
      })
      setPending(prev => prev.filter(p => p.id !== pendingId))
      onImported?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao classificar lançamento.')
    }

    setClassifyingId(null)
  }

  const handleIgnore = async (pendingId: string) => {
    await ignoreOfxEntry(pendingId)
    setPending(prev => prev.filter(p => p.id !== pendingId))
  }

  const handleShowPending = async () => {
    setLoading(true)
    await loadPending()
    setLoading(false)
    setStep('pending')
  }

  const reset = () => {
    setStep('upload')
    setRows([])
    setError(null)
    setImportResult(null)
  }

  const autoCount = rows.filter(r => r.autoChartAccountId).length
  const credits   = rows.filter(r => r.type === 'CREDIT')
  const debits    = rows.filter(r => r.type === 'DEBIT')

  // ── Upload step ───────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) handleFile(f)
          }}
          className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-10 h-10 text-blue-500 mx-auto mb-3 animate-spin" />
          ) : (
            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          )}
          <p className="text-gray-600 font-medium text-sm">
            {loading ? 'Lendo arquivo OFX...' : 'Arraste ou clique para enviar o extrato'}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Formato .OFX ou .QFX exportado pelo banco
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ofx,.qfx"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </div>

        <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">Como exportar o extrato OFX do seu banco:</p>
          <p>• <strong>Itaú:</strong> Internet Banking → Extrato → Exportar → OFX</p>
          <p>• <strong>Bradesco:</strong> Extrato → Salvar como → Formato OFX</p>
          <p>• <strong>Santander:</strong> Extrato → Exportar → Money/OFX</p>
          <p>• <strong>BB:</strong> Extrato → Salvar → OFX</p>
          <p>• <strong>Nubank:</strong> Perfil → Exportar extrato → OFX</p>
        </div>

        {pending.length === 0 && (
          <button
            onClick={handleShowPending}
            className="w-full text-center text-sm text-blue-600 hover:underline py-2"
          >
            Ver lançamentos pendentes de classificação
          </button>
        )}
        {pending.length > 0 && (
          <button
            onClick={() => setStep('pending')}
            className="w-full flex items-center justify-center gap-2 border border-amber-200 text-amber-700 bg-amber-50 text-sm font-medium py-2.5 rounded-xl hover:bg-amber-100 transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            {pending.length} lançamento(s) aguardando classificação
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  // ── Review step ───────────────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <div className="space-y-4">
        {/* Resumo do extrato */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-gray-800">{rows.length}</p>
            <p className="text-xs text-gray-500">Transações</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-green-600">
              {fmt(credits.reduce((s, t) => s + t.amount, 0))}
            </p>
            <p className="text-xs text-green-600 flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" /> Entradas ({credits.length})
            </p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-red-600">
              {fmt(debits.reduce((s, t) => s + t.amount, 0))}
            </p>
            <p className="text-xs text-red-600 flex items-center justify-center gap-1">
              <TrendingDown className="w-3 h-3" /> Saídas ({debits.length})
            </p>
          </div>
        </div>

        {autoCount > 0 && (
          <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5 text-xs text-purple-700">
            <Brain className="w-4 h-4 shrink-0" />
            <span>
              <strong>{autoCount}</strong> transação(ões) reconhecidas automaticamente pelo histórico de classificações.
              Serão importadas e já ficam prontas para confirmar.
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Tabela de preview */}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2.5 text-left">Data</th>
                <th className="px-3 py-2.5 text-left">Descrição</th>
                <th className="px-3 py-2.5 text-right">Valor</th>
                <th className="px-3 py-2.5 text-center">Tipo</th>
                <th className="px-3 py-2.5 text-left">Auto-conta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(row => (
                <tr key={row.fitId} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.date}</td>
                  <td className="px-3 py-2.5 text-gray-800 max-w-[200px]">
                    <div className="truncate font-medium">{row.name}</div>
                    {row.memo && row.memo !== row.name && (
                      <div className="truncate text-gray-400">{row.memo}</div>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${
                    row.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {row.type === 'CREDIT' ? '+' : '-'} {fmt(row.amount)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      row.type === 'CREDIT'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {row.type === 'CREDIT' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {row.autoChartAccountId ? (
                      <span className="flex items-center gap-1 text-purple-600">
                        <Brain className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">
                          {useV2
                            ? chartAccountsV2.find(a => a.id === row.autoChartAccountId)?.account_name
                            : chartAccounts.find(a => a.id === row.autoChartAccountId)?.name
                          }
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-300 italic">a classificar</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" /> Cancelar
          </button>
          <button
            onClick={handleImportAll}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
              : <><CheckCircle className="w-4 h-4" /> Importar {rows.length} transações</>
            }
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Todas as transações serão salvas como pendentes. A classificação contábil pode ser feita agora ou depois.
        </p>
      </div>
    )
  }

  // ── Pending classification step ───────────────────────────────────────────
  return (
    <div className="space-y-4">
      {importResult && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-green-700">{importResult.inserted} transação(ões) importadas.</span>
            {importResult.duplicates > 0 && (
              <span className="text-gray-500 ml-2">{importResult.duplicates} já existiam (ignoradas).</span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 text-sm">
          Classificar lançamentos
          {pending.length > 0 && (
            <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {pending.length} pendentes
            </span>
          )}
        </h3>
        <button onClick={reset} className="text-xs text-blue-600 hover:underline">
          Importar outro extrato
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {pending.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
          <p className="text-sm font-medium text-gray-600">Todos os lançamentos foram classificados!</p>
          <button onClick={reset} className="mt-4 text-sm text-blue-600 hover:underline">
            Importar novo extrato
          </button>
        </div>
      )}

      {pending.map(item => {
        const form = pendingForms[item.id] ?? {
          chartAccountId: '',
          entryType: item.entry_type ?? 'payable',
          saveRule: true,
        }

        const matchedRule = rules.find(
          r => r.payee_pattern === item.name?.toUpperCase()?.trim()
        )

        return (
          <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            {/* Cabeçalho da transação */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                {item.memo && item.memo !== item.name && (
                  <p className="text-xs text-gray-400 truncate">{item.memo}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-400">{item.transaction_date}</span>
                  <span className={`text-sm font-bold ${
                    item.ofx_type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.ofx_type === 'CREDIT' ? '+' : '-'} {fmt(item.amount)}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    item.ofx_type === 'CREDIT'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {item.ofx_type === 'CREDIT' ? 'Entrada' : 'Saída'}
                  </span>
                </div>
              </div>
            </div>

            {matchedRule && !form.chartAccountId && (
              <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 rounded-lg px-3 py-2">
                <Brain className="w-3.5 h-3.5 shrink-0" />
                <span>Reconhecido: última vez classificado em{' '}
                  <strong>
                    {useV2
                      ? chartAccountsV2.find(a => a.id === matchedRule.chart_account_v2_id)?.account_name
                      : chartAccounts.find(a => a.id === matchedRule.chart_account_id)?.name
                    }
                  </strong>
                </span>
                <button
                  onClick={() => setPendingForms(prev => ({
                    ...prev,
                    [item.id]: {
                      ...form,
                      chartAccountId: (useV2
                        ? matchedRule.chart_account_v2_id
                        : matchedRule.chart_account_id) ?? '',
                      entryType: matchedRule.entry_type,
                    },
                  }))}
                  className="ml-auto text-purple-600 font-semibold hover:underline whitespace-nowrap"
                >
                  Usar →
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo *</label>
                <select
                  value={form.entryType}
                  onChange={e => setPendingForms(prev => ({
                    ...prev,
                    [item.id]: { ...form, entryType: e.target.value as 'receivable' | 'payable' },
                  }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="receivable">A Receber (Receita)</option>
                  <option value="payable">A Pagar (Despesa)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Conta contábil *</label>
                <select
                  value={form.chartAccountId}
                  onChange={e => setPendingForms(prev => ({
                    ...prev,
                    [item.id]: { ...form, chartAccountId: e.target.value },
                  }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione a conta...</option>
                  {useV2
                    ? chartAccountsV2.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.account_code} — {a.account_name}
                        </option>
                      ))
                    : chartAccounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))
                  }
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.saveRule}
                onChange={e => setPendingForms(prev => ({
                  ...prev,
                  [item.id]: { ...form, saveRule: e.target.checked },
                }))}
                className="rounded"
              />
              <span className="text-xs text-gray-500">
                Memorizar: próximas transações de <strong>{item.name}</strong> serão classificadas automaticamente
              </span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => handleIgnore(item.id)}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-400 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" /> Ignorar
              </button>
              <button
                onClick={() => handleClassify(item.id)}
                disabled={!form.chartAccountId || classifyingId === item.id}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
              >
                {classifyingId === item.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <CheckCircle className="w-3.5 h-3.5" />
                }
                Classificar e lançar
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
