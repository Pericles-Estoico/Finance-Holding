import { Outlet, NavLink } from 'react-router-dom'
import { BarChart3, FileText, List, Upload, Settings, LogOut, FlaskConical, FileDown, LineChart } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useSimulation } from '../../contexts/SimulationContext'

const navItems = [
  { to: '/',             label: 'Dashboard',    icon: BarChart3, end: true },
  { to: '/dre',          label: 'DRE',          icon: FileText },
  { to: '/transacoes',   label: 'Transações',   icon: List },
  { to: '/fluxo-caixa',  label: 'Fluxo de Caixa',icon: LineChart },
  { to: '/importar',     label: 'Importar',     icon: Upload },
  { to: '/relatorios',   label: 'Relatórios',   icon: FileDown },
  { to: '/configuracoes',label: 'Configurações',icon: Settings },
]

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const { companies, activeCompanyId, setActiveCompanyId } = useCompany()
  const { isSimulation, toggleSimulation } = useSimulation()

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 rounded-lg p-1.5">
              <BarChart3 className="text-white w-5 h-5" />
            </div>
            <span className="text-white font-semibold text-sm">Finance Master</span>
          </div>
        </div>

        {/* Seletor de CNPJ */}
        <div className="p-4 border-b border-slate-700">
          <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Empresa</label>
          <select
            value={activeCompanyId}
            onChange={(e) => setActiveCompanyId(e.target.value)}
            className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="consolidated">Visão Consolidada</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <nav className="flex-1 p-4 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-2">
          <button
            onClick={toggleSimulation}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isSimulation
                ? 'bg-amber-500 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            {isSimulation ? 'Simulação ATIVA' : 'Modo Simulação'}
          </button>

          <div className="flex items-center gap-2 px-3">
            {user?.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} className="w-7 h-7 rounded-full" alt="" />
            )}
            <span className="text-slate-400 text-xs truncate flex-1">
              {user?.user_metadata?.full_name ?? user?.email}
            </span>
            <button onClick={signOut} className="text-slate-500 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0">
        {isSimulation && (
          <div className="bg-amber-400 text-amber-900 text-xs font-semibold text-center py-1.5">
            ⚗️ MODO DE SIMULAÇÃO — Os dados exibidos são fictícios e não afetam o banco de produção
          </div>
        )}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
