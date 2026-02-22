'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './create.module.css'

const CATEGORIES = [
  { value: '⚽', label: '⚽ Sport' },
  { value: '🎮', label: '🎮 Gaming' },
  { value: '🎲', label: '🎲 General' },
  { value: '🏁', label: '🏁 Race' },
  { value: '🃏', label: '🃏 Cards / Games' },
  { value: '🌤', label: '🌤 Weather / Events' },
  { value: '💰', label: '💰 Finance / Stocks' },
  { value: '🍺', label: '🍺 Social' },
]

export default function CreatePage() {
  const [question, setQuestion] = useState('')
  const [emoji, setEmoji] = useState('⚽')
  const [closesAt, setClosesAt] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    async function loadGroups() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name)')
        .eq('user_id', user.id)
      const g = data?.map((m: any) => m.groups).filter(Boolean) ?? []
      setGroups(g)
      const preselect = searchParams.get('group')
      if (preselect) setSelectedGroup(preselect)
    }
    loadGroups()
  }, [])

  function addOption() {
    if (options.length >= 8) return
    setOptions([...options, ''])
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return
    setOptions(options.filter((_, i) => i !== idx))
  }

  function updateOption(idx: number, val: string) {
    const next = [...options]
    next[idx] = val
    setOptions(next)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validOptions = options.filter(o => o.trim())
    if (!question.trim()) return setError('Enter a question')
    if (validOptions.length < 2) return setError('Add at least 2 outcomes')

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    // Create market
    const { data: market, error: mErr } = await supabase
      .from('markets')
      .insert({
        question: question.trim(),
        emoji,
        created_by: user.id,
        created_by_username: profile?.username ?? 'Unknown',
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        group_id: selectedGroup || null,
      })
      .select()
      .single()

    if (mErr || !market) {
      setError(mErr?.message ?? 'Failed to create market')
      setLoading(false)
      return
    }

    // Create options
    const optionRows = validOptions.map((label, idx) => ({
      market_id: market.id,
      option_idx: idx,
      label: label.trim(),
    }))

    const { error: oErr } = await supabase.from('market_options').insert(optionRows)

    if (oErr) {
      setError(oErr.message)
      setLoading(false)
      return
    }

    router.push(selectedGroup ? `/groups/${selectedGroup}` : '/markets')
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>CREATE A MARKET</h1>
      <p className={styles.pageSubtitle}>Set up a bet for your mates. Odds are calculated live from the betting pool.</p>

      <form onSubmit={handleCreate} className={styles.form}>
        <div className={styles.formGroup}>
          <label>Post to Group <span className={styles.optional}>(optional — leave blank for public)</span></label>
          <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
            <option value="">🌐 Public (visible to everyone)</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>👥 {g.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Market Question</label>
          <input
            type="text"
            placeholder="e.g. Who wins the footy this Saturday?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            maxLength={140}
            required
            autoFocus
          />
        </div>

        <div className={styles.formGroup}>
          <label>Category</label>
          <select value={emoji} onChange={e => setEmoji(e.target.value)}>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Outcomes (min 2, max 8)</label>
          <div className={styles.optionsBuilder}>
            {options.map((opt, i) => (
              <div key={i} className={styles.optionInputRow}>
                <span className={styles.optionNum}>{i + 1}</span>
                <input
                  type="text"
                  placeholder={`Outcome ${i + 1}`}
                  value={opt}
                  onChange={e => updateOption(i, e.target.value)}
                  maxLength={80}
                />
                {options.length > 2 && (
                  <button type="button" className={styles.removeBtn} onClick={() => removeOption(i)}>×</button>
                )}
              </div>
            ))}
          </div>
          {options.length < 8 && (
            <button type="button" className={styles.addBtn} onClick={addOption}>
              + Add Outcome
            </button>
          )}
        </div>

        <div className={styles.formGroup}>
          <label>Betting Closes At (optional)</label>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={e => setClosesAt(e.target.value)}
          />
          <span className={styles.hint}>Leave blank to close manually</span>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.btnSubmit} disabled={loading}>
          {loading ? 'Creating…' : '🚀 Create Market'}
        </button>
      </form>
    </div>
  )
}
