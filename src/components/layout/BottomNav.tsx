import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Home, CreditCard, Camera, BarChart2, Menu, FileDown, Settings, LogOut, FlaskConical, ChevronRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useSimulation } from '../../contexts/SimulationContext'
import BottomSheet from '../ui/BottomSheet'

const primaryTabs = [
  { to: '/',           label: 'Início',       icon: Home,       end: true },
  { to: '/transacoes', label: 'Lançamentos',  icon: CreditCard },
  { to: '/importar',   label: 'Importar',     icon: Camera },
  { to: '/dre',        label: 'DRE',          icon: BarChart2 },
]

const menuItems = [
  { to: '/fluxo-caixa',   label: 'Fluxo de Caixa',  icon: BarChart2 },
  { to: '/relatorios',    label: 'Relatórios',       icon: FileDown },
  { to: '/configuracoes', label: 'Configurações',    icon: Settings },
]

export default function BottomNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, signOut } = useAuth()
  const { companies, activeCompanyId, setActiveCompanyId } = useCompany()
  const { isSimulation, toggleSimulation } = useSimulation()
  const navigate = useNavigate()

  function handleMenuNav(to: string) {
    setMenuOpen(false)
    navigate(to)
  }

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900 border-t border-slate-800 lg:hidden">
        <div className="flex items-stretch h-16 px-1">
          {primaryTabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Menu tab */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold text-slate-500"
          >
            <Menu className="w-5 h-5" />
            <span>Menu</span>
          </button>
        </div>
        {/* iOS safe area */}
        <div className="h-safe-area-inset-bottom bg-slate-900" />
      </nav>

      {/* Menu Bottom Sheet */}
      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        {/* Seletor de empresa */}
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Empresa</p>
          <select
            value={activeCompanyId}
            onChange={(e) => setActiveCompanyId(e.target.value)}
            className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="consolidated">Visão Consolidada</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Itens do menu */}
        <div className="py-2">
          {menuItems.map(({ to, label, icon: Icon }) => (
            <button
              key={to}
              onClick={() => handleMenuNav(to)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <Icon className="w-4 h-4 text-slate-500" />
              <span className="flex-1 text-left">{label}</span>
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </button>
          ))}
        </div>

        <div className="border-t border-slate-800 py-2">
          {/* Simulação */}
          <button
            onClick={toggleSimulation}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm transition-colors ${
              isSimulation ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            <span className="flex-1 text-left">{isSimulation ? 'Simulação ATIVA — Desativar' : 'Modo Simulação'}</span>
          </button>

          {/* Usuário + logout */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-7 h-7 rounded-full" alt="" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-400">
                {(user?.email ?? '?')[0].toUpperCase()}
              </div>
            )}
            <span className="text-slate-400 text-xs truncate flex-1">
              {user?.user_metadata?.full_name ?? user?.email}
            </span>
            <button
              onClick={() => { setMenuOpen(false); signOut() }}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
