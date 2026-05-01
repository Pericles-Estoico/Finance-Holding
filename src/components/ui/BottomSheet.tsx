import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  snapPoints?: 'half' | 'full'
}

export default function BottomSheet({ open, onClose, title, children, snapPoints = 'half' }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const maxH = snapPoints === 'full' ? 'max-h-[92vh]' : 'max-h-[70vh]'

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`fixed bottom-0 left-0 right-0 z-50 bg-slate-900 rounded-t-2xl ${maxH} flex flex-col lg:hidden`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-700" />
            </div>
            {title && (
              <div className="px-5 py-3 border-b border-slate-800">
                <h2 className="text-sm font-semibold text-white">{title}</h2>
              </div>
            )}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
