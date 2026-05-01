import { useState, useRef } from 'react'
import { Upload, FolderOpen, FileText, CheckCircle, AlertCircle, Loader2, X, ExternalLink } from 'lucide-react'
import { useCompany } from '../contexts/CompanyContext'
import { useSimulation } from '../contexts/SimulationContext'
import { useAuth } from '../contexts/AuthContext'
import { runOcr, fileToBase64 } from '../lib/api/ocr'
import { openDrivePicker, downloadDriveFileAsBase64 } from '../lib/googleDrive'
import { getAccounts } from '../lib/api/accounts'
import { createTransaction } from '../lib/api/transactions'
import type { AccountCategory, SaleChannel } from '../types'
import type { OcrParsed } from '../lib/api/ocr'

const CHANNELS: { value: SaleChannel; label: string }[] = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'varejo_fisico', label: 'Varejo Físico' },
  { value: 'b2b', label: 'B2B' },
  { value: 'mercado_livre', label: 'Mercado Livre' },
  { value: 'outros', label: 'Outros' },
]

type Step = 'select' | 'processing' | 'validate' | 'done'

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

export default function ImportarPage() {
  const { companies, activeCompanyId } = useCompany()
  const { isSimulation } = useSimulation()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const activeCompany = activeCompanyId !== 'consolidated'
    ? companies.find(c => c.id === activeCompanyId)
    : companies[0]

  const hasDriveConfig = !!import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID

  const loadAccountsForCompany = async (companyId: string) => {
    const data = await getAccounts(companyId)
    setAccounts(data)
  }

  const processOcr = async (base64: string, mimeType: string, driveUrl = '') => {
    setStep('processing')
    setProcessing('Extraindo texto do comprovante...')
    setError(null)
    try {
      const result = await runOcr(base64, mimeType)
      setRawText(result.rawText)
      setIsMock(result.isMock ?? false)

      const companyId = activeCompany?.id ?? companies[0]?.id ?? ''
      await loadAccountsForCompany(companyId)

      setProcessing('Classificando automaticamente...')
      const parsed: OcrParsed = result.parsed

      setForm({
        description: parsed.supplierName ?? '',
        date: parsed.date ?? new Date().toISOString().split('T')[0],
        amount: parsed.totalCents ? (parsed.totalCents / 100).toFixed(2) : '',
        account_id: '',
        channel: '',
        type: 'despesa',
        company_id: companyId,
        driveUrl,
      })

      // Busca conta sugerida após carregar accounts
      const allAccounts = await getAccounts(companyId)
      setAccounts(allAccounts)
      if (parsed.suggestedAccountCode) {
        const suggested = allAccounts.find(a => a.code === parsed.suggestedAccountCode)
        if (suggested) setForm(p => ({ ...p, account_id: suggested.id }))
      }

      setStep('validate')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao processar comprovante')
      setStep('select')
    }
    setProcessing('')
  }

  const handleLocalFile = async (file: File) => {
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      setError('Formato não suportado. Use JPG, PNG ou PDF.')
      return
    }
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
      setError('Preencha todos os campos obrigatórios.')
      return
    }
    try {
      await createTransaction({
        company_id: form.company_id,
        account_id: form.account_id,
        type: form.type,
        amount: form.amount,
        description: form.description,
        date: form.date,
        channel: form.channel || undefined,
        is_simulation: isSimulation,
      })
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar transação')
    }
  }

  const reset = () => {
    setStep('select')
    setRawText('')
    setError(null)
    setIsMock(false)
    setForm({ description: '', date: '', amount: '', account_id: '', channel: '', type: 'despesa', company_id: '', driveUrl: '' })
  }

  if (!user) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Importar Comprovante</h2>
        <p className="text-gray-400 text-sm mt-0.5">Leitura automática via OCR + classificação inteligente</p>
      </div>

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
          {step === 'done' && 'Concluído!'}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Etapa 1: Selecionar */}
      {step === 'select' && (
        <div className="space-y-4">
          {/* Upload local */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLocalFile(f) }}
            className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
          >
            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium text-sm">Arraste ou clique para enviar</p>
            <p className="text-gray-400 text-xs mt-1">JPG, PNG ou PDF · máx. 10 MB</p>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleLocalFile(e.target.files[0]) }} />
          </div>

          <div className="text-center text-xs text-gray-300">ou</div>

          {/* Google Drive */}
          <button
            onClick={hasDriveConfig ? handleDrivePicker : undefined}
            disabled={!hasDriveConfig}
            className={`w-full flex items-center justify-center gap-3 border rounded-xl py-4 text-sm font-medium transition-colors ${
              hasDriveConfig
                ? 'border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer'
                : 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50'
            }`}
          >
            <FolderOpen className="w-5 h-5 text-blue-500" />
            Selecionar do Google Drive
            {!hasDriveConfig && <span className="text-xs text-amber-500 ml-1">(VITE_GOOGLE_DRIVE_CLIENT_ID não configurado)</span>}
          </button>
        </div>
      )}

      {/* Etapa 2: Processando */}
      {step === 'processing' && (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Loader2 className="w-10 h-10 text-blue-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-700 font-medium">{processing || 'Processando...'}</p>
          <p className="text-gray-400 text-xs mt-2">A IA está lendo o comprovante</p>
        </div>
      )}

      {/* Etapa 3: Validar */}
      {step === 'validate' && (
        <div className="space-y-4">
          {isMock && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-amber-700 text-xs">Sem chave Vision API — dados simulados para teste. Configure <code>GOOGLE_VISION_API_KEY</code> para OCR real.</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            <div className="px-5 py-4">
              <h3 className="font-semibold text-gray-800 text-sm mb-1">Revisar dados extraídos</h3>
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
              <label className="text-xs font-medium text-gray-600 block mb-1">Descrição / Fornecedor *</label>
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
                  <option value="">— Nenhum —</option>
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
                {form.account_id && <span className="ml-2 text-blue-500 text-xs">✨ sugerida automaticamente</span>}
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

          {/* Texto bruto */}
          {rawText && (
            <details className="bg-gray-50 rounded-xl border border-gray-100">
              <summary className="px-4 py-3 text-xs text-gray-400 cursor-pointer select-none flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Texto bruto extraído (OCR)
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
              Confirmar e Salvar Transação
            </button>
          </div>
        </div>
      )}

      {/* Etapa 4: Concluído */}
      {step === 'done' && (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Transação salva!</h3>
          <p className="text-gray-400 text-sm mb-6">O comprovante foi processado e a transação registrada com sucesso.</p>
          <button onClick={reset} className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
            Importar outro comprovante
          </button>
        </div>
      )}
    </div>
  )
}
