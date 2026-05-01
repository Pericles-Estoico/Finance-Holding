import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CompanyProvider } from './contexts/CompanyContext'
import { SimulationProvider } from './contexts/SimulationContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DrePage from './pages/DrePage'
import TransacoesPage from './pages/TransacoesPage'
import FluxoCaixaPage from './pages/FluxoCaixaPage'
import ImportarPage from './pages/ImportarPage'
import RelatoriosPage from './pages/RelatoriosPage'
import ConfiguracoesPage from './pages/ConfiguracoesPage'

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
        <AppLayout />
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
            <Route path="/dre" element={<DrePage />} />
            <Route path="/transacoes" element={<TransacoesPage />} />
            <Route path="/fluxo-caixa" element={<FluxoCaixaPage />} />
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
