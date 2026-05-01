import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Upload, FolderOpen, FileText, CheckCircle, AlertCircle, Loader2, X,
  ExternalLink, RefreshCw, FolderSync, Clock, ChevronDown, ChevronUp, Save,
} from 'lucide-react'
import { useCompany } from '../contexts/CompanyContext'
import { useSimulation } from '../contexts/SimulationContext'
import { useAuth } from '../contexts/AuthContext'
import { runOcr, fileToBase64 } from '../lib/api/ocr'
import { openDrivePicker, downloadDriveFileAsBase64, listFolderFiles, authorizeGoogleDrive } from '../lib/googleDrive'
import { getAccounts } from '../lib/api/accounts'
import { createTransaction } from '../lib/api/transactions'
import {
  checkProcessedFiles, processFile, getPendingClassifications,
  classifyPending, getDriveConfig, saveDriveConfig,
} from '../lib/api/driveImport'
import type { AccountCategory, SaleChannel, PendingClassification } from '../types'
import type { OcrParsed } from '../lib/api/ocr'

const CHANNELS: { value: SaleChannel; label: string }[] = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'varejo_fisico', label: 'Varejo Fisico' },
  { value: 'b2b', label: 'B2B' },
  { value: 'mercado_livre', label: 'Mercado Livre' },
  { value: 'outros', label: 'Outros' },
]

type Step = 'select' | 'processing' | 'validate' | 'done'
type Tab = 'manual' | 'drive'

interface ValidationForm {
  description: string
  date: string
  amount: string
  account_id: string
  channel: SaleChannel | ''
  type: 'receita' | 'despesa'
  company_id: string
  driveUrl: string
}

interface ScanProgress {
  total: number
  current: number
  autoCreated: number
  pending: number
  skipped: number
}

interface PendingForm {
  account_id: string
  type: 'receita' | 'despesa'
  save_rule: boolean
}

