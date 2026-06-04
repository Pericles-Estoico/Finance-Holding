export interface OfxTransaction {
  fitId: string
  type: 'DEBIT' | 'CREDIT' | 'OTHER'
  date: string        // YYYY-MM-DD
  amount: number      // positivo = crédito, negativo = débito
  name: string
  memo: string
}

export interface OfxStatement {
  bankId?: string
  accountId?: string
  dateStart?: string
  dateEnd?: string
  transactions: OfxTransaction[]
}

// Converte data OFX (YYYYMMDD ou YYYYMMDDHHmmss) para YYYY-MM-DD
function parseOfxDate(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '').substring(0, 8)
  if (d.length < 8) return new Date().toISOString().split('T')[0]
  return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`
}

function extractTag(src: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<\n\r]*)`, 'i')
  return (re.exec(src)?.[1] ?? '').trim()
}

function extractBlocks(src: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'gi')
  return src.match(re) ?? []
}

function parseSgml(raw: string): OfxStatement {
  // Normaliza quebras de linha e remove cabeçalho OFXHEADER
  const body = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const dateStart = parseOfxDate(extractTag(body, 'DTSTART'))
  const dateEnd   = parseOfxDate(extractTag(body, 'DTEND'))
  const bankId    = extractTag(body, 'BANKID')
  const accountId = extractTag(body, 'ACCTID')

  const txBlocks = extractBlocks(body, 'STMTTRN')
  // Fallback: OFX sem tags de fechamento (SGML puro)
  const txRaw = txBlocks.length > 0 ? txBlocks : parseSgmlUnclosed(body)

  const transactions: OfxTransaction[] = txRaw.map(block => {
    const rawAmt  = extractTag(block, 'TRNAMT').replace(',', '.')
    const amount  = parseFloat(rawAmt) || 0
    const trnType = extractTag(block, 'TRNTYPE').toUpperCase()
    const type: OfxTransaction['type'] =
      trnType === 'DEBIT' || amount < 0 ? 'DEBIT' :
      trnType === 'CREDIT' || amount > 0 ? 'CREDIT' : 'OTHER'

    return {
      fitId:  extractTag(block, 'FITID') || `${Date.now()}-${Math.random()}`,
      type,
      date:   parseOfxDate(extractTag(block, 'DTPOSTED')),
      amount: Math.abs(amount),
      name:   extractTag(block, 'NAME'),
      memo:   extractTag(block, 'MEMO'),
    }
  }).filter(t => t.amount > 0)

  return { bankId, accountId, dateStart, dateEnd, transactions }
}

// Parser para OFX SGML sem tags de fechamento (formato mais comum dos bancos BR)
function parseSgmlUnclosed(body: string): string[] {
  const blocks: string[] = []
  const start = /<STMTTRN>/gi
  let match: RegExpExecArray | null

  while ((match = start.exec(body)) !== null) {
    const from = match.index
    const nextMatch = /<STMTTRN>/i.exec(body.slice(from + 1))
    const to = nextMatch ? from + 1 + nextMatch.index : body.length
    blocks.push(body.slice(from, to))
  }

  return blocks
}

function parseXml(raw: string): OfxStatement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'text/xml')

  const getText = (parent: Element | Document, tag: string): string =>
    parent.querySelector(tag)?.textContent?.trim() ?? ''

  const bankId    = getText(doc, 'BANKID')
  const accountId = getText(doc, 'ACCTID')
  const dateStart = parseOfxDate(getText(doc, 'DTSTART'))
  const dateEnd   = parseOfxDate(getText(doc, 'DTEND'))

  const txNodes = doc.querySelectorAll('STMTTRN')
  const transactions: OfxTransaction[] = Array.from(txNodes).map(node => {
    const rawAmt  = getText(node, 'TRNAMT').replace(',', '.')
    const amount  = parseFloat(rawAmt) || 0
    const trnType = getText(node, 'TRNTYPE').toUpperCase()
    const type: OfxTransaction['type'] =
      trnType === 'DEBIT' || amount < 0 ? 'DEBIT' :
      trnType === 'CREDIT' || amount > 0 ? 'CREDIT' : 'OTHER'

    return {
      fitId:  getText(node, 'FITID') || `${Date.now()}-${Math.random()}`,
      type,
      date:   parseOfxDate(getText(node, 'DTPOSTED')),
      amount: Math.abs(amount),
      name:   getText(node, 'NAME'),
      memo:   getText(node, 'MEMO'),
    }
  }).filter(t => t.amount > 0)

  return { bankId, accountId, dateStart, dateEnd, transactions }
}

export function parseOfx(content: string): OfxStatement {
  const trimmed = content.trim()

  // OFX 2.x começa com <?xml ou <OFX>
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<OFX>')) {
    return parseXml(trimmed)
  }

  // OFX 1.x: cabeçalho SGML + body após linha em branco ou <OFX>
  const ofxStart = trimmed.indexOf('<OFX>')
  const body = ofxStart >= 0 ? trimmed.slice(ofxStart) : trimmed
  return parseSgml(body)
}
