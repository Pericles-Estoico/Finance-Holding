import type { ChartAccountV2 } from '../services/corporateChartApi'
import { groupAccountsByClass, CLASS_LABELS } from '../services/ocrCorporateMapping'

interface Props {
  accounts: ChartAccountV2[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const CLASS_ORDER = ['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY']

export default function CorporateAccountSelect({
  accounts,
  value,
  onChange,
  placeholder = 'Selecione a conta corporativa',
  className = '',
  disabled = false,
}: Props) {
  const grouped = groupAccountsByClass(accounts)

  // Ordena classes conforme a ordem canônica
  const orderedClasses = CLASS_ORDER.filter((cls) => grouped.has(cls))
  const remainingClasses = [...grouped.keys()].filter((cls) => !CLASS_ORDER.includes(cls))

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <option value="">{placeholder}</option>

      {[...orderedClasses, ...remainingClasses].map((cls) => {
        const classAccounts = grouped.get(cls) ?? []
        // Hierarquia: nível 1 como subgrupo, nível 2+ como opções
        const level1 = classAccounts.filter((a) => a.account_code.split('.').length === 1)
        const rest = classAccounts.filter((a) => a.account_code.split('.').length > 1)

        return (
          <optgroup key={cls} label={`── ${CLASS_LABELS[cls] ?? cls} ──`}>
            {classAccounts
              .sort((a, b) => a.account_code.localeCompare(b.account_code))
              .map((account) => {
                const depth = account.account_code.split('.').length - 1
                const indent = '  '.repeat(depth)
                const isCalculated = account.is_calculated
                return (
                  <option
                    key={account.id}
                    value={account.id}
                    disabled={isCalculated}
                    title={isCalculated ? 'Conta calculada — não pode receber lançamentos' : undefined}
                  >
                    {indent}{account.account_code} {account.account_name}{isCalculated ? ' (calc.)' : ''}
                  </option>
                )
              })}
          </optgroup>
        )
      })}
    </select>
  )
}