export default function ImportarPage() {
  const { companies, activeCompanyId } = useCompany()
  const { isSimulation } = useSimulation()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<Tab>('manual')

  // ── Manual import state ──────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('select')
  const [processing, setProcessing] = useState('')
  const [rawText, setRawText] = useState('')
  const [isMock, setIsMock] = useState(false)
  const [accounts, setAccounts] = useState<AccountCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ValidationForm>({
    description: '', date: '', amount: '', account_id: '',
    channel: '', type: 'despesa', company_id: '', driveUrl: '',
  })

  // ── Drive auto-import state ───────────────────────────────────────────────────
  const [folderUrl, setFolderUrl] = useState('')
  const [folderConfigSaved, setFolderConfigSaved] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [pendingItems, setPendingItems] = useState<PendingClassification[]>([])
  const [pendingForms, setPendingForms] = useState<Record<string, PendingForm>>({})
  const [classifyingId, setClassifyingId] = useState<string | null>(null)
  const [allAccounts, setAllAccounts] = useState<AccountCategory[]>([])
  const [pendingExpanded, setPendingExpanded] = useState(true)

  const activeCompany = activeCompanyId !== 'consolidated'
    ? companies.find(c => c.id === activeCompanyId)
    : companies[0]

  const hasDriveConfig = !!import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID

  const loadAccountsForCompany = async (companyId: string) => {
    const data = await getAccounts(companyId)
    setAccounts(data)
    return data
  }

  // Load Drive config and pending items on mount / company change
  useEffect(() => {
    if (!activeCompany) return
    getDriveConfig(activeCompany.id).then(cfg => {
      if (cfg?.folder_url) { setFolderUrl(cfg.folder_url); setFolderConfigSaved(true) }
      else if (cfg?.folder_id) { setFolderUrl(`https://drive.google.com/drive/folders/${cfg.folder_id}`); setFolderConfigSaved(true) }
    }).catch(() => {})
    loadPending(activeCompany.id)
    getAccounts(activeCompany.id).then(setAllAccounts).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?.id])

  const loadPending = useCallback(async (companyId: string) => {
    try {
      const items = await getPendingClassifications(companyId)
      setPendingItems(items)
      // Pre-populate forms
      setPendingForms(prev => {
        const next = { ...prev }
        for (const item of items) {
          if (!next[item.id]) {
            next[item.id] = {
              account_id: '',
              type: item.extracted_data.type ?? 'despesa',
              save_rule: true,
            }
          }
        }
        return next
      })
    } catch {}
  }, [])

  // ── Manual import handlers ───────────────────────────────────────────────────
  const processOcr = async (base64: string, mimeType: string, driveUrl = '') => {
    if (companies.length === 0) {
      setError('Cadastre uma empresa em Configuracoes antes de importar comprovantes.')
      return
    }
    setStep('processing')
    setProcessing('Extraindo texto do comprovante...')
    setError(null)
    try {
      const result = await runOcr(base64, mimeType)
      setRawText(result.rawText)
      setIsMock(result.isMock ?? false)

      const companyId = activeCompany?.id ?? companies[0]?.id ?? ''
      const loaded = await loadAccountsForCompany(companyId)

      setProcessing('Classificando automaticamente...')
      const parsed: OcrParsed = result.parsed

      const suggested = parsed.suggestedAccountCode
        ? loaded.find(a => a.code === parsed.suggestedAccountCode)
        : undefined

      setForm({
        description: parsed.supplierName ?? '',
        date: parsed.date ?? new Date().toISOString().split('T')[0],
        amount: parsed.totalCents ? (parsed.totalCents / 100).toFixed(2) : '',
        account_id: suggested?.id ?? '',
        channel: '',
        type: 'despesa',
        company_id: companyId,
        driveUrl,
      })

      setStep('validate')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Erro ao processar comprovante: ${msg}`)
      setStep('select')
    }
    setProcessing('')
  }

  const handleLocalFile = async (file: File) => {
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) { setError('Formato nao suportado. Use JPG, PNG ou PDF.'); return }
    const { base64, mimeType } = await fileToBase64(file)
    await processOcr(base64, mimeType)
  }

  const handleDrivePicker = async () => {
    try {
      setError(null)
      const file = await openDrivePicker()
      if (!file) return
      setProcessing('Baixando arquivo do Drive...')
      setStep('processing')
      const { base64, mimeType } = await downloadDriveFileAsBase64(file.id)
      await processOcr(base64, mimeType, file.url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao acessar Google Drive')
      setStep('select')
    }
  }

  const handleConfirm = async () => {
    setError(null)
    if (!form.description || !form.date || !form.amount || !form.account_id || !form.company_id) {
      setError('Preencha todos os campos obrigatorios.')
      return
    }
    try {
      await createTransaction({
        company_id: form.company_id, account_id: form.account_id, type: form.type,
        amount: form.amount, description: form.description, date: form.date,
        channel: form.channel || undefined, is_simulation: isSimulation,
      })
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar transacao')
    }
  }

  const reset = () => {
    setStep('select'); setRawText(''); setError(null); setIsMock(false)
    setForm({ description: '', date: '', amount: '', account_id: '', channel: '', type: 'despesa', company_id: '', driveUrl: '' })
  }

  // ── Drive auto-import handlers ────────────────────────────────────────────────
  const handleSaveFolderConfig = async () => {
    if (!activeCompany) { setDriveError('Selecione uma empresa primeiro.'); return }
    setDriveError(null)
    try {
      await saveDriveConfig(activeCompany.id, folderUrl)
      setFolderConfigSaved(true)
    } catch (e: unknown) {
      setDriveError(e instanceof Error ? e.message : 'Erro ao salvar configuracao')
    }
  }

  const handleScanFolder = async () => {
    if (!activeCompany) { setDriveError('Selecione uma empresa primeiro.'); return }
    if (!folderUrl) { setDriveError('Configure a URL da pasta do Drive primeiro.'); return }
    if (!hasDriveConfig) { setDriveError('VITE_GOOGLE_DRIVE_CLIENT_ID nao configurado.'); return }

    const match = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    const folderId = match?.[1]
    if (!folderId) { setDriveError('URL invalida. Cole o link completo da pasta.'); return }

    setScanning(true)
    setDriveError(null)
    setScanProgress(null)

    try {
      await authorizeGoogleDrive()
      const files = await listFolderFiles(folderId)
      if (files.length === 0) {
        setScanProgress({ total: 0, current: 0, autoCreated: 0, pending: 0, skipped: 0 })
        setScanning(false)
        return
      }

      const fileIds = files.map(f => f.id)
      const processedIds = await checkProcessedFiles(activeCompany.id, fileIds)
      const processedSet = new Set(processedIds)

      const newFiles = files.filter(f => !processedSet.has(f.id))
      const progress: ScanProgress = { total: newFiles.length, current: 0, autoCreated: 0, pending: 0, skipped: processedSet.size }
      setScanProgress({ ...progress })

      if (newFiles.length === 0) {
        setScanProgress(progress)
        setScanning(false)
        return
      }

      for (const file of newFiles) {
        try {
          const { base64, mimeType } = await downloadDriveFileAsBase64(file.id)
          const result = await processFile({
            company_id: activeCompany.id,
            file_id: file.id,
            file_name: file.name,
            file_url: file.webViewLink,
            base64,
            mime_type: mimeType,
          })
          progress.current++
          if (result.status === 'auto_created') progress.autoCreated++
          else if (result.status === 'pending') progress.pending++
          else if (result.status === 'already_processed') progress.skipped++
        } catch {
          progress.current++
        }
        setScanProgress({ ...progress })
      }

      await loadPending(activeCompany.id)
    } catch (e: unknown) {
      setDriveError(e instanceof Error ? e.message : 'Erro ao escanear pasta')
    }
    setScanning(false)
  }

  const handleClassify = async (pendingId: string) => {
    if (!activeCompany) return
    const pf = pendingForms[pendingId]
    if (!pf?.account_id) { setDriveError(`Selecione uma conta para o item.`); return }
    setClassifyingId(pendingId)
    setDriveError(null)
    try {
      await classifyPending({
        pending_id: pendingId,
        company_id: activeCompany.id,
        account_id: pf.account_id,
        type: pf.type,
        save_rule: pf.save_rule,
      })
      setPendingItems(prev => prev.filter(i => i.id !== pendingId))
    } catch (e: unknown) {
      setDriveError(e instanceof Error ? e.message : 'Erro ao classificar')
    }
    setClassifyingId(null)
  }

  if (!user) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Importar Comprovante</h2>
        <p className="text-gray-400 text-sm mt-0.5">OCR automatico com classificacao inteligente</p>
      </div>

      {/* Tabs */}
      <div className="flex border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setTab('manual')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'manual' ? 'bg-blue-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          Upload Manual
        </button>
        <button
          onClick={() => setTab('drive')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'drive' ? 'bg-blue-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <FolderSync className="w-4 h-4" />
          Drive Automatico
          {pendingItems.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === 'drive' ? 'bg-amber-400 text-amber-900' : 'bg-amber-100 text-amber-700'}`}>
              {pendingItems.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Manual Import Tab ─────────────────────────────────────────────────── */}
      {tab === 'manual' && (
        <>
          {/* Passos */}
          <div className="flex items-center gap-2">
            {(['select', 'processing', 'validate', 'done'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  step === s ? 'bg-blue-900 text-white' :
                  ['processing','validate','done'].indexOf(step) > ['processing','validate','done'].indexOf(s) || (step === 'done' && s !== 'done') ? 'bg-green-500 text-white' :
                  'bg-gray-100 text-gray-400'
                }`}>{i + 1}</div>
                {i < 3 && <div className="w-8 h-px bg-gray-200" />}
              </div>
            ))}
            <div className="ml-2 text-xs text-gray-400">
              {step === 'select' && 'Selecionar arquivo'}
              {step === 'processing' && 'Processando...'}
              {step === 'validate' && 'Validar dados'}
              {step === 'done' && 'Concluido!'}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLocalFile(f) }}
                className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              >
                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium text-sm">Arraste ou clique para enviar</p>
                <p className="text-gray-400 text-xs mt-1">JPG, PNG ou PDF · max. 10 MB</p>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleLocalFile(e.target.files[0]) }} />
              </div>

              <div className="text-center text-xs text-gray-300">ou</div>

              <button
                onClick={hasDriveConfig ? handleDrivePicker : undefined}
                disabled={!hasDriveConfig}
                className={`w-full flex items-center justify-center gap-3 border rounded-xl py-4 text-sm font-medium transition-colors ${
                  hasDriveConfig ? 'border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer' : 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50'
                }`}
              >
                <FolderOpen className="w-5 h-5 text-blue-500" />
                Selecionar do Google Drive
                {!hasDriveConfig && <span className="text-xs text-amber-500 ml-1">(VITE_GOOGLE_DRIVE_CLIENT_ID nao configurado)</span>}
              </button>
            </div>
          )}

          {step === 'processing' && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Loader2 className="w-10 h-10 text-blue-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-700 font-medium">{processing || 'Processando...'}</p>
              <p className="text-gray-400 text-xs mt-2">A IA esta lendo o comprovante</p>
            </div>
          )}

          {step === 'validate' && (
            <div className="space-y-4">
              {isMock && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-amber-700 text-xs">Sem chave Vision API — dados simulados. Configure <code>GOOGLE_VISION_API_KEY</code>.</p>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                <div className="px-5 py-4">
                  <h3 className="font-semibold text-gray-800 text-sm mb-1">Revisar dados extraidos</h3>
                  <p className="text-xs text-gray-400">Confirme ou corrija antes de salvar.</p>
                </div>

                <div className="px-5 py-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Tipo *</label>
                    <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as 'receita' | 'despesa' }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="despesa">Despesa</option>
                      <option value="receita">Receita</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Data *</label>
                    <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="px-5 py-4">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Descricao / Fornecedor *</label>
                  <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="px-5 py-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Valor (R$) *</label>
                    <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Canal de Venda</label>
                    <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value as SaleChannel | '' }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Nenhum</option>
                      {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="px-5 py-4">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Empresa *</label>
                  <select value={form.company_id} onChange={e => { setForm(p => ({ ...p, company_id: e.target.value, account_id: '' })); loadAccountsForCompany(e.target.value) }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="px-5 py-4">
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Conta do Plano *
                    {form.account_id && <span className="ml-2 text-blue-500 text-xs">sugerida automaticamente</span>}
                  </label>
                  <select value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!form.company_id}>
                    <option value="">Selecione a conta...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>

                {form.driveUrl && (
                  <div className="px-5 py-3">
                    <a href={form.driveUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 text-xs hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver comprovante original no Drive
                    </a>
                  </div>
                )}
              </div>

              {rawText && (
                <details className="bg-gray-50 rounded-xl border border-gray-100">
                  <summary className="px-4 py-3 text-xs text-gray-400 cursor-pointer select-none flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> Texto bruto extraido (OCR)
                  </summary>
                  <pre className="px-4 pb-4 text-xs text-gray-500 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">{rawText}</pre>
                </details>
              )}

              {error && <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

              <div className="flex gap-3">
                <button onClick={reset} className="flex items-center gap-2 border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button onClick={handleConfirm} className="flex-1 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                  Confirmar e Salvar Transacao
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Transacao salva!</h3>
              <p className="text-gray-400 text-sm mb-6">O comprovante foi processado e a transacao registrada com sucesso.</p>
              <button onClick={reset} className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
                Importar outro comprovante
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Drive Auto-Import Tab ─────────────────────────────────────────────── */}
      {tab === 'drive' && (
        <div className="space-y-5">
          {/* Folder config */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm">Pasta do Google Drive</h3>
            <p className="text-xs text-gray-400">Cole o link da pasta compartilhada com os comprovantes. O sistema ira escanear automaticamente e lancar as transacoes.</p>
            <div className="flex gap-2">
              <input
                value={folderUrl}
                onChange={e => { setFolderUrl(e.target.value); setFolderConfigSaved(false) }}
                placeholder="https://drive.google.com/drive/folders/..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSaveFolderConfig}
                disabled={!folderUrl || folderConfigSaved}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  folderConfigSaved ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-blue-900 text-white hover:bg-blue-800'
                }`}
              >
                {folderConfigSaved ? <><CheckCircle className="w-4 h-4" /> Salvo</> : <><Save className="w-4 h-4" /> Salvar</>}
              </button>
            </div>

            <button
              onClick={handleScanFolder}
              disabled={scanning || !folderUrl || !hasDriveConfig}
              className="w-full flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {scanning ? 'Escaneando...' : 'Escanear pasta agora'}
            </button>

            {!hasDriveConfig && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Configure <code>VITE_GOOGLE_DRIVE_CLIENT_ID</code> no .env para habilitar o Drive.
              </p>
            )}
          </div>

          {driveError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-red-600 text-sm">{driveError}</p>
            </div>
          )}

          {/* Scan progress */}
          {scanProgress && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm">Resultado do escaneamento</h3>
              {scanProgress.total === 0 ? (
                <p className="text-sm text-gray-500">Nenhum arquivo novo encontrado na pasta.</p>
              ) : (
                <>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-green-600">{scanProgress.autoCreated}</p>
                      <p className="text-xs text-green-600">Auto-lancados</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-amber-600">{scanProgress.pending}</p>
                      <p className="text-xs text-amber-600">Aguardando conta</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-gray-500">{scanProgress.skipped}</p>
                      <p className="text-xs text-gray-400">Ja processados</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Pending classifications */}
          {pendingItems.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-100 divide-y divide-gray-50">
              <button
                onClick={() => setPendingExpanded(p => !p)}
                className="w-full flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-gray-800 text-sm">
                    Aguardando classificacao
                    <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold">{pendingItems.length}</span>
                  </h3>
                </div>
                {pendingExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {pendingExpanded && pendingItems.map(item => {
                const pf = pendingForms[item.id] ?? { account_id: '', type: item.extracted_data.type ?? 'despesa', save_rule: true }
                const extracted = item.extracted_data
                return (
                  <div key={item.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.file_name ?? 'Comprovante'}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {extracted.payee && <span className="text-xs text-gray-500">{extracted.payee}</span>}
                          {extracted.amount_cents && (
                            <span className="text-xs font-semibold text-gray-700">
                              R$ {(extracted.amount_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                          {extracted.date && <span className="text-xs text-gray-400">{extracted.date}</span>}
                        </div>
                      </div>
                      {item.file_url && (
                        <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 shrink-0">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                        <select
                          value={pf.type}
                          onChange={e => setPendingForms(prev => ({ ...prev, [item.id]: { ...pf, type: e.target.value as 'receita' | 'despesa' } }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="despesa">Despesa</option>
                          <option value="receita">Receita</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Conta do plano *</label>
                        <select
                          value={pf.account_id}
                          onChange={e => setPendingForms(prev => ({ ...prev, [item.id]: { ...pf, account_id: e.target.value } }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione...</option>
                          {allAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pf.save_rule}
                        onChange={e => setPendingForms(prev => ({ ...prev, [item.id]: { ...pf, save_rule: e.target.checked } }))}
                        className="rounded"
                      />
                      <span className="text-xs text-gray-500">
                        Memorizar: proximos recibos de <strong>{extracted.payee ?? 'este favorecido'}</strong> irao direto para esta conta
                      </span>
                    </label>

                    <button
                      onClick={() => handleClassify(item.id)}
                      disabled={!pf.account_id || classifyingId === item.id}
                      className="w-full flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium py-2 rounded-lg transition-colors"
                    >
                      {classifyingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Confirmar e lancar transacao
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {!scanning && !scanProgress && pendingItems.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <FolderSync className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Configure a pasta e clique em Escanear para importar comprovantes automaticamente.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
