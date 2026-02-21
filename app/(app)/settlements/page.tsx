import { createClient } from '@/lib/supabase/server'
import styles from './settlements.module.css'

export const revalidate = 0

interface Transfer {
  from: string
  to: string
  amount: number
}

/**
 * Minimises the number of real-money transfers needed to settle all debts.
 * Each person's net position = total_won - total_staked (relative to starting balance).
 * People who lost money owe people who won money.
 */
function calcSettlements(profiles: { username: string; total_won: number; total_staked: number }[]): Transfer[] {
  // Net profit for each person (positive = they won, negative = they lost)
  const balances = profiles.map(p => ({
    name: p.username,
    net: parseFloat((p.total_won - p.total_staked).toFixed(2)),
  })).filter(p => Math.abs(p.net) >= 0.01)

  const creditors = balances.filter(p => p.net > 0).sort((a, b) => b.net - a.net)
  const debtors   = balances.filter(p => p.net < 0).sort((a, b) => a.net - b.net)

  const transfers: Transfer[] = []
  let i = 0, j = 0

  // Clone so we can mutate
  const creds = creditors.map(c => ({ ...c }))
  const debts = debtors.map(d => ({ ...d, net: Math.abs(d.net) }))

  while (i < creds.length && j < debts.length) {
    const amount = parseFloat(Math.min(creds[i].net, debts[j].net).toFixed(2))
    if (amount >= 0.01) {
      transfers.push({ from: debts[j].name, to: creds[i].name, amount })
    }
    creds[i].net -= amount
    debts[j].net -= amount
    if (creds[i].net < 0.01) i++
    if (debts[j].net < 0.01) j++
  }

  return transfers
}

