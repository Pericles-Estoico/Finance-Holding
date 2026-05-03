import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, FileText, List, Upload, Settings,
  LogOut, FlaskConical, FileDown, Menu, X, TrendingUp,
  LayoutDashboard, Receipt,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useSimulation } from '../../contexts/SimulationContext'

const navItems = [
  { to: '/',              label: 'Dashboard',         icon: BarChart3,       end: true },
  { to: '/finance',       label: 'Finance Executivo', icon: LayoutDashboard },
  { to: '/lancamentos',   label: 'Lancamentos',       icon: Receipt },
  { to: '/dre',           label: 'DRE',               icon: FileText },
  { to: '/transacoes',    label: 'Transacoes',        icon: List },
  { to: '/importar',      label: 'Importar',          icon: Upload },
  { to: '/fluxo-caixa',   label: 'Fluxo de Caixa',    icon: TrendingUp },
  { to: '/relatorios',    label: 'Relatorios',        icon: FileDown },
  { to: '/configuracoes', label: 'Configuracoes',     icon: Settings },
]

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  )
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isDesktop
}

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
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
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
          <option value="consolidated">Visao Consolidada</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Navegacao */}
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
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

      {/* Rodape */}
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
          {isSimulation ? 'Simulacao ATIVA' : 'Modo Simulacao'}
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
  const isDesktop = useIsDesktop()

  // fecha drawer ao mudar para desktop
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false)
  }, [isDesktop])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9FAFB' }}>

      {/* Sidebar — somente desktop */}
      {isDesktop && (
        <aside style={{ width: 256, background: '#0F172A', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <NavContent />
        </aside>
      )}

      {/* Drawer mobile — overlay slide-in */}
      <AnimatePresence>
        {!isDesktop && drawerOpen && (
          <>
            <motion.div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              style={{
                position: 'fixed', top: 0, left: 0, bottom: 0,
                width: 288, background: '#0F172A', zIndex: 50,
                display: 'flex', flexDirection: 'column',
                boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
              }}
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

      {/* Conteudo principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {isSimulation && (
          <div style={{ background: '#FCD34D', color: '#78350F', fontSize: 12, fontWeight: 600, textAlign: 'center', padding: '6px 0' }}>
            MODO SIMULACAO — Dados ficticios, nao afetam producao
          </div>
        )}

        {/* Top bar mobile com hamburguer */}
        {!isDesktop && (
          <header style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '0 16px', height: 56,
            background: '#0F172A', borderBottom: '1px solid #1E293B',
            position: 'sticky', top: 0, zIndex: 30,
          }}>
            <button
              onClick={() => setDrawerOpen(true)}
              style={{ color: '#94A3B8', padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}
              aria-label="Abrir menu"
            >
              <Menu style={{ width: 24, height: 24 }} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: '#3B82F6', borderRadius: 8, padding: 4, display: 'flex' }}>
                <BarChart3 style={{ color: 'white', width: 16, height: 16 }} />
              </div>
              <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Finance DRE</span>
            </div>
            {isSimulation && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#FCD34D', background: 'rgba(252,211,77,0.1)', padding: '2px 8px', borderRadius: 999 }}>
                SIMULACAO
              </span>
            )}
          </header>
        )}

        <main style={{ flex: 1, overflow: 'auto', padding: isDesktop ? 24 : 16 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
