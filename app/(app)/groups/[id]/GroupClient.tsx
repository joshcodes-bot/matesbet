'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcOdds, calcEstimatedPayout } from '@/lib/types'
import type { Market, Profile } from '@/lib/types'
import styles from './group.module.css'

interface Member {
  user_id: string
  joined_at: string
  profiles: { username: string; balance: number; total_won: number; total_staked: number } | null
}

interface Props {
  group: { id: string; name: string; description: string; invite_code: string; created_by: string }
  members: Member[]
  markets: Market[]
  profile: Profile | null
  userId: string
}

type Tab = 'markets' | 'members' | 'invite'

export default function GroupClient({ group, members, markets: initialMarkets, profile, userId }: Props) {
  const [tab, setTab] = useState<Tab>('markets')
  const [markets, setMarkets] = useState(initialMarkets)
  const [betModal, setBetModal] = useState<{ market: Market; optionIdx: number } | null>(null)
  const [betAmount, setBetAmount] = useState('')
  const [betLoading, setBetLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${group.invite_code}`
    : `/join/${group.invite_code}`

  function showToast(msg: string, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Invite link copied! 🔗', 'success')
  }

  async function handleBet() {
    if (!betModal) return
    const stake = parseFloat(betAmount)
    if (!stake || stake <= 0) return showToast('Enter a valid stake', 'error')
    if (profile && profile.balance < stake) {
      return showToast(`Not enough balance — you have $${Number(profile.balance).toFixed(2)}`, 'error')
    }
    setBetLoading(true)
    const { data, error } = await supabase.rpc('place_bet', {
      p_market_id: betModal.market.id,
      p_option_idx: betModal.optionIdx,
      p_user_id: userId,
      p_username: profile?.username ?? 'Unknown',
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
    showToast('Betting closed!', 'info')
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

  const betOption = betModal?.market.market_options?.find(o => o.option_idx === betModal.optionIdx)
  const estPayout = betModal && betAmount
    ? calcEstimatedPayout(betModal.market, betModal.optionIdx, parseFloat(betAmount) || 0)
    : 0

  return (
    <div className={styles.wrap}>

      {/* Group header */}
      <div className={styles.groupHeader}>
        <div className={styles.groupHeaderLeft}>
          <Link href="/groups" className={styles.backBtn}>← Groups</Link>
          <div>
            <h1 className={styles.groupName}>{group.name}</h1>
            {group.description && <p className={styles.groupDesc}>{group.description}</p>}
          </div>
        </div>
        <div className={styles.groupHeaderRight}>
          <div className={styles.memberCount}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </div>
          <button className={styles.inviteBtn} onClick={() => setTab('invite')}>
            🔗 Invite Link
          </button>
          <Link href={`/create?group=${group.id}`} className={styles.createMarketBtn}>
            + Market
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['markets', 'members', 'invite'] as Tab[]).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'markets' ? `🎯 Markets (${markets.length})`
              : t === 'members' ? `👥 Members (${members.length})`
              : '🔗 Invite'}
          </button>
        ))}
      </div>

      {/* ── MARKETS TAB ── */}
      {tab === 'markets' && (
        <>
          {markets.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎯</div>
              <div className={styles.emptyTitle}>No markets yet</div>
              <p>Create the first one for this group!</p>
              <Link href={`/create?group=${group.id}`} className={styles.emptyBtn}>
                Create Market →
              </Link>
            </div>
          ) : (
            <div className={styles.grid}>
              {markets.map((market, mi) => {
                const odds = calcOdds(market)
                const isCreator = market.created_by === userId
                const options = [...(market.market_options ?? [])].sort((a, b) => a.option_idx - b.option_idx)
                const isOpen = market.status === 'open'
                const isResolved = market.winner_option_idx !== null

                return (
                  <div key={market.id} className={styles.card} style={{ animationDelay: `${mi * 0.05}s` }}>
                    <div className={styles.cardHead}>
                      <div className={styles.cardHeadLeft}>
                        <span className={styles.cardEmoji}>{market.emoji}</span>
                        <div>
                          <div className={styles.cardCreator}>by {market.created_by_username}</div>
                          <div className={styles.cardTitle}>{market.question}</div>
                        </div>
                      </div>
                      <div className={`${styles.statusPill} ${
                        isResolved ? styles.statusResolved
                          : market.status === 'open' ? styles.statusOpen
                          : styles.statusClosed
                      }`}>
                        {isResolved ? 'RESOLVED' : market.status.toUpperCase()}
                      </div>
                    </div>

                    <div className={styles.poolBar}>
                      <span className={styles.poolLabel}>POOL</span>
                      <span className={styles.poolVal}>${Number(market.total_pool).toFixed(0)}</span>
                    </div>

                    <div className={styles.optionsGrid}>
                      {options.map(opt => {
                        const o = odds[opt.option_idx] ?? { oddsDisplay: '—', pct: 0 }
                        const isWinner = market.winner_option_idx === opt.option_idx
                        const isLoser = isResolved && !isWinner
                        return (
                          <button
                            key={opt.id}
                            className={`${styles.oddsBtn}
                              ${isWinner ? styles.oddsBtnWinner : ''}
                              ${isLoser ? styles.oddsBtnLoser : ''}
                              ${isOpen ? styles.oddsBtnClickable : ''}
                            `}
                            onClick={() => isOpen && (setBetModal({ market, optionIdx: opt.option_idx }), setBetAmount(''))}
                            disabled={!isOpen}
                          >
                            <span className={styles.oddsBtnLabel}>{isWinner ? '🏆 ' : ''}{opt.label}</span>
                            <span className={styles.oddsBtnOdds}>{o.oddsDisplay}</span>
                            <div className={styles.oddsBtnBar}>
                              <div className={styles.oddsBtnBarFill} style={{ width: `${o.pct}%` }} />
                            </div>
                            <span className={styles.oddsBtnPct}>{o.pct}%</span>
                          </button>
                        )
                      })}
                    </div>

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
                            <button key={opt.id} className={styles.resolveBtn}
                              onClick={() => handleResolve(market.id, opt.option_idx)}>
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
        </>
      )}

      {/* ── MEMBERS TAB ── */}
      {tab === 'members' && (
        <div className={styles.membersList}>
          {members.map((m, i) => {
            const p = m.profiles
            if (!p) return null
            const profit = Number(p.total_won) - Number(p.total_staked)
            return (
              <div key={m.user_id} className={`${styles.memberRow} ${m.user_id === userId ? styles.memberRowMe : ''}`}>
                <div className={styles.memberRank}>{i + 1}</div>
                <div className={styles.memberAvatar}>{p.username[0].toUpperCase()}</div>
                <div className={styles.memberInfo}>
                  <div className={styles.memberName}>
                    {p.username}
                    {m.user_id === userId && <span className={styles.youBadge}>YOU</span>}
                    {m.user_id === group.created_by && <span className={styles.ownerBadge}>OWNER</span>}
                  </div>
                  <div className={styles.memberJoined}>
                    Joined {new Date(m.joined_at).toLocaleDateString()}
                  </div>
                </div>
                <div className={styles.memberStats}>
                  <div className={styles.memberBalance}>${Number(p.balance).toFixed(2)}</div>
                  <div className={`${styles.memberProfit} ${profit >= 0 ? styles.profitPos : styles.profitNeg}`}>
                    {profit >= 0 ? '+' : ''}${profit.toFixed(2)} P&L
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── INVITE TAB ── */}
      {tab === 'invite' && (
        <div className={styles.invitePanel}>
          <div className={styles.inviteCard}>
            <div className={styles.inviteTitle}>🔗 Invite your mates</div>
            <p className={styles.inviteDesc}>
              Anyone with this link can join <strong>{group.name}</strong> and start betting.
            </p>

            <div className={styles.inviteLinkBox}>
              <span className={styles.inviteLinkText}>{inviteUrl}</span>
              <button className={styles.copyBtn} onClick={copyInvite}>
                {copied ? '✅ Copied!' : 'Copy'}
              </button>
            </div>

            <div className={styles.inviteCode}>
              <div className={styles.inviteCodeLabel}>Or share the invite code</div>
              <div className={styles.inviteCodeVal}>{group.invite_code}</div>
              <div className={styles.inviteCodeHint}>
                Mates can go to <strong>/join</strong> and enter this code
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BET MODAL ── */}
      {betModal && (
        <div className={styles.backdrop} onClick={() => setBetModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalMarket}>{betModal.market.question}</div>
                <div className={styles.modalOption}>{betOption?.label}</div>
              </div>
              <button className={styles.modalClose} onClick={() => setBetModal(null)}>✕</button>
            </div>
            <div className={styles.modalOddsDisplay}>
              <div className={styles.modalOddsItem}>
                <span className={styles.modalOddsLabel}>Odds</span>
                <span className={styles.modalOddsVal}>
                  {betOption && Number(betOption.pool) > 0
                    ? (Number(betModal.market.total_pool) / Number(betOption.pool)).toFixed(2) + 'x'
                    : '—'}
                </span>
              </div>
              <div className={styles.modalOddsItem}>
                <span className={styles.modalOddsLabel}>Pool</span>
                <span className={styles.modalOddsVal}>${Number(betModal.market.total_pool).toFixed(0)}</span>
              </div>
              <div className={styles.modalOddsItem}>
                <span className={styles.modalOddsLabel}>Balance</span>
                <span className={styles.modalOddsVal}>${Number(profile?.balance ?? 0).toFixed(2)}</span>
              </div>
            </div>
            <div className={styles.modalStakeWrap}>
              <div className={styles.modalStakeLabel}>STAKE</div>
              <div className={styles.modalStakeInput}>
                <span className={styles.modalStakeCurrency}>$</span>
                <input type="number" min="1" placeholder="0.00"
                  value={betAmount} onChange={e => setBetAmount(e.target.value)}
                  autoFocus className={styles.modalStakeField} />
              </div>
              <div className={styles.presets}>
                {[5, 10, 25, 50, 100].map(n => (
                  <button key={n} className={styles.presetBtn} onClick={() => setBetAmount(String(n))}>
                    ${n}
                  </button>
                ))}
              </div>
            </div>
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
            <p className={styles.modalNote}>* Final payout depends on total pool at close</p>
            <button className={styles.confirmBtn} onClick={handleBet}
              disabled={betLoading || !betAmount || parseFloat(betAmount) <= 0}>
              {betLoading ? 'Placing Bet…' : 'Place Bet →'}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
          {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'} {toast.msg}
        </div>
      )}
    </div>
  )
}
