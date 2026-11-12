import { useCallback, useEffect, useState } from 'react'
import {
  AuthError,
  type AuthUser,
  getAuthStatus,
  login as requestLogin,
  logout as requestLogout,
  OfflineError,
  setupAccount,
} from './api'

export type GateStatus = 'loading' | 'needs-setup' | 'signed-out' | 'signed-in' | 'error'

async function loadStatus() {
  let lastError: unknown
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await getAuthStatus()
    } catch (error) {
      lastError = error
      if (!(error instanceof OfflineError) || attempt === 39) throw error
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw lastError
}

export function useAuth() {
  const [status, setStatus] = useState<GateStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accountName, setAccountName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const remember = useCallback((next: AuthUser) => {
    setUser(next)
    setAccountName(next.name)
    setError(null)
    setStatus('signed-in')
  }, [])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setError(null)
    void (async () => {
      try {
        const next = await loadStatus()
        if (cancelled) return
        setAccountName(next.user?.name ?? next.name)
        if (next.user) {
          remember(next.user)
          return
        }
        setUser(null)
        setStatus(next.needsSetup ? 'needs-setup' : 'signed-out')
      } catch (loadError) {
        if (cancelled) return
        setUser(null)
        setStatus('error')
        setError(loadError instanceof Error ? loadError.message : 'Could not open the journal')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attempt, remember])

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null)
      setStatus((current) => (current === 'needs-setup' ? current : 'signed-out'))
    }
    window.addEventListener('journal:unauthorized', onUnauthorized)
    return () => window.removeEventListener('journal:unauthorized', onUnauthorized)
  }, [])

  const setup = useCallback(async (name: string, password: string, confirm: string) => {
    setBusy(true)
    setError(null)
    try {
      const next = await setupAccount({ name, password, confirm })
      remember(next.user)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the password')
    } finally {
      setBusy(false)
    }
  }, [remember])

  const login = useCallback(async (password: string) => {
    setBusy(true)
    setError(null)
    try {
      const next = await requestLogin(password)
      remember(next.user)
    } catch (saveError) {
      setError(saveError instanceof AuthError || saveError instanceof Error
        ? saveError.message
        : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }, [remember])

  const signOut = useCallback(async () => {
    setBusy(true)
    try {
      await requestLogout()
    } catch {
      // Still lock the screen if the cookie cannot be cleared remotely.
    } finally {
      setUser(null)
      setError(null)
      setStatus('signed-out')
      setBusy(false)
    }
  }, [])

  return {
    status,
    user,
    accountName,
    error,
    busy,
    setup,
    login,
    signOut,
    reload: () => setAttempt((value) => value + 1),
  }
}
