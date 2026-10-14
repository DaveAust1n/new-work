import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LockKeyhole, Truck } from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import './auth-gate.css'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setMessage('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        setMessage(data.session ? 'Account created. You are signed in on this device.' : 'Account created. Check your email to confirm it, then sign in on both devices.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not authenticate. Please try again.')
    } finally { setBusy(false) }
  }

  if (checking) return <div className="auth-loading">Connecting to WareTrack…</div>
  if (!supabaseConfigured || !supabase) return <div className="auth-page"><div className="auth-card"><div className="auth-brand"><span><Truck size={22} /></span><div><strong>WareTrack</strong><small>LIVE DEVICE CONNECTION</small></div></div><h1>Backend setup needed</h1><p>Supabase is ready, but this deployment needs its public project URL and publishable key in Vercel environment variables.</p></div></div>
  if (session) return <>{children}</>

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span><Truck size={22} /></span><div><strong>WareTrack</strong><small>LIVE DEVICE CONNECTION</small></div></div>
    <div className="auth-lock"><LockKeyhole size={18} /> PRIVATE TRACKING WORKSPACE</div>
    <h1>{mode === 'signin' ? 'Sign in to WareTrack' : 'Create your account'}</h1>
    <p>Use the same account on your computer and phone so only your workspace can access its GPS updates.</p>
    <form onSubmit={submit}>
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></label>
      <button disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
    </form>
    {message && <div className="auth-message" role="status">{message}</div>}
    <div className="auth-switch">{mode === 'signin' ? 'New to WareTrack?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></div>
    <div className="auth-privacy">GPS is only read after you start tracking and grant browser permission. Sign in with the same account on both devices.</div>
  </section></main>
}
