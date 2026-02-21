export interface Profile {
  id: string
  username: string
  display_name: string
  balance: number
  total_staked: number
  total_won: number
  created_at: string
}

export interface MarketOption {
  id: string
  market_id: string
  option_idx: number
  label: string
  pool: number
}

export interface Market {
  id: string
  question: string
  emoji: string
  created_by: string
  created_by_username: string
  status: 'open' | 'closed' | 'resolved'
  total_pool: number
  winner_option_idx: number | null
  closes_at: string | null
  created_at: string
  market_options?: MarketOption[]
}

export interface Bet {
  id: string
  market_id: string
  option_idx: number
  user_id: string
  username: string
  stake: number
  status: 'pending' | 'won' | 'lost'
  payout: number | null
  placed_at: string
  markets?: { question: string; emoji: string; market_options: MarketOption[] }
}

// Calculated odds for an option
export interface OptionOdds {
  odds: number       // multiplier e.g. 2.5
  oddsDisplay: string // e.g. "2.50x"
  pct: number        // % of pool
}

export function calcOdds(market: Market): OptionOdds[] {
  const total = market.total_pool
  const options = market.market_options ?? []
  return options
    .sort((a, b) => a.option_idx - b.option_idx)
    .map(opt => {
      if (opt.pool === 0 || total === 0) return { odds: 0, oddsDisplay: '—', pct: 0 }
      const odds = total / opt.pool
      return {
        odds,
        oddsDisplay: odds.toFixed(2) + 'x',
        pct: Math.round((opt.pool / total) * 100),
      }
    })
}

export function calcEstimatedPayout(market: Market, optionIdx: number, stake: number): number {
  const opt = market.market_options?.find(o => o.option_idx === optionIdx)
  if (!opt) return 0
  const newTotal = market.total_pool + stake
  const newOptPool = opt.pool + stake
  if (newOptPool === 0) return 0
  return stake * (newTotal / newOptPool)
}
