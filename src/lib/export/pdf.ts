import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DREResult } from '../dre'
import type { Transaction, AccountCategory, Company } from '../../types'

// ─── Paleta DESIGN.md ────────────────────────────────────────────────────────
const C = {
  primary:   [15,  23,  42]  as [number,number,number],  // slate-900
  accent:    [29,  78, 216]  as [number,number,number],  // blue-800
  muted:     [100,116,139]  as [number,number,number],   // slate-500
  subtle:    [226,232,240]  as [number,number,number],   // slate-200
  white:     [255,255,255]  as [number,number,number],
  success:   [5,  150,105]  as [number,number,number],   // emerald-600
  danger:    [220, 38, 38]  as [number,number,number],   // red-600
  warn:      [217,119,  6]  as [number,number,number],   // amber-600
}

function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  // Barra lateral esquerda
  doc.setFillColor(...C.accent)
  doc.rect(0, 0, 6, doc.internal.pageSize.height, 'F')

  // Título
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...C.primary)
  doc.text(title, 14, 18)

  // Subtítulo
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...C.muted)
  doc.text(subtitle, 14, 25)

  // Linha separadora
  doc.setDrawColor(...C.subtle)
  doc.setLineWidth(0.5)
  doc.line(14, 29, doc.internal.pageSize.width - 14, 29)
}

function addFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const w = doc.internal.pageSize.width
    const h = doc.internal.pageSize.height
    doc.setFontSize(8)
    doc.setTextColor(...C.muted)
    doc.text('Finance Master — Relatório Confidencial', 14, h - 8)
    doc.text(`Página ${i} de ${pages}`, w - 14, h - 8, { align: 'right' })
    doc.text(new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' }), w / 2, h - 8, { align: 'center' })
  }
}

// ─── DRE PDF ─────────────────────────────────────────────────────────────────