export default async function SettlementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, balance, total_staked, total_won')

  const { data: resolvedMarkets } = await supabase
    .from('markets')
    .select('id, question, emoji, winner_option_idx, total_pool, created_at')
    .eq('status', 'resolved')
    .order('created_at', { ascending: false })
    .limit(10)

  const myUsername = profiles?.find(p => p.id === user?.id)?.username

  const allProfiles = profiles ?? []
  const transfers = calcSettlements(allProfiles)

  const myDebts    = transfers.filter(t => t.from === myUsername)
  const myReceives = transfers.filter(t => t.to   === myUsername)
  const otherDebts = transfers.filter(t => t.from !== myUsername && t.to !== myUsername)

  const myTotalOwed     = myDebts.reduce((s, t) => s + t.amount, 0)
  const myTotalReceives = myReceives.reduce((s, t) => s + t.amount, 0)

  return (
    <div className={styles.wrap}>
      <h1 className={styles.pageTitle}>SETTLEMENTS</h1>
      <p className={styles.pageSubtitle}>
        Who owes who in real money — based on winnings vs losses across all resolved markets
      </p>

      {transfers.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🤝</div>
          <div className={styles.emptyTitle}>All square!</div>
          <p>No debts to settle yet. Resolve some markets first.</p>
        </div>
      ) : (
        <>
          {/* My personal summary */}
          {myUsername && (myDebts.length > 0 || myReceives.length > 0) && (
            <div className={styles.mySection}>
              <div className={styles.sectionLabel}>YOUR SETTLEMENTS</div>

              {myDebts.length > 0 && (
                <div className={styles.myBlock}>
                  <div className={styles.myBlockHeader}>
                    <span className={styles.myBlockIcon}>💸</span>
                    <span className={styles.myBlockTitle}>You owe</span>
                    <span className={`${styles.myBlockTotal} ${styles.red}`}>
                      ${myTotalOwed.toFixed(2)} total
                    </span>
                  </div>
                  {myDebts.map((t, i) => (
                    <div key={i} className={`${styles.transferRow} ${styles.iOwe}`}>
                      <div className={styles.transferAvatar} style={{ background: 'rgba(255,79,79,0.15)', color: 'var(--red)' }}>
                        {t.to[0].toUpperCase()}
                      </div>
                      <div className={styles.transferInfo}>
                        <span className={styles.transferName}>{t.to}</span>
                        <span className={styles.transferDesc}>Pay them back</span>
                      </div>
                      <div className={`${styles.transferAmount} ${styles.red}`}>
                        −${t.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {myReceives.length > 0 && (
                <div className={styles.myBlock}>
                  <div className={styles.myBlockHeader}>
                    <span className={styles.myBlockIcon}>🏦</span>
                    <span className={styles.myBlockTitle}>You receive</span>
                    <span className={`${styles.myBlockTotal} ${styles.green}`}>
                      ${myTotalReceives.toFixed(2)} total
                    </span>
                  </div>
                  {myReceives.map((t, i) => (
                    <div key={i} className={`${styles.transferRow} ${styles.iReceive}`}>
                      <div className={styles.transferAvatar} style={{ background: 'rgba(61,255,160,0.15)', color: 'var(--green)' }}>
                        {t.from[0].toUpperCase()}
                      </div>
                      <div className={styles.transferInfo}>
                        <span className={styles.transferName}>{t.from}</span>
                        <span className={styles.transferDesc}>They owe you</span>
                      </div>
                      <div className={`${styles.transferAmount} ${styles.green}`}>
                        +${t.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Full group settlements */}
          <div className={styles.groupSection}>
            <div className={styles.sectionLabel}>ALL GROUP SETTLEMENTS</div>
            <p className={styles.sectionNote}>
              Minimum transfers to settle everyone — {transfers.length} payment{transfers.length !== 1 ? 's' : ''} needed
            </p>

            <div className={styles.allTransfers}>
              {transfers.map((t, i) => {
                const isMe = t.from === myUsername || t.to === myUsername
                return (
                  <div key={i} className={`${styles.groupRow} ${isMe ? styles.groupRowMe : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className={styles.groupFrom}>
                      <div className={styles.groupAvatar}>{t.from[0].toUpperCase()}</div>
                      <span className={t.from === myUsername ? styles.nameMe : ''}>{t.from}</span>
                    </div>
                    <div className={styles.groupArrow}>
                      <span className={styles.arrowAmount}>${t.amount.toFixed(2)}</span>
                      <span className={styles.arrow}>→</span>
                    </div>
                    <div className={styles.groupTo}>
                      <div className={styles.groupAvatar}>{t.to[0].toUpperCase()}</div>
                      <span className={t.to === myUsername ? styles.nameMe : ''}>{t.to}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Net positions */}
          <div className={styles.groupSection}>
            <div className={styles.sectionLabel}>EVERYONE'S NET POSITION</div>
            <p className={styles.sectionNote}>Total won minus total staked across all markets</p>
            <div className={styles.netGrid}>
              {allProfiles
                .map(p => ({ ...p, net: p.total_won - p.total_staked }))
                .sort((a, b) => b.net - a.net)
                .map((p, i) => (
                  <div key={p.id} className={`${styles.netCard} ${p.id === user?.id ? styles.netCardMe : ''}`}>
                    <div className={styles.netAvatar}>{p.username[0].toUpperCase()}</div>
                    <div className={styles.netName}>{p.username}{p.id === user?.id ? ' 👈' : ''}</div>
                    <div className={`${styles.netAmount} ${p.net >= 0 ? styles.green : styles.red}`}>
                      {p.net >= 0 ? '+' : ''}${p.net.toFixed(2)}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Recent resolved markets */}
          {resolvedMarkets && resolvedMarkets.length > 0 && (
            <div className={styles.groupSection}>
              <div className={styles.sectionLabel}>RECENTLY RESOLVED</div>
              <div className={styles.resolvedList}>
                {resolvedMarkets.map(m => (
                  <div key={m.id} className={styles.resolvedRow}>
                    <span className={styles.resolvedEmoji}>{m.emoji}</span>
                    <span className={styles.resolvedQuestion}>{m.question}</span>
                    <span className={styles.resolvedPool}>${Number(m.total_pool).toFixed(0)} pool</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
