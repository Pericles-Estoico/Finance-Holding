import type { Transaction, AccountCategory, Company } from '../../types'

function esc(v: string | number | undefined | null): string {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function row(...cols: (string | number | undefined | null)[]): string {
  return cols.map(esc).join(',')
}

export function exportTransacoesCSV(
  transactions: Transaction[],
  accountMap: Map<string, AccountCategory>,
  companyMap: Map<string, Company>,
): void {
  const headers = row('Data', 'Tipo', 'Descrição', 'Empresa', 'Conta', 'Tipo de Conta', 'Canal', 'Valor (R$)', 'Simulação')
  const lines = transactions.map(tx => {
    const acc = accountMap.get(tx.account_id ?? '')
    const company = companyMap.get(tx.company_id)
    const valor = (tx.amount_cents / 100).toFixed(2).replace('.', ',')
    return row(
      tx.date,
      tx.type === 'receita' ? 'Receita' : 'Despesa',
      tx.description,
      company?.name ?? tx.company_id,
      acc ? `${acc.code} — ${acc.name}` : (tx.account_id ?? ''),
      acc?.type ?? '',
      tx.channel ?? '',
      valor,
      tx.is_simulation ? 'Sim' : 'Não',
    )
  })

  const csv = [headers, ...lines].join('\r\n')
  const bom = '﻿' // BOM para Excel reconhecer UTF-8
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transacoes_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportDRECSV(lines: { label: string; amountCents: number; percentOfRevenue: number }[]): void {
  const headers = row('Conta', 'Valor (R$)', '% da Receita')
  const rows = lines.map(l =>
    row(l.label, (l.amountCents / 100).toFixed(2).replace('.', ','), l.percentOfRevenue.toFixed(2).replace('.', ','))
  )
  const csv = [headers, ...rows].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dre_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
