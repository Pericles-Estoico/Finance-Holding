import { useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns'
import type { DateRange } from '../types/finance.types'

interface Props {
  value: DateRange
  onChange: (range: DateRange) => void
}

type Preset = 'this_month' | 'last_month' | 'last_3' | 'last_6' | 'this_year' | 'custom'

function fmt(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

const presets: Array<{ id: Preset; label: string }> = [
  { id: 'this_month', label: 'Este mês' },
  { id: 'last_month', label: 'Mês passado' },
  { id: 'last_3', label: 'Últimos 3 meses' },
  { id: 'last_6', label: 'Últimos 6 meses' },
  { id: 'this_year', label: 'Ano atual' },
  { id: 'custom', label: 'Personalizado' },
]

function resolvePreset(preset: Preset): DateRange | null {
  const now = new Date()
  switch (preset) {
    case 'this_month':
      return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) }
    case 'last_month': {
      const last = subMonths(now, 1)
      return { from: fmt(startOfMonth(last)), to: fmt(endOfMonth(last)) }
    }
    case 'last_3': {
      const start = subMonths(startOfMonth(now), 2)
      return { from: fmt(start), to: fmt(endOfMonth(now)) }
    }
    case 'last_6': {
      const start = subMonths(startOfMonth(now), 5)
      return { from: fmt(start), to: fmt(endOfMonth(now)) }
    }
    case 'this_year':
      return { from: fmt(startOfYear(now)), to: fmt(endOfYear(now)) }
    default:
      return null
  }
}

export default function FinancialPeriodFilter({ value, onChange }: Props) {
  const [activePreset, setActivePreset] = useState<Preset>('this_month')

  function handlePreset(preset: Preset) {
    setActivePreset(preset)
    const resolved = resolvePreset(preset)
    if (resolved) onChange(resolved)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => handlePreset(p.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activePreset === p.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {p.label}
        </button>
      ))}
      {activePreset === 'custom' && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">até</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  )
}
