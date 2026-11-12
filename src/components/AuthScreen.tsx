import { type FormEvent, useEffect, useState } from 'react'
import type { useAuth } from '../auth'
import { journalTitle } from '../constants'

type Auth = ReturnType<typeof useAuth>

export function AuthScreen({ auth }: { auth: Auth }) {
  const setup = auth.status === 'needs-setup'
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const title = journalTitle(setup ? name : auth.accountName)

  useEffect(() => {
    document.title = title
  }, [title])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (auth.busy) return
    if (setup) {
      void auth.setup(name, password, confirm)
      return
    }
    void auth.login(password)
  }

  return (
    <div className="app locked">
      <header className="topbar">
        <div className="brand">
          <div className="mark">
            <img src="/favicon.png" alt="" width="46" height="46" />
          </div>
          <div>
            <h1>{title}</h1>
            <p>Family password lock</p>
          </div>
        </div>
      </header>

      <form className="auth-card" onSubmit={onSubmit}>
        <h2>{setup ? 'Set a password' : 'Sign in'}</h2>
        <p>
          {setup
            ? 'Pick a password so only your family can open this journal. It stays on this computer.'
            : 'Enter the family password to open the journal.'}
        </p>

        {setup && (
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Whose journal is this?"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
        )}

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete={setup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>

        {setup && (
          <label className="field">
            <span>Confirm password</span>
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              minLength={6}
              required
            />
          </label>
        )}

        {auth.error && <p className="alert">{auth.error}</p>}

        <div className="actions">
          <button className="primary" type="submit" disabled={auth.busy}>
            {auth.busy ? 'Please wait…' : setup ? 'Save password' : 'Open journal'}
          </button>
        </div>
      </form>
    </div>
  )
}
