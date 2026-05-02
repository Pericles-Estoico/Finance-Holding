import type { PendingClassification } from '../../types'

const BASE = import.meta.env.DEV ? 'http://localhost:3001' : ''

export interface OcrExtracted {
  payee?: string
  amount_cents?: number
  date?: string
  type?: 'receita' | 'despesa'
  raw_text?: string
}

export interface ProcessFileResult {
  status: 'auto_created' | 'pending' | 'already_processed' | 'error'
  transaction_id?: string
  pending_id?: string
  extracted?: OcrExtracted
  message?: string
}

export async function checkProcessedFiles(companyId: string, fileIds: string[]): Promise<string[]> {
  const res = await fetch(`${BASE}/api/drive-import/check-processed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_id: companyId, file_ids: fileIds }),
  })
  if (!res.ok) throw new Error(`Erro ao verificar arquivos: ${res.status}`)
  const data = await res.json() as { processed_ids: string[] }
  return data.processed_ids
}

export async function processFile(params: {
  company_id: string
  file_id: string
  file_name: string
  file_url: string
  base64: string
  mime_type: string
}): Promise<ProcessFileResult> {
  const res = await fetch(`${BASE}/api/drive-import/process-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Erro ${res.status}`)
  }
  return res.json() as Promise<ProcessFileResult>
}

export async function getPendingClassifications(companyId: string): Promise<PendingClassification[]> {
  const res = await fetch(`${BASE}/api/drive-import/pending?company_id=${companyId}`)
  if (!res.ok) throw new Error(`Erro ao buscar pendentes: ${res.status}`)
  const data = await res.json() as { pending: PendingClassification[] }
  return data.pending
}

export async function classifyPending(params: {
  pending_id: string
  company_id: string
  account_id: string
  type: 'receita' | 'despesa'
  save_rule: boolean
}): Promise<{ transaction_id: string }> {
  const res = await fetch(`${BASE}/api/drive-import/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Erro ${res.status}`)
  }
  return res.json() as Promise<{ transaction_id: string }>
}

export async function getDriveConfig(companyId: string): Promise<{ folder_id?: string; folder_url?: string } | null> {
  const res = await fetch(`${BASE}/api/drive-import/config?company_id=${companyId}`)
  if (!res.ok) return null
  return res.json() as Promise<{ folder_id?: string; folder_url?: string }>
}

export interface DriveFolderFileServer {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  createdTime: string
}

export async function listFolderFilesServer(folderId: string): Promise<DriveFolderFileServer[]> {
  const res = await fetch(`${BASE}/api/drive-import/list-folder?folder_id=${encodeURIComponent(folderId)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Erro ${res.status} ao listar pasta`)
  }
  const data = await res.json() as { files: DriveFolderFileServer[] }
  return data.files
}

export async function downloadDriveFileServer(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(`${BASE}/api/drive-import/download-file?file_id=${encodeURIComponent(fileId)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Erro ${res.status} ao baixar arquivo`)
  }
  return res.json() as Promise<{ base64: string; mimeType: string }>
}

export async function saveDriveConfig(companyId: string, folderUrl: string): Promise<void> {
  const match = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  const folder_id = match?.[1]
  if (!folder_id) throw new Error('URL da pasta inválida. Cole o link completo do Google Drive.')
  const res = await fetch(`${BASE}/api/drive-import/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_id: companyId, folder_id, folder_url: folderUrl }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Erro ao salvar configuração`)
  }
}
