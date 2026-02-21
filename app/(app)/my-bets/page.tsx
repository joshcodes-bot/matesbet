import { createClient } from '@/lib/supabase/server'
import styles from './mybets.module.css'

export const revalidate = 0

export default async function MyBetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: bets } = await supabase
    .from('bets')
    .select('*, markets(question, emoji, market_options(*))')
    .eq('user_id', user!.id)
    .order('placed_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('balance, total_staked, total_won')
    .eq('id', user!.id)
    .single()

  const profit = profile ? (profile.total_won - profile.total_staked) : 0
  const pendingCount = bets?.filter(b => b.status === 'pending').length ?? 0
  const wonCount = bets?.filter(b => b.status === 'won').length ?? 0

  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>MY BETS</h1>

      {profile && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Balance</div>
            <div className={styles.statValue} style={{ color: 'var(--green)' }}>${profile.balance.toFixed(2)}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Staked</div>
            <div className={styles.statValue}>${profile.total_staked.toFixed(2)}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>P&L</div>
            <div className={styles.statValue} style={{ color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending</div>
            <div className={styles.statValue} style={{ color: 'var(--accent)' }}>{pendingCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Won</div>
            <div className={styles.statValue} style={{ color: 'var(--accent2)' }}>{wonCount}</div>
          </div>
        </div>
      )}

      {!bets || bets.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎟</div>
          <div className={styles.emptyTitle}>No bets yet</div>
          <p>Head to Markets and place your first bet!</p>
        </div>
      ) : (
        <div className={styles.list}>
          {bets.map((bet, i) => {
            const market = bet.markets as any
            const option = market?.market_options?.find((o: any) => o.option_idx === bet.option_idx)
            const statusIcon = bet.status === 'won' ? '✅' : bet.status === 'lost' ? '❌' : '⏳'
            const payoutDisplay = bet.status === 'won'
              ? `+$${Number(bet.payout).toFixed(2)}`
              : bet.status === 'lost'
              ? `-$${Number(bet.stake).toFixed(2)}`
              : `~$${(Number(bet.stake) * 1.5).toFixed(2)}`

            return (
              <div key={bet.id} className={styles.betRow} style={{ animationDelay: `${i * 0.04}s` }}>
                <div className={`${styles.betIcon} ${styles[`icon_${bet.status}`]}`}>{statusIcon}</div>
                <div className={styles.betInfo}>
                  <div className={styles.betMarket}>{market?.emoji} {market?.question}</div>
                  <div className={styles.betOption}>{option?.label ?? `Option ${bet.option_idx + 1}`}</div>
                  <div className={styles.betMeta}>{new Date(bet.placed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
                <div className={styles.betAmounts}>
                  <div className={styles.betStake}>Stake: ${Number(bet.stake).toFixed(2)}</div>
                  <div className={`${styles.betPayout} ${styles[`payout_${bet.status}`]}`}>{payoutDisplay}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
