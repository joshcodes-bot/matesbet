import { createClient } from '@/lib/supabase/server'
import MarketsClient from './MarketsClient'

export const revalidate = 0

export default async function MarketsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: markets } = await supabase
    .from('markets')
    .select('*, market_options(*)')
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  return <MarketsClient markets={markets ?? []} profile={profile} userId={user!.id} />
}
