'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import styles from './create.module.css'

export default function CreateGroupPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Enter a group name')
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data, error } = await supabase.rpc('create_group', {
      p_name: name.trim(),
      p_description: description.trim() || null,
      p_user_id: user.id,
    })

    if (error || data?.error) {
      setError(error?.message ?? 'Failed to create group')
      setLoading(false)
      return
    }

    router.push(`/groups/${data.id}`)
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>CREATE A GROUP</h1>
      <p className={styles.subtitle}>
        A private room for your crew. You'll get an invite link to share with your mates.
      </p>

      <form onSubmit={handleCreate} className={styles.form}>
        <div className={styles.formGroup}>
          <label>Group Name</label>
          <input
            type="text"
            placeholder="e.g. Sunday Footy Boys"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={50}
            required
            autoFocus
          />
        </div>

        <div className={styles.formGroup}>
          <label>Description <span className={styles.optional}>(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. NRL tipping comp season 2025"
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={100}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Creating…' : '🚀 Create Group & Get Invite Link'}
        </button>
      </form>
    </div>
  )
}
