'use client'

import { useEffect, useState } from 'react'
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
  const [userProfile, setUserProfile] = useState(profile)
  const [betModal, setBetModal] = useState<{ market: Market; optionIdx: number } | null>(null)
  const [betAmount, setBetAmount] = useState('')
  const [betLoading, setBetLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('markets-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_options' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

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
      return showToast(`Not enough balance — you have $${Number(userProfile.balance).toFixed(2)}`, 'error')
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
      const optLabel = betModal.market.market_options?.find(o => o.option_idx === betModal.optionIdx)?.label
      setBetModal(null)
      setBetAmount('')
      showToast(`Bet placed! $${stake} on "${optLabel}" 🎟`, 'success')
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

  const filteredMarkets = filter === 'all'
    ? markets
    : markets.filter(m => m.emoji === { sport: '⚽', gaming: '🎮', racing: '🏁', social: '🍺', finance: '💰', general: '🎲' }[filter])

  const openCount   = markets.filter(m => m.status === 'open').length
  const totalPool   = markets.reduce((s, m) => s + Number(m.total_pool), 0)
  const betOption   = betModal?.market.market_options?.find(o => o.option_idx === betModal.optionIdx)
  const estPayout   = betModal && betAmount
    ? calcEstimatedPayout(betModal.market, betModal.optionIdx, parseFloat(betAmount) || 0)
    : 0

  const FILTERS = [
    { key: 'all',     label: 'All' },
    { key: 'sport',   label: '⚽ Sport' },
    { key: 'gaming',  label: '🎮 Gaming' },
    { key: 'racing',  label: '🏁 Racing' },
    { key: 'social',  label: '🍺 Social' },
    { key: 'finance', label: '💰 Finance' },
    { key: 'general', label: '🎲 General' },
  ]

  return (
    <div className={styles.wrap}>

      {/* ── TOP HEADER ── */}
      <div className={styles.topHeader}>
        <div className={styles.topHeaderLeft}>
          <h1 className={styles.pageTitle}>Markets</h1>
          <div className={styles.headerStats}>
            <div className={styles.headerStat}>
              <span className={styles.headerStatVal}>{openCount}</span>
              <span className={styles.headerStatLabel}>Live</span>
            </div>
            <div className={styles.headerStatDivider}/>
            <div className={styles.headerStat}>
              <span className={styles.headerStatVal}>${totalPool.toFixed(0)}</span>
              <span className={styles.headerStatLabel}>Total Pool</span>
            </div>
            <div className={styles.headerStatDivider}/>
            <div className={styles.headerStat}>
              <span className={styles.headerStatVal}>{markets.length}</span>
              <span className={styles.headerStatLabel}>Markets</span>
            </div>
          </div>
        </div>
        {userProfile && (
          <div className={styles.balanceChip}>
            <div className={styles.balanceChipLabel}>BALANCE</div>
            <div className={styles.balanceChipVal}>${Number(userProfile.balance).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* ── CATEGORY FILTER STRIP ── */}
      <div className={styles.filterStrip}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`${styles.filterBtn} ${filter === f.key ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── MARKETS ── */}
      {filteredMarkets.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎯</div>
          <div className={styles.emptyTitle}>No Markets Yet</div>
          <p>Create the first one!</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredMarkets.map((market, mi) => {
            const odds    = calcOdds(market)
            const isCreator = market.created_by === userId
            const options = [...(market.market_options ?? [])].sort((a, b) => a.option_idx - b.option_idx)
            const isOpen  = market.status === 'open'
            const isResolved = market.winner_option_idx !== null

            const statusText  = isResolved ? 'RESOLVED' : market.status.toUpperCase()
            const statusClass = isResolved ? styles.statusResolved
                              : market.status === 'open' ? styles.statusOpen
                              : styles.statusClosed

            return (
              <div key={market.id} className={styles.card} style={{ animationDelay: `${mi * 0.05}s` }}>

                {/* Card header */}
                <div className={styles.cardHead}>
                  <div className={styles.cardHeadLeft}>
                    <span className={styles.cardEmoji}>{market.emoji}</span>
                    <div>
                      <div className={styles.cardCreator}>by {market.created_by_username}</div>
                      <div className={styles.cardTitle}>{market.question}</div>
                    </div>
                  </div>
                  <div className={styles.cardHeadRight}>
                    <div className={`${styles.statusPill} ${statusClass}`}>{statusText}</div>
                    {market.closes_at && isOpen && (
                      <div className={styles.closesAt}>
                        Closes {new Date(market.closes_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Pool bar */}
                <div className={styles.poolBar}>
                  <span className={styles.poolLabel}>POOL</span>
                  <span className={styles.poolVal}>${Number(market.total_pool).toFixed(0)}</span>
                  <span className={styles.poolBets}>
                    {options.reduce((s, o) => s, 0)} bets
                  </span>
                </div>

                {/* Options / odds buttons */}
                <div className={styles.optionsGrid}>
                  {options.map((opt) => {
                    const o = odds[opt.option_idx] ?? { oddsDisplay: '—', pct: 0 }
                    const isWinner = market.winner_option_idx === opt.option_idx
                    const isLoser  = isResolved && !isWinner

                    return (
                      <button
                        key={opt.id}
                        className={`${styles.oddsBtn}
                          ${isWinner ? styles.oddsBtnWinner : ''}
                          ${isLoser  ? styles.oddsBtnLoser  : ''}
                          ${isOpen   ? styles.oddsBtnClickable : ''}
                        `}
                        onClick={() => isOpen && setBetModal({ market, optionIdx: opt.option_idx }) && setBetAmount('')}
                        disabled={!isOpen}
                      >
                        <span className={styles.oddsBtnLabel}>
                          {isWinner ? '🏆 ' : ''}{opt.label}
                        </span>
                        <span className={styles.oddsBtnOdds}>{o.oddsDisplay}</span>
                        <div className={styles.oddsBtnBar}>
                          <div
                            className={styles.oddsBtnBarFill}
                            style={{ width: `${o.pct}%` }}
                          />
                        </div>
                        <span className={styles.oddsBtnPct}>{o.pct}%</span>
                      </button>
                    )
                  })}
                </div>

                {/* Creator controls */}
                {isCreator && isOpen && (
                  <div className={styles.creatorRow}>
                    <button className={styles.closeBtn} onClick={() => handleClose(market.id)}>
                      🔒 Close Betting
                    </button>
                  </div>
                )}

                {isCreator && market.status === 'closed' && !isResolved && (
                  <div className={styles.resolveRow}>
                    <span className={styles.resolveLabel}>Declare winner:</span>
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

      {/* ── BET MODAL ── */}
      {betModal && (
        <div className={styles.backdrop} onClick={() => setBetModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalMarket}>{betModal.market.question}</div>
                <div className={styles.modalOption}>{betOption?.label}</div>
              </div>
              <button className={styles.modalClose} onClick={() => setBetModal(null)}>✕</button>
            </div>

            {/* Current odds display */}
            <div className={styles.modalOddsDisplay}>
              <div className={styles.modalOddsItem}>
                <span className={styles.modalOddsLabel}>Current odds</span>
                <span className={styles.modalOddsVal}>
                  {betOption
                    ? (Number(betModal.market.total_pool) / Number(betOption.pool || 1)).toFixed(2) + 'x'
                    : '—'}
                </span>
              </div>
              <div className={styles.modalOddsItem}>
                <span className={styles.modalOddsLabel}>Pool share</span>
                <span className={styles.modalOddsVal}>
                  {betOption && Number(betModal.market.total_pool) > 0
                    ? Math.round((Number(betOption.pool) / Number(betModal.market.total_pool)) * 100) + '%'
                    : '—'}
                </span>
              </div>
              <div className={styles.modalOddsItem}>
                <span className={styles.modalOddsLabel}>Total pool</span>
                <span className={styles.modalOddsVal}>${Number(betModal.market.total_pool).toFixed(0)}</span>
              </div>
            </div>

            {/* Stake input */}
            <div className={styles.modalStakeWrap}>
              <div className={styles.modalStakeLabel}>STAKE</div>
              <div className={styles.modalStakeInput}>
                <span className={styles.modalStakeCurrency}>$</span>
                <input
                  type="number"
                  min="1"
                  placeholder="0.00"
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value)}
                  autoFocus
                  className={styles.modalStakeField}
                />
              </div>
              <div className={styles.presets}>
                {[5, 10, 25, 50, 100].map(n => (
                  <button key={n} className={styles.presetBtn} onClick={() => setBetAmount(String(n))}>
                    ${n}
                  </button>
                ))}
              </div>
            </div>

            {/* Payout estimate */}
            {betAmount && parseFloat(betAmount) > 0 && (
              <div className={styles.payoutRow}>
                <div className={styles.payoutItem}>
                  <span className={styles.payoutLabel}>Stake</span>
                  <span className={styles.payoutVal}>${parseFloat(betAmount).toFixed(2)}</span>
                </div>
                <div className={styles.payoutArrow}>→</div>
                <div className={styles.payoutItem}>
                  <span className={styles.payoutLabel}>Est. Return</span>
                  <span className={`${styles.payoutVal} ${styles.payoutGreen}`}>${estPayout.toFixed(2)}</span>
                </div>
              </div>
            )}

            <p className={styles.modalNote}>
              * Parimutuel odds — final payout depends on total pool at close
            </p>

            <button
              className={styles.confirmBtn}
              onClick={handleBet}
              disabled={betLoading || !betAmount || parseFloat(betAmount) <= 0}
            >
              {betLoading ? 'Placing Bet…' : `Place Bet →`}
            </button>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
          {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
