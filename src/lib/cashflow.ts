import type { Transaction, RecurringTransaction } from '../types'

export interface ProjectedTransaction {
  id: string
  date: string
  description: string
  amount_cents: number
  type: 'receita' | 'despesa'
  is_recurring_projection: boolean
  parent_recurring_id?: string
}

function addMonths(d: Date, m: number): Date {
  const r = new Date(d.valueOf())
  r.setUTCMonth(r.getUTCMonth() + m)
  return r
}

function addWeeks(d: Date, w: number): Date {
  const r = new Date(d.valueOf())
  r.setUTCDate(r.getUTCDate() + (w * 7))
  return r
}

export function generateCashFlowProjection(
  transactions: Transaction[],
  recurring: RecurringTransaction[],
  startDateStr: string,
  endDateStr: string
): ProjectedTransaction[] {
  // Fixando as strings para evitar fuso horário maluco ao criar os objetos Date
  const start = new Date(startDateStr + 'T00:00:00Z')
  const end = new Date(endDateStr + 'T23:59:59Z')
  const projected: ProjectedTransaction[] = []

  // 1. Adicionar transações reais no período
  for (const tx of transactions) {
    const txDate = new Date(tx.date + 'T12:00:00Z')
    if (txDate >= start && txDate <= end) {
      projected.push({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount_cents: tx.amount_cents,
        type: tx.type,
        is_recurring_projection: false
      })
    }
  }

  // 2. Desenrolar regras de transações recorrentes
  for (const rule of recurring) {
    if (rule.status === 'cancelled') continue

    let currentDate = new Date(rule.start_date + 'T12:00:00Z')
    const ruleEndDate = rule.end_date ? new Date(rule.end_date + 'T23:59:59Z') : null

    // Continua gerando ocorrências até ultrapassar a data limite de projeção
    while (currentDate <= end) {
      // Se a regra tem uma data fim e a data atual passou dela, pare de gerar.
      if (ruleEndDate && currentDate > ruleEndDate) break

      // Se a ocorrência cai dentro da nossa janela visível, adicionamos à lista
      if (currentDate >= start) {
        const dStr = currentDate.toISOString().split('T')[0]
        projected.push({
          id: `proj_${rule.id}_${dStr}`,
          date: dStr,
          description: `${rule.description} (Projetado)`,
          amount_cents: rule.amount_cents,
          type: rule.type,
          is_recurring_projection: true,
          parent_recurring_id: rule.id
        })
      }

      // Avança para a próxima data
      if (rule.interval === 'mensal') {
        currentDate = addMonths(currentDate, 1)
      } else if (rule.interval === 'semanal') {
        currentDate = addWeeks(currentDate, 1)
      } else if (rule.interval === 'quinzenal') {
        currentDate = addWeeks(currentDate, 2)
      } else if (rule.interval === 'anual') {
        currentDate = addMonths(currentDate, 12)
      } else {
        break // failsafe
      }
    }
  }

  // 3. Ordenar tudo cronologicamente
  return projected.sort((a, b) => a.date.localeCompare(b.date))
}
