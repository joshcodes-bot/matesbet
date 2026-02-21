-- ============================================================
-- MatesBet — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text,
  balance numeric(10,2) not null default 1000.00,
  total_staked numeric(10,2) not null default 0.00,
  total_won numeric(10,2) not null default 0.00,
  created_at timestamptz not null default now()
);

-- Markets table
create table public.markets (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  emoji text not null default '🎯',
  created_by uuid references public.profiles(id) on delete set null,
  created_by_username text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'resolved')),
  total_pool numeric(10,2) not null default 0.00,
  winner_option_idx int,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

-- Market options table
create table public.market_options (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references public.markets(id) on delete cascade not null,
  option_idx int not null,
  label text not null,
  pool numeric(10,2) not null default 0.00,
  created_at timestamptz not null default now(),
  unique(market_id, option_idx)
);

-- Bets table
create table public.bets (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references public.markets(id) on delete cascade not null,
  option_idx int not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  username text not null,
  stake numeric(10,2) not null check (stake > 0),
  status text not null default 'pending' check (status in ('pending', 'won', 'lost')),
  payout numeric(10,2),
  placed_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.markets enable row level security;
alter table public.market_options enable row level security;
alter table public.bets enable row level security;

-- Profiles: anyone can read, users can update their own
create policy "Profiles are publicly readable" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Markets: anyone can read, authenticated users can create
create policy "Markets are publicly readable" on public.markets for select using (true);
create policy "Authenticated users can create markets" on public.markets for insert with check (auth.uid() is not null);
create policy "Creators can update their markets" on public.markets for update using (auth.uid() = created_by);

-- Market options: anyone can read, authenticated users can create
create policy "Options are publicly readable" on public.market_options for select using (true);
create policy "Authenticated users can create options" on public.market_options for insert with check (auth.uid() is not null);
create policy "Creators can update options via market" on public.market_options for update using (
  exists (select 1 from public.markets where id = market_id and created_by = auth.uid())
);

-- Bets: anyone can read (so pool is visible), users can insert their own
create policy "Bets are publicly readable" on public.bets for select using (true);
create policy "Users can place bets" on public.bets for insert with check (auth.uid() = user_id);

-- ============================================================
-- Auto-create profile on signup (via trigger)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'username'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Function: place a bet (atomic, runs as DB transaction)
-- ============================================================

create or replace function public.place_bet(
  p_market_id uuid,
  p_option_idx int,
  p_user_id uuid,
  p_username text,
  p_stake numeric
)
returns json as $$
declare
  v_user_balance numeric;
  v_market_status text;
  v_closes_at timestamptz;
  v_bet_id uuid;
begin
  -- Lock the user row
  select balance into v_user_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_user_balance < p_stake then
    return json_build_object('error', 'Insufficient balance');
  end if;

  -- Check market is open
  select status, closes_at into v_market_status, v_closes_at
  from public.markets
  where id = p_market_id;

  if v_market_status != 'open' then
    return json_build_object('error', 'Market is not open');
  end if;

  if v_closes_at is not null and v_closes_at < now() then
    return json_build_object('error', 'Market has closed');
  end if;

  -- Deduct user balance
  update public.profiles
  set balance = balance - p_stake,
      total_staked = total_staked + p_stake
  where id = p_user_id;

  -- Add to option pool
  update public.market_options
  set pool = pool + p_stake
  where market_id = p_market_id and option_idx = p_option_idx;

  -- Add to market total pool
  update public.markets
  set total_pool = total_pool + p_stake
  where id = p_market_id;

  -- Insert bet
  insert into public.bets (market_id, option_idx, user_id, username, stake)
  values (p_market_id, p_option_idx, p_user_id, p_username, p_stake)
  returning id into v_bet_id;

  return json_build_object('success', true, 'bet_id', v_bet_id);
end;
$$ language plpgsql security definer;

-- ============================================================
-- Function: resolve a market (pays out winners)
-- ============================================================

create or replace function public.resolve_market(
  p_market_id uuid,
  p_winner_option_idx int,
  p_requesting_user uuid
)
returns json as $$
declare
  v_created_by uuid;
  v_status text;
  v_total_pool numeric;
  v_winner_pool numeric;
  v_bet record;
  v_payout numeric;
begin
  -- Verify caller is market creator
  select created_by, status, total_pool into v_created_by, v_status, v_total_pool
  from public.markets
  where id = p_market_id;

  if v_created_by != p_requesting_user then
    return json_build_object('error', 'Only the market creator can resolve it');
  end if;

  if v_status = 'resolved' then
    return json_build_object('error', 'Market already resolved');
  end if;

  -- Get winner pool
  select pool into v_winner_pool
  from public.market_options
  where market_id = p_market_id and option_idx = p_winner_option_idx;

  -- Update market
  update public.markets
  set status = 'resolved', winner_option_idx = p_winner_option_idx
  where id = p_market_id;

  -- Pay out winners
  for v_bet in
    select * from public.bets
    where market_id = p_market_id and option_idx = p_winner_option_idx
  loop
    if v_winner_pool > 0 then
      v_payout := (v_bet.stake / v_winner_pool) * v_total_pool;
    else
      v_payout := v_bet.stake; -- refund if no one bet on winner
    end if;

    update public.bets
    set status = 'won', payout = v_payout
    where id = v_bet.id;

    update public.profiles
    set balance = balance + v_payout,
        total_won = total_won + v_payout
    where id = v_bet.user_id;
  end loop;

  -- Mark losing bets
  update public.bets
  set status = 'lost', payout = 0
  where market_id = p_market_id and option_idx != p_winner_option_idx;

  return json_build_object('success', true);
end;
$$ language plpgsql security definer;

-- ============================================================
-- Enable realtime on markets and market_options
-- (so odds update live without refreshing)
-- ============================================================

alter publication supabase_realtime add table public.markets;
alter publication supabase_realtime add table public.market_options;
alter publication supabase_realtime add table public.bets;
