import { useState } from 'react'
import { BarChart3, Mail, Lock, Send } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'login' | 'register' | 'magic'

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail, sendMagicLink } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (mode === 'magic') {
      const { error } = await sendMagicLink(email)
      if (error) setError(error)
      else setSuccess('Link enviado! Verifique seu e-mail.')
    } else if (mode === 'register') {
      const { error } = await signUpWithEmail(email, password)
      if (error) setError(error)
      else setSuccess('Conta criada! Verifique seu e-mail para confirmar.')
    } else {
      const { error } = await signInWithEmail(email, password)
      if (error) setError(error)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-900 rounded-xl p-3 mb-4">
            <BarChart3 className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Finance Master</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">
            Análise financeira para manufatura e varejo
          </p>
        </div>

        {/* Abas */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          {(['login', 'register', 'magic'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null) }}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m === 'login' ? 'Entrar' : m === 'register' ? 'Cadastrar' : 'Magic Link'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {mode !== 'magic' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="password"
                required
                placeholder="Senha (mín. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {error && (
            <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-green-700 text-xs bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : mode === 'magic' ? (
              <><Send className="w-4 h-4" /> Enviar link</>
            ) : mode === 'register' ? (
              'Criar conta'
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Dados financeiros protegidos com Row Level Security.
        </p>
      </div>
    </div>
  )
}
