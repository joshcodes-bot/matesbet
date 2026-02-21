import { createClient } from '@/lib/supabase/server'
import styles from './leaderboard.module.css'

export const revalidate = 0

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, balance, total_staked, total_won')
    .order('balance', { ascending: false })

  const { data: betCounts } = await supabase
    .from('bets')
    .select('user_id')

  const countMap: Record<string, number> = {}
  betCounts?.forEach(b => { countMap[b.user_id] = (countMap[b.user_id] ?? 0) + 1 })

  const ranked = (profiles ?? []).map(p => ({
    ...p,
    profit: p.total_won - p.total_staked,
    bets: countMap[p.id] ?? 0,
  })).sort((a, b) => b.profit - a.profit)

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>LEADERBOARD</h1>
      <p className={styles.pageSubtitle}>Ranked by total profit</p>

      {ranked.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🏆</div>
          <div className={styles.emptyTitle}>No players yet</div>
        </div>
      ) : (
        <div className={styles.list}>
          {ranked.map((p, i) => {
            const isMe = p.id === user?.id
            return (
              <div
                key={p.id}
                className={`${styles.row} ${isMe ? styles.isMe : ''}`}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className={`${styles.rank} ${i < 3 ? styles.rankTop : ''}`}>
                  {medals[i] ?? i + 1}
                </div>
                <div className={styles.info}>
                  <div className={styles.name}>
                    {p.username}
                    {isMe && <span className={styles.youBadge}>YOU</span>}
                  </div>
                  <div className={styles.meta}>
                    {p.bets} bet{p.bets !== 1 ? 's' : ''} · Balance ${p.balance.toFixed(0)}
                  </div>
                </div>
                <div className={styles.right}>
                  <div className={`${styles.profit} ${p.profit >= 0 ? styles.profitPos : styles.profitNeg}`}>
                    {p.profit >= 0 ? '+' : ''}${p.profit.toFixed(2)}
                  </div>
                  <div className={styles.profitLabel}>P&L</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
