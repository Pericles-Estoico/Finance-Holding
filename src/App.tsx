import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CompanyProvider } from './contexts/CompanyContext'
import { SimulationProvider } from './contexts/SimulationContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

const DrePage = lazy(() => import('./pages/DrePage'))
const TransacoesPage = lazy(() => import('./pages/TransacoesPage'))
const ImportarPage = lazy(() => import('./pages/ImportarPage'))
const RelatoriosPage = lazy(() => import('./pages/RelatoriosPage'))
const ConfiguracoesPage = lazy(() => import('./pages/ConfiguracoesPage'))
const FinanceExecutivePage = lazy(() => import('./pages/FinanceExecutivePage'))
const FinancialEntriesPage = lazy(() => import('./pages/FinancialEntriesPage'))
const FluxoCaixaPage = lazy(() => import('./pages/FluxoCaixaPage'))

function ProtectedRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return (
    <CompanyProvider>
      <SimulationProvider>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <AppLayout />
        </Suspense>
      </SimulationProvider>
    </CompanyProvider>
  )
}

function LoginWithRedirect() {
  const { session } = useAuth()
  if (session) return <Navigate to="/" replace />
  return <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginWithRedirect />} />
          <Route element={<ProtectedRoutes />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/finance" element={<FinanceExecutivePage />} />
            <Route path="/lancamentos" element={<FinancialEntriesPage />} />
            <Route path="/fluxo-caixa" element={<FluxoCaixaPage />} />
            <Route path="/dre" element={<DrePage />} />
            <Route path="/transacoes" element={<TransacoesPage />} />
            <Route path="/importar" element={<ImportarPage />} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
