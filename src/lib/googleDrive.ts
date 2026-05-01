declare global {
  interface Window {
    gapi: {
      load: (lib: string, cb: () => void) => void
      client: { init: (cfg: object) => Promise<void> }
    }
    google: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder
        ViewId: { DOCS: string }
        Action: { PICKED: string; CANCEL: string }
      }
    }
  }
}

interface GooglePickerBuilder {
  addView(view: unknown): GooglePickerBuilder
  setOAuthToken(token: string): GooglePickerBuilder
  setDeveloperKey(key: string): GooglePickerBuilder
  setCallback(cb: (data: GooglePickerResponse) => void): GooglePickerBuilder
  setTitle(title: string): GooglePickerBuilder
  build(): { setVisible(v: boolean): void }
}

export interface GooglePickerResponse {
  action: string
  docs?: Array<{
    id: string
    name: string
    mimeType: string
    url: string
    iconUrl: string
  }>
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  url: string
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID as string | undefined
const API_KEY   = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined
const SCOPES    = 'https://www.googleapis.com/auth/drive.readonly'

let accessToken: string | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export async function authorizeGoogleDrive(): Promise<string> {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_DRIVE_CLIENT_ID não configurado no .env')
  await loadScript('https://accounts.google.com/gsi/client')

  return new Promise((resolve, reject) => {
    const client = (window as unknown as {
      google: { accounts: { oauth2: { initTokenClient: (cfg: object) => { requestAccessToken: () => void } } } }
    }).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp: { access_token?: string; error?: string }) => {
        if (resp.error) { reject(new Error(resp.error)); return }
        accessToken = resp.access_token!
        resolve(accessToken)
      },
    })
    client.requestAccessToken()
  })
}

export async function openDrivePicker(): Promise<DriveFile | null> {
  if (!accessToken) accessToken = await authorizeGoogleDrive()

  await loadScript('https://apis.google.com/js/api.js')

  return new Promise((resolve, reject) => {
    window.gapi.load('picker', () => {
      try {
        const view = new (window as unknown as {
          google: { picker: { DocsView: new (id: unknown) => unknown; ViewId: { DOCS: unknown } } }
        }).google.picker.DocsView(window.google.picker.ViewId.DOCS)

        const picker = new window.google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(accessToken!)
          .setDeveloperKey(API_KEY ?? '')
          .setTitle('Selecione um comprovante')
          .setCallback((data: GooglePickerResponse) => {
            if (data.action === window.google.picker.Action.PICKED && data.docs?.[0]) {
              const doc = data.docs[0]
              resolve({ id: doc.id, name: doc.name, mimeType: doc.mimeType, url: doc.url })
            } else if (data.action === window.google.picker.Action.CANCEL) {
              resolve(null)
            }
          })
          .build()
        picker.setVisible(true)
      } catch (e) { reject(e) }
    })
  })
}

export interface DriveFolderFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  createdTime: string
}

export async function listFolderFiles(folderId: string): Promise<DriveFolderFile[]> {
  if (!accessToken) accessToken = await authorizeGoogleDrive()
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType = 'application/pdf')`,
    fields: 'files(id,name,mimeType,webViewLink,createdTime)',
    pageSize: '100',
    orderBy: 'createdTime desc',
  })
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`Drive API: ${err?.error?.message ?? res.status}`)
  }
  const data = await res.json() as { files: DriveFolderFile[] }
  return data.files ?? []
}

export async function downloadDriveFileAsBase64(fileId: string): Promise<{ base64: string; mimeType: string }> {
  if (!accessToken) throw new Error('Não autenticado no Google Drive')

  // Busca metadados
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const meta = await metaRes.json() as { mimeType: string }

  // Faz download do conteúdo
  const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const blob = await contentRes.blob()
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(blob)
  })
  return { base64, mimeType: meta.mimeType }
}
