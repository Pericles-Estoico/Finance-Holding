import { useRef } from 'react'

type Period = 'hoje' | 'mes_atual' | 'trimestre' | 'ano_atual' | 'custom'

const LABELS: Record<Period, string> = {
  hoje: 'Hoje',
  mes_atual: 'Mês',
  trimestre: 'Trimestre',
  ano_atual: 'Ano',
  custom: 'Custom',
}

interface Props {
  value: Period
  onChange: (p: Period) => void
}

export default function PeriodChips({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5 -mx-1 px-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {(Object.keys(LABELS) as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`flex-none px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
            value === p
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          {LABELS[p]}
        </button>
      ))}
    </div>
  )
}
