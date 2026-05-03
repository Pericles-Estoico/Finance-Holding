import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtBRL } from '../../../lib/currency'

interface ExecutiveSummaryData {
  companyName: string
  period: { from: string; to: string }
  receitaLiquida: number
  lucroBruto: number
  ebitda: number
  lucroLiquido: number
  margemBruta: number
  margemEBITDA: number
  margemLiquida: number
  margemOperacional: number
  crescimentoReceita: number | null
  crescimentoEBITDA: number | null
}

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return v.toFixed(1) + '%'
}

function fmtPeriod(from: string, to: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  return `${fmt(from)} a ${fmt(to)}`
}

export function exportExecutiveSummaryPDF(data: ExecutiveSummaryData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const marginX = 15
  const contentW = pageW - marginX * 2
  let y = 15

  // ── Cabeçalho ──────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42)   // slate-900
  doc.rect(0, 0, pageW, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(data.companyName, marginX, 11)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('EXECUTIVE SUMMARY — RELATÓRIO DE INVESTIDORES', marginX, 17)
  doc.text(fmtPeriod(data.period.from, data.period.to), marginX, 23)

  doc.setTextColor(0, 0, 0)
  y = 36

  // ── KPIs principais — 4 cards ──────────────────────────────────────
  const cardW = contentW / 4 - 2
  const cards = [
    { label: 'Receita Líquida', value: fmtBRL(data.receitaLiquida) },
    { label: 'EBITDA',          value: fmtBRL(data.ebitda) },
    { label: 'Lucro Líquido',   value: fmtBRL(data.lucroLiquido) },
    { label: 'Margem EBITDA',   value: fmtPct(data.margemEBITDA) },
  ]

  cards.forEach((card, i) => {
    const x = marginX + i * (cardW + 2.5)
    doc.setFillColor(241, 245, 249)   // slate-100
    doc.roundedRect(x, y, cardW, 20, 2, 2, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)   // slate-500
    doc.text(card.label.toUpperCase(), x + 3, y + 6)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(card.value, x + 3, y + 15)
  })

  y += 26

  // ── DRE Resumida ───────────────────────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('DRE Resumida', marginX, y)
  y += 4

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Linha', 'Valor', '% Rec. Líquida']],
    body: [
      ['Receita Líquida',         fmtBRL(data.receitaLiquida),                    '100,0%'],
      ['Lucro Bruto',             fmtBRL(data.lucroBruto),                         fmtPct(data.margemBruta)],
      ['EBITDA',                  fmtBRL(data.ebitda),                             fmtPct(data.margemEBITDA)],
      ['Lucro Líquido',           fmtBRL(data.lucroLiquido),                       fmtPct(data.margemLiquida)],
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80 },
      1: { halign: 'right', cellWidth: 50 },
      2: { halign: 'right' },
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8

  // ── Indicadores de Margens ─────────────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Indicadores de Desempenho', marginX, y)
  y += 4

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Indicador', 'Atual', 'Benchmark Setor', 'YoY']],
    body: [
      ['Margem Bruta',            fmtPct(data.margemBruta),       '55%', '—'],
      ['Margem Operacional',      fmtPct(data.margemOperacional),  '15%', '—'],
      ['Margem EBITDA',           fmtPct(data.margemEBITDA),       '20%', fmtPct(data.crescimentoEBITDA)],
      ['Margem Líquida',          fmtPct(data.margemLiquida),      '18%', '—'],
      ['Crescimento Receita YoY', fmtPct(data.crescimentoReceita), '20%', '—'],
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
  })

  // ── Rodapé ─────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)  // slate-400
  const now = new Date().toLocaleString('pt-BR')
  doc.text(`Gerado em ${now} · Finance Holding · financedre.com.br`, marginX, pageH - 8)
  doc.text('Documento confidencial — uso exclusivo para apresentação a investidores', marginX, pageH - 4)

  // ── Download ───────────────────────────────────────────────────────
  const filename = `executive-summary-${data.period.from}-${data.period.to}.pdf`
  doc.save(filename)
}
