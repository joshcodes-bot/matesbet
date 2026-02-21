'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Market, Profile } from '@/lib/types'
import { calcOdds, calcEstimatedPayout } from '@/lib/types'
import styles from './markets.module.css'

interface Props {
  markets: Market[]
  profile: Profile | null
  userId: string
}

export default function MarketsClient({ markets: initial, profile, userId }: Props) {
  const [markets, setMarkets] = useState<Market[]>(initial)
  const [betModal, setBetModal] = useState<{ market: Market; optionIdx: number } | null>(null)
  const [betAmount, setBetAmount] = useState('')
  const [betLoading, setBetLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [userProfile, setUserProfile] = useState(profile)
  const router = useRouter()
  const supabase = createClient()

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('markets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, () => {
        router.refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_options' }, () => {
        router.refresh()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Keep local markets in sync with server refreshes
  useEffect(() => { setMarkets(initial) }, [initial])
  useEffect(() => { setUserProfile(profile) }, [profile])

  function showToast(msg: string, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleBet() {
    if (!betModal) return
    const stake = parseFloat(betAmount)
    if (!stake || stake <= 0) return showToast('Enter a valid stake', 'error')
    if (userProfile && userProfile.balance < stake) {
      return showToast(`Not enough balance — you have $${userProfile.balance.toFixed(2)}`, 'error')
    }

    setBetLoading(true)
    const { data, error } = await supabase.rpc('place_bet', {
      p_market_id: betModal.market.id,
      p_option_idx: betModal.optionIdx,
      p_user_id: userId,
      p_username: userProfile?.username ?? 'Unknown',
      p_stake: stake,
    })

    setBetLoading(false)

    if (error || data?.error) {
      showToast(data?.error ?? error?.message ?? 'Something went wrong', 'error')
    } else {
      setBetModal(null)
      setBetAmount('')
      showToast(`Bet placed! $${stake} on "${betModal.market.market_options?.find(o => o.option_idx === betModal.optionIdx)?.label}" 🎟`, 'success')
      router.refresh()
    }
  }

  async function handleClose(marketId: string) {
    await supabase.from('markets').update({ status: 'closed' }).eq('id', marketId)
    showToast('Betting closed. Now pick the winner!', 'info')
    router.refresh()
  }

  async function handleResolve(marketId: string, winnerIdx: number) {
    const { data, error } = await supabase.rpc('resolve_market', {
      p_market_id: marketId,
      p_winner_option_idx: winnerIdx,
      p_requesting_user: userId,
    })
    if (error || data?.error) {
      showToast(data?.error ?? 'Failed to resolve', 'error')
    } else {
      showToast('Market resolved! Winners paid out 🏆', 'success')
      router.refresh()
    }
  }

  const openBet = (market: Market, optionIdx: number) => {
    if (market.status !== 'open') return
    setBetModal({ market, optionIdx })
    setBetAmount('')
  }

  const estimatedPayout = betModal && betAmount
    ? calcEstimatedPayout(betModal.market, betModal.optionIdx, parseFloat(betAmount) || 0)
    : 0

  const betOption = betModal?.market.market_options?.find(o => o.option_idx === betModal.optionIdx)

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>MARKETS</h1>
          <p className={styles.pageSubtitle}>Live odds update as bets come in</p>
        </div>
        {userProfile && (
          <div className={styles.balancePill}>
            Balance: <strong>${userProfile.balance.toFixed(2)}</strong>
          </div>
        )}
      </div>

      {markets.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎯</div>
          <div className={styles.emptyTitle}>No Markets Yet</div>
          <p>Create the first one and get your mates betting!</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {markets.map((market, mi) => {
            const odds = calcOdds(market)
            const isCreator = market.created_by === userId
            const options = [...(market.market_options ?? [])].sort((a, b) => a.option_idx - b.option_idx)

            return (
              <div key={market.id} className={styles.card} style={{ animationDelay: `${mi * 0.06}s` }}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardEmoji}>{market.emoji}</div>
                    <div className={styles.cardTitle}>{market.question}</div>
                  </div>
                  <div className={`${styles.status} ${styles[`status_${market.winner_option_idx !== null ? 'resolved' : market.status}`]}`}>
                    {market.winner_option_idx !== null ? 'RESOLVED' : market.status.toUpperCase()}
                  </div>
                </div>

                <div className={styles.cardMeta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Pool</span>
                    <span className={styles.metaValue}>${market.total_pool.toFixed(0)}</span>
                  </div>
                  {market.closes_at && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Closes</span>
                      <span className={styles.metaValue}>{new Date(market.closes_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>By</span>
                    <span className={`${styles.metaValue} ${styles.metaCreator}`}>{market.created_by_username}</span>
                  </div>
                </div>

                <div className={styles.options}>
                  {options.map((opt, i) => {
                    const o = odds[opt.option_idx] ?? { oddsDisplay: '—', pct: 0 }
                    const isWinner = market.winner_option_idx === opt.option_idx
                    const barColors = ['var(--accent)', 'var(--accent2)', '#a78bfa', '#fb923c', '#f472b6']
                    const barColor = isWinner ? 'var(--green)' : barColors[i % barColors.length]

                    return (
                      <div
                        key={opt.id}
                        className={`${styles.optionRow} ${market.status === 'open' ? styles.clickable : ''} ${isWinner ? styles.winner : ''}`}
                        onClick={() => market.status === 'open' && openBet(market, opt.option_idx)}
                      >
                        <div className={styles.optionMain}>
                          <span className={styles.optionLabel}>{opt.label}{isWinner ? ' 🏆' : ''}</span>
                          <span className={styles.optionOdds}>{o.oddsDisplay}</span>
                        </div>
                        <div className={styles.optionBar}>
                          <div className={styles.optionBarTrack}>
                            <div className={styles.optionBarFill} style={{ width: `${o.pct}%`, background: barColor }} />
                          </div>
                          <span className={styles.optionPct}>{o.pct}%</span>
                          <span className={styles.optionPool}>${opt.pool.toFixed(0)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Creator controls */}
                {isCreator && market.status === 'open' && (
                  <div className={styles.creatorBar}>
                    <button className={styles.btnClose} onClick={() => handleClose(market.id)}>
                      🔒 Close Betting
                    </button>
                  </div>
                )}

                {isCreator && market.status === 'closed' && market.winner_option_idx === null && (
                  <div className={styles.resolveBar}>
                    <div className={styles.resolveLabel}>Pick the winner:</div>
                    <div className={styles.resolveBtns}>
                      {options.map(opt => (
                        <button
                          key={opt.id}
                          className={styles.resolveBtn}
                          onClick={() => handleResolve(market.id, opt.option_idx)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Bet Modal */}
      {betModal && (
        <div className={styles.modalBackdrop} onClick={() => setBetModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>PLACE BET</div>
              <button className={styles.modalClose} onClick={() => setBetModal(null)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalMarket}>{betModal.market.question}</div>
              <div className={styles.modalOption}>{betOption?.label}</div>

              <div className={styles.formGroup}>
                <label>Stake Amount ($)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value)}
                  autoFocus
                />
                <div className={styles.presets}>
                  {[5, 10, 25, 50, 100].map(n => (
                    <button key={n} className={styles.presetBtn} onClick={() => setBetAmount(String(n))}>
                      ${n}
                    </button>
                  ))}
                </div>
              </div>

              {betAmount && parseFloat(betAmount) > 0 && (
                <div className={styles.betSummary}>
                  <div className={styles.summaryRow}>
                    <span>Your Stake</span>
                    <span className={styles.summaryMono}>${parseFloat(betAmount).toFixed(2)}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Est. Odds</span>
                    <span className={styles.summaryMono}>
                      {betOption
                        ? ((betModal.market.total_pool + parseFloat(betAmount)) / (betOption.pool + parseFloat(betAmount))).toFixed(2) + 'x'
                        : '—'}
                    </span>
                  </div>
                  <hr className={styles.summaryDivider} />
                  <div className={`${styles.summaryRow} ${styles.summaryHighlight}`}>
                    <span>Est. Payout</span>
                    <span className={styles.summaryMono}>${estimatedPayout.toFixed(2)}</span>
                  </div>
                  <p className={styles.summaryNote}>* Final payout depends on total pool at close</p>
                </div>
              )}

              <button
                className={styles.btnConfirm}
                onClick={handleBet}
                disabled={betLoading || !betAmount || parseFloat(betAmount) <= 0}
              >
                {betLoading ? 'Placing…' : 'Confirm Bet →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}
