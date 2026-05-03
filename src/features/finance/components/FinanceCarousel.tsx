import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export interface CarouselScreen {
  id: string
  title: string
  component: ReactNode
}

interface FinanceCarouselProps {
  screens: CarouselScreen[]
  storageKey?: string
}

export default function FinanceCarousel({
  screens,
  storageKey = 'finance_carousel_screen',
}: FinanceCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const stored = window.localStorage.getItem(storageKey)
    if (stored === null) return 0
    const idx = parseInt(stored, 10)
    if (Number.isNaN(idx) || idx < 0 || idx >= screens.length) return 0
    return idx
  })
  const [direction, setDirection] = useState<1 | -1>(1)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, String(currentIndex))
  }, [currentIndex, storageKey])

  const goPrev = useCallback(() => {
    setDirection(-1)
    setCurrentIndex((i) => (i - 1 + screens.length) % screens.length)
  }, [screens.length])

  const goNext = useCallback(() => {
    setDirection(1)
    setCurrentIndex((i) => (i + 1) % screens.length)
  }, [screens.length])

  const goTo = useCallback(
    (idx: number) => {
      setDirection(idx > currentIndex ? 1 : -1)
      setCurrentIndex(idx)
    },
    [currentIndex]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return
        if (target.isContentEditable) return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext])

  if (screens.length === 0) return null

  const current = screens[currentIndex]

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <button
          onClick={goPrev}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Tela anterior"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-gray-400 uppercase tracking-wider">
            Tela {currentIndex + 1} de {screens.length}
          </span>
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {current.title}
          </h2>
          <div className="flex items-center gap-1.5">
            {screens.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                aria-label={`Ir para ${s.title}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentIndex
                    ? 'w-6 bg-blue-600'
                    : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={goNext}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Proxima tela"
        >
          <span className="hidden sm:inline">Proxima</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={current.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: 'spring', stiffness: 280, damping: 32 }, opacity: { duration: 0.18 } }}
          >
            {current.component}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
