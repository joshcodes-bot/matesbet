'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import styles from './join.module.css'

export default function JoinPage({ params }: { params: { code: string } }) {
  const [status, setStatus] = useState<'loading' | 'joining' | 'success' | 'error' | 'login'>('loading')
  const [groupName, setGroupName] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function tryJoin() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setStatus('login')
        return
      }

      setStatus('joining')

      const { data, error } = await supabase.rpc('join_group_by_code', {
        p_invite_code: params.code,
        p_user_id: user.id,
      })

      if (error || data?.error) {
        setError(data?.error ?? error?.message ?? 'Something went wrong')
        setStatus('error')
        return
      }

      setGroupName(data.name ?? 'the group')
      setStatus('success')

      setTimeout(() => {
        router.push(`/groups/${data.group_id}`)
      }, 1500)
    }

    tryJoin()
  }, [])

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>Mates<span>Bet</span></div>

        {status === 'loading' && (
          <>
            <div className={styles.icon}>🔗</div>
            <div className={styles.title}>Checking invite…</div>
          </>
        )}

        {status === 'joining' && (
          <>
            <div className={styles.icon}>⏳</div>
            <div className={styles.title}>Joining group…</div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className={styles.icon}>🎉</div>
            <div className={styles.title}>You're in!</div>
            <p className={styles.desc}>
              Welcome to <strong>{groupName}</strong> — redirecting you now…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className={styles.icon}>❌</div>
            <div className={styles.title}>Invalid invite</div>
            <p className={styles.desc}>{error || 'This invite link is invalid or has expired.'}</p>
            <button className={styles.btn} onClick={() => router.push('/markets')}>
              Go to Markets
            </button>
          </>
        )}

        {status === 'login' && (
          <>
            <div className={styles.icon}>🔐</div>
            <div className={styles.title}>Sign in to join</div>
            <p className={styles.desc}>
              You need an account to join this group. It's free and takes 30 seconds.
            </p>
            <button
              className={styles.btn}
              onClick={() => router.push(`/auth/signup?redirect=/join/${params.code}`)}
            >
              Create Account →
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => router.push(`/auth/login?redirect=/join/${params.code}`)}
            >
              Already have an account? Sign in
            </button>
          </>
        )}
      </div>
    </div>
  )
}
