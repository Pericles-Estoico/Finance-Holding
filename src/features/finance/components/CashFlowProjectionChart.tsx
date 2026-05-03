import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { CashFlowProjection } from '../types/finance.types'

interface Props {
  projection: CashFlowProjection
  compact?: boolean
}

function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

export default function CashFlowProjectionChart({ projection, compact = false }: Props) {
  const data = projection.rows.map((row) => ({
    date: fmtDate(row.date),
    entradas: row.projectedInflow + row.realizedInflow,
    saidas: row.projectedOutflow + row.realizedOutflow,
    saldo: row.closingBalance,
    negative: row.closingBalance < 0,
  }))

  return (
    <div className={compact ? 'h-48' : 'h-72'}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: compact ? 9 : 11 }}
            interval={compact ? 4 : 2}
          />
          <YAxis
            tick={{ fontSize: compact ? 9 : 11 }}
            tickFormatter={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()
            }
          />
          <Tooltip
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                entradas: 'Entradas',
                saidas: 'Saídas',
                saldo: 'Saldo',
              }
              return [fmtBRL(Number(value) || 0), labels[String(name)] ?? String(name)]
            }}
            labelFormatter={(label) => `Data: ${label}`}
          />
          {!compact && (
            <Legend
              formatter={(value) => {
                const labels: Record<string, string> = {
                  entradas: 'Entradas',
                  saidas: 'Saídas',
                  saldo: 'Saldo acumulado',
                }
                return labels[value] ?? value
              }}
            />
          )}
          <Bar dataKey="entradas" fill="#10b981" radius={[2, 2, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="#10b981" />
            ))}
          </Bar>
          <Bar dataKey="saidas" fill="#ef4444" radius={[2, 2, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="#ef4444" />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="saldo"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