export function gerarDREPDF(dre: DREResult, company: Company | null, period: string): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const companyName = company?.name ?? 'Visão Consolidada'
  const cnpj = company?.cnpj ? ` · CNPJ ${company.cnpj}` : ''

  addHeader(doc, 'DRE — Demonstração do Resultado', `${companyName}${cnpj} · ${period}`)

  // KPI Summary boxes
  const kpis = [
    { label: 'Receita Bruta',    value: fmtBRL(dre.receitaBruta),   color: C.accent },
    { label: 'Lucro Bruto',      value: fmtBRL(dre.lucroBruto),      color: dre.lucroBruto >= 0 ? C.success : C.danger },
    { label: 'Margem Bruta',     value: fmtPct(dre.margemBruta),     color: dre.margemBruta >= 55 ? C.success : C.warn },
    { label: 'Lucro Líquido',    value: fmtBRL(dre.lucroLiquido),    color: dre.lucroLiquido >= 0 ? C.success : C.danger },
    { label: 'Margem Líquida',   value: fmtPct(dre.margemLiquida),   color: dre.margemLiquida >= 18 ? C.success : C.warn },
  ]
  const boxW = (doc.internal.pageSize.width - 28 - (kpis.length - 1) * 3) / kpis.length
  kpis.forEach((k, i) => {
    const x = 14 + i * (boxW + 3)
    doc.setFillColor(...C.subtle)
    doc.roundedRect(x, 33, boxW, 18, 2, 2, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text(k.label.toUpperCase(), x + boxW / 2, 39, { align: 'center' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...k.color)
    doc.text(k.value, x + boxW / 2, 46, { align: 'center' })
  })

  // Tabela DRE
  const tableBody = dre.lines.map(line => {
    const isTotal    = line.isTotal
    const isSubtotal = line.isSubtotal
    const amtColor   = line.amountCents >= 0 ? C.success : C.danger

    return {
      cells: [
        { content: `  ${line.label}`, styles: { fontStyle: (isTotal||isSubtotal?'bold':'normal') as 'bold'|'normal', textColor: isTotal ? C.primary : isSubtotal ? C.accent : C.primary } },
        { content: fmtBRL(line.amountCents), styles: { fontStyle: (isTotal||isSubtotal?'bold':'normal') as 'bold'|'normal', halign: 'right' as const, textColor: amtColor } },
        { content: fmtPct(line.percentOfRevenue), styles: { halign: 'right' as const, textColor: C.muted } },
      ],
      rowStyle: isTotal ? { fillColor: [241,245,249] as [number,number,number] } : isSubtotal ? { fillColor: [239,246,255] as [number,number,number] } : {},
    }
  })

  autoTable(doc, {
    startY: 56,
    head: [['Conta', 'Valor', '% Receita']],
    body: tableBody.map(r => r.cells.map(c => c.content)),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: C.primary },
    alternateRowStyles: { fillColor: [248,250,252] as [number,number,number] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      const r = tableBody[data.row.index]
      if (r && data.section === 'body') {
        const style = r.rowStyle as { fillColor?: [number,number,number] }
        if (style?.fillColor) data.cell.styles.fillColor = style.fillColor
        const cell = r.cells[data.column.index]
        if (cell?.styles?.textColor) data.cell.styles.textColor = cell.styles.textColor as [number,number,number]
        if (cell?.styles?.fontStyle) data.cell.styles.fontStyle = cell.styles.fontStyle
        if (cell?.styles?.halign)    data.cell.styles.halign    = cell.styles.halign
      }
    },
  })

  // Canais
  if (Object.keys(dre.receitaPorCanal).length > 0) {
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.primary)
    doc.text('Receita por Canal', 14, finalY)

    autoTable(doc, {
      startY: finalY + 4,
      head: [['Canal', 'Valor', '% Receita']],
      body: Object.entries(dre.receitaPorCanal).map(([ch, amt]) => [
        ch.replace('_', ' '),
        fmtBRL(amt),
        fmtPct(dre.receitaBruta > 0 ? (amt / dre.receitaBruta) * 100 : 0),
      ]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      headStyles: { fillColor: C.accent, textColor: C.white, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    })
  }

  addFooter(doc)
  doc.save(`DRE_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── Transações PDF ──────────────────────────────────────────────────────────

export function gerarTransacoesPDF(
  transactions: Transaction[],
  accountMap: Map<string, AccountCategory>,
  companyMap: Map<string, Company>,
  periodo: string,
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  addHeader(doc, 'Relatório de Transações', `${periodo} · ${transactions.length} lançamentos`)

  const totalR = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount_cents, 0)
  const totalD = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount_cents, 0)

  // Sumário
  doc.setFontSize(9)
  doc.setTextColor(...C.muted)
  doc.text(`Total Receitas: ${fmtBRL(totalR)}   Total Despesas: ${fmtBRL(totalD)}   Saldo: ${fmtBRL(totalR - totalD)}`, 14, 33)

  autoTable(doc, {
    startY: 38,
    head: [['Data', 'Tipo', 'Descrição', 'Empresa', 'Conta', 'Canal', 'Valor']],
    body: transactions.map(tx => {
      const acc     = accountMap.get(tx.account_id)
      const company = companyMap.get(tx.company_id)
      return [
        tx.date,
        tx.type === 'receita' ? 'Receita' : 'Despesa',
        tx.description,
        company?.name ?? '—',
        acc ? `${acc.code} ${acc.name}` : '—',
        tx.channel?.replace('_', ' ') ?? '—',
        (tx.type === 'despesa' ? '− ' : '+ ') + fmtBRL(tx.amount_cents),
      ]
    }),
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: C.primary },
    alternateRowStyles: { fillColor: [248,250,252] as [number,number,number] },
    columnStyles: { 6: { halign: 'right' } },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.textColor = data.cell.text[0] === 'Receita' ? C.success : C.danger
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.section === 'body' && data.column.index === 6) {
        data.cell.styles.textColor = data.cell.text[0].startsWith('−') ? C.danger : C.success
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  addFooter(doc)
  doc.save(`Transacoes_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ─── Resumo Executivo PDF ────────────────────────────────────────────────────

export function gerarResumoExecutivoPDF(dre: DREResult, company: Company | null, period: string): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const companyName = company?.name ?? 'Visão Consolidada'
  addHeader(doc, 'Resumo Executivo', `${companyName} · ${period}`)

  let y = 35

  // KPIs principais em grid 2x3
  const kpis = [
    ['Receita Bruta',       fmtBRL(dre.receitaBruta),        dre.receitaBruta > 0],
    ['Receita Líquida',     fmtBRL(dre.receitaLiquida),       dre.receitaLiquida > 0],
    ['Lucro Bruto',         fmtBRL(dre.lucroBruto),           dre.lucroBruto >= 0],
    ['Margem Bruta',        fmtPct(dre.margemBruta),          dre.margemBruta >= 55],
    ['Lucro Líquido',       fmtBRL(dre.lucroLiquido),         dre.lucroLiquido >= 0],
    ['Margem Líquida',      fmtPct(dre.margemLiquida),        dre.margemLiquida >= 18],
  ] as [string, string, boolean][]

  const cols = 3, boxW = (doc.internal.pageSize.width - 28 - (cols - 1) * 4) / cols
  kpis.forEach(([label, value, ok], i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x = 14 + col * (boxW + 4)
    const ky = y + row * 24
    doc.setFillColor(...(ok ? [236, 253, 245] : [254, 242, 242]) as [number,number,number])
    doc.roundedRect(x, ky, boxW, 20, 2, 2, 'F')
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(...C.muted)
    doc.text(label.toUpperCase(), x + 4, ky + 7)
    doc.setFontSize(12); doc.setFont('helvetica','bold')
    doc.setTextColor(...(ok ? C.success : C.danger))
    doc.text(value, x + 4, ky + 16)
  })

  y += 52

  // DRE resumida
  doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...C.primary)
  doc.text('Cascata de Resultados', 14, y)
  y += 5

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Valor', '% Receita']],
    body: [
      ['Receita Bruta',           fmtBRL(dre.receitaBruta),          '100,00%'],
      ['(-) Deduções',            fmtBRL(dre.deducoes),               fmtPct(dre.receitaBruta>0?(dre.deducoes/dre.receitaBruta)*100:0)],
      ['(=) Receita Líquida',     fmtBRL(dre.receitaLiquida),         fmtPct(dre.receitaBruta>0?(dre.receitaLiquida/dre.receitaBruta)*100:0)],
      ['(-) CMV',                 fmtBRL(dre.cmv),                    fmtPct(dre.receitaBruta>0?(dre.cmv/dre.receitaBruta)*100:0)],
      ['(=) Lucro Bruto',         fmtBRL(dre.lucroBruto),             fmtPct(dre.margemBruta)],
      ['(-) Desp. Operacionais',  fmtBRL(dre.despesasOperacionais),   fmtPct(dre.receitaBruta>0?(dre.despesasOperacionais/dre.receitaBruta)*100:0)],
      ['(=) Lucro Operacional',   fmtBRL(dre.lucroOperacional),       fmtPct(dre.receitaBruta>0?(dre.lucroOperacional/dre.receitaBruta)*100:0)],
      ['(-) Impostos',            fmtBRL(dre.impostos),               fmtPct(dre.receitaBruta>0?(dre.impostos/dre.receitaBruta)*100:0)],
      ['(=) Lucro Líquido',       fmtBRL(dre.lucroLiquido),           fmtPct(dre.margemLiquida)],
    ],
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      const subtotals = ['(=) Receita Líquida','(=) Lucro Bruto','(=) Lucro Operacional','(=) Lucro Líquido']
      if (data.section === 'body' && subtotals.includes(String(data.cell.text[0]))) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [241,245,249] as [number,number,number]
      }
    },
  })

  // Canais se existirem
  if (Object.keys(dre.receitaPorCanal).length > 0) {
    const fy = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...C.primary)
    doc.text('Receita por Canal de Venda', 14, fy)
    autoTable(doc, {
      startY: fy + 4,
      head: [['Canal', 'Valor', '% Total']],
      body: Object.entries(dre.receitaPorCanal)
        .sort(([,a],[,b]) => b - a)
        .map(([ch, amt]) => [
          ch.replace('_',' '),
          fmtBRL(amt),
          fmtPct(dre.receitaBruta>0?(amt/dre.receitaBruta)*100:0),
        ]),
      headStyles: { fillColor: C.accent, textColor: C.white, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    })
  }

  addFooter(doc)
  doc.save(`ResumoExecutivo_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
