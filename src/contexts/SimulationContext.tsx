import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface SimulationContextValue {
  isSimulation: boolean
  toggleSimulation: () => void
}

const SimulationContext = createContext<SimulationContextValue | null>(null)

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [isSimulation, setIsSimulation] = useState(false)

  return (
    <SimulationContext.Provider value={{ isSimulation, toggleSimulation: () => setIsSimulation((v) => !v) }}>
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulation() {
  const ctx = useContext(SimulationContext)
  if (!ctx) throw new Error('useSimulation deve ser usado dentro de SimulationProvider')
  return ctx
}
