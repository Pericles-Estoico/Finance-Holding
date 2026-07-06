import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import type { ChartAccount } from '../types/finance.types'

interface Props {
  accounts: ChartAccount[]
  value: string
  onChange: (id: string) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
}

export default function AccountCombobox({ accounts, value, onChange, required, disabled, placeholder = 'Selecione uma conta...' }: Props) {
  const [open, setOpen]            = useState(false)
  const [search, setSearch]        = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef    = useRef<HTMLInputElement>(null)
  const listRef     = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = accounts.find((a) => a.id === value)

  const filtered = search.trim()
    ? accounts.filter((a) => {
        const q = search.toLowerCase()
        return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
      })
    : accounts

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focar input ao abrir
  useEffect(() => {
    if (open) {
      setSearch('')
      setHighlighted(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Scroll para item destacado
  useEffect(() => {
    const el = listRef.current?.children[highlighted] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  function select(id: string) {
    onChange(id)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); if (filtered[highlighted]) select(filtered[highlighted].id) }
    if (e.key === 'Escape')    { setOpen(false) }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : open ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? `${selected.code} — ${selected.name}` : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Input nativo oculto para validação required */}
      {required && (
        <input
          tabIndex={-1}
          required
          value={value}
          onChange={() => {}}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
        />
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
          {/* Barra de busca */}
          <div className="p-2 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setHighlighted(0) }}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
                placeholder="Buscar por código ou nome..."
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setHighlighted(0); inputRef.current?.focus() }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1 px-1">
              {filtered.length} {filtered.length === 1 ? 'conta' : 'contas'} · ↑↓ navegar · Enter selecionar
            </p>
          </div>

          {/* Lista */}
          <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-4 text-sm text-gray-400 text-center">
                Nenhuma conta encontrada para "<span className="font-medium">{search}</span>"
              </li>
            ) : (
              filtered.map((a, i) => (
                <li
                  key={a.id}
                  onMouseDown={() => select(a.id)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 text-sm transition-colors ${
                    i === highlighted ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`font-mono text-xs w-9 flex-shrink-0 ${i === highlighted ? 'text-blue-500' : 'text-gray-400'}`}>
                    {a.code}
                  </span>
                  <span className={`truncate ${value === a.id ? 'font-semibold text-blue-700' : i === highlighted ? 'text-blue-800' : 'text-gray-700'}`}>
                    {a.name}
                  </span>
                  {value === a.id && (
                    <span className="ml-auto text-blue-600 text-xs">✓</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
