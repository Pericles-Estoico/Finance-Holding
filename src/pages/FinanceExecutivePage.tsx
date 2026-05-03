import { useMemo, useState } from 'react'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { useCompany } from '../contexts/CompanyContext'
import FinanceCarousel from '../features/finance/components/FinanceCarousel'
import type { CarouselScreen } from '../features/finance/components/FinanceCarousel'
import FinanceDashboard from '../features/finance/components/FinanceDashboard'
import DreScreen from '../features/finance/components/DreScreen'
import EbitdaScreen from '../features/finance/components/EbitdaScreen'
import CashFlowScreen from '../features/finance/components/CashFlowScreen'
import InvestorKPIsScreen from '../features/finance/components/InvestorKPIsScreen'
import ExecutiveSummaryScreen from '../features/finance/components/ExecutiveSummaryScreen'
import type { DateRange } from '../features/finance/types/finance.types'

function fmt(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export default function FinanceExecutivePage() {
  const { activeCompanyId } = useCompany()

  const now = new Date()
  const [period, setPeriod] = useState<DateRange>({
    from: fmt(startOfMonth(now)),
    to: fmt(endOfMonth(now)),
  })

  const companyId =
    activeCompanyId === 'consolidated' ? '' : (activeCompanyId as string)

  const screens: CarouselScreen[] = useMemo(
    () => [
      {
        id: 'overview',
        title: 'Dashboard Geral',
        component: (
          <FinanceDashboard
            companyId={companyId}
            startDate={period.from}
            endDate={period.to}
            onPeriodChange={setPeriod}
          />
        ),
      },
      {
        id: 'dre',
        title: 'DRE',
        component: (
          <DreScreen
            companyId={companyId}
            startDate={period.from}
            endDate={period.to}
            onPeriodChange={setPeriod}
          />
        ),
      },
      {
        id: 'ebitda',
        title: 'EBITDA',
        component: (
          <EbitdaScreen
            companyId={companyId}
            startDate={period.from}
            endDate={period.to}
            onPeriodChange={setPeriod}
          />
        ),
      },
      {
        id: 'cashflow',
        title: 'Fluxo de Caixa',
        component: (
          <CashFlowScreen
            companyId={companyId}
            startDate={period.from}
            endDate={period.to}
            onPeriodChange={setPeriod}
          />
        ),
      },
      {
        id: 'investor-kpis',
        title: 'KPIs para Investidores',
        component: (
          <InvestorKPIsScreen
            companyId={companyId}
            startDate={period.from}
            endDate={period.to}
            onPeriodChange={setPeriod}
          />
        ),
      },
      {
        id: 'executive-summary',
        title: 'Executive Summary',
        component: (
          <ExecutiveSummaryScreen
            companyId={companyId}
            startDate={period.from}
            endDate={period.to}
            onPeriodChange={setPeriod}
          />
        ),
      },
    ],
    [companyId, period]
  )

  return (
    <div className="max-w-7xl mx-auto">
      <FinanceCarousel screens={screens} />
    </div>
  )
}
