import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, FileText, List, Upload, Settings,
  LogOut, FlaskConical, FileDown, Menu, X, TrendingUp,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useSimulation } from '../../contexts/SimulationContext'

const navItems = [
  { to: '/',              label: 'Dashboard',     icon: BarChart3,  end: true },
  { to: '/dre',           label: 'DRE',           icon: FileText },
  { to: '/transacoes',    label: 'Transações',    icon: List },
  { to: '/importar',      label: 'Importar',      icon: Upload },
  { to: '/fluxo-caixa',   label: 'Fluxo de Caixa', icon: TrendingUp },
  { to: '/relatorios',    label: 'Relatórios',    icon: FileDown },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

function NavContent({ onClose }: { onClose?: () => void }) {
  const { user, signOut } = useAuth()
  const { companies, activeCompanyId, setActiveCompanyId } = useCompany()
  const { isSimulation, toggleSimulation } = useSimulation()

  return (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 rounded-lg p-1.5">
            <BarChart3 className="text-white w-5 h-5" />
          </div>
          <span className="text-white font-semibold text-sm">Finance DRE</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Seletor de empresa */}
      <div className="p-4 border-b border-slate-700">
        <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Empresa</label>
        <select
          value={activeCompanyId}
          onChange={(e) => setActiveCompanyId(e.target.value)}
          className="w-full bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="consolidated">Visão Consolidada</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Navegação */}
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-sm font-medium transition-colors ${
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

      {/* Rodapé do drawer */}
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
          <button onClick={signOut} className="text-slate-500 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  )
}

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { isSimulation } = useSimulation()

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* ── Sidebar fixa (desktop ≥1024px) ── */}
      <aside className="hidden lg:flex w-64 bg-slate-900 flex-col flex-shrink-0">
        <NavContent />
      </aside>

      {/* ── Drawer mobile (overlay slide-in) ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Overlay escuro */}
            <motion.div
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            {/* Drawer lateral */}
            <motion.aside
              className="fixed top-0 left-0 bottom-0 w-72 bg-slate-900 z-50 flex flex-col lg:hidden shadow-2xl"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <NavContent onClose={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Conteúdo principal ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {isSimulation && (
          <div className="bg-amber-400 text-amber-900 text-xs font-semibold text-center py-1.5">
            ⚗️ MODO SIMULAÇÃO — Dados fictícios, não afetam produção
          </div>
        )}

        {/* Top bar mobile com botão hambúrguer */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-slate-400 hover:text-white transition-colors p-1"
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-blue-500 rounded-lg p-1">
              <BarChart3 className="text-white w-4 h-4" />
            </div>
            <span className="text-white font-semibold text-sm">Finance DRE</span>
          </div>
          {isSimulation && (
            <span className="ml-auto text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              SIMULAÇÃO
            </span>
          )}
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
