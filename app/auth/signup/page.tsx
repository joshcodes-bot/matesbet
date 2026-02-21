'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from '../auth.module.css'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (username.length < 3) {
      setError('Username must be at least 3 characters')
      setLoading(false)
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers and underscores')
      setLoading(false)
      return
    }

    // Check username is available
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    if (existing) {
      setError('Username already taken')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/markets')
      router.refresh()
    }
  }

  return (
    <div className={styles.authWrap}>
      <div className={styles.authBg} />
      <div className={styles.authCard}>
        <div className={styles.logo}>Mates<span>Bet</span></div>
        <p className={styles.tagline}>Join your crew. Start betting.</p>

        <form onSubmit={handleSignup} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Username</label>
            <input
              type="text"
              placeholder="BigDave"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              maxLength={30}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>Password</label>
            <input
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className={styles.startingBalance}>
            🎉 You start with <strong>$1,000</strong> in play money
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account →'}
          </button>
        </form>

        <p className={styles.switchLink}>
          Already have an account? <Link href="/auth/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
