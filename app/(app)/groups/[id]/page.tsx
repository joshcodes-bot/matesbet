import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import GroupClient from './GroupClient'

export const revalidate = 0

export default async function GroupPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get group
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!group) return notFound()

  // Check membership
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', params.id)
    .eq('user_id', user!.id)
    .single()

  if (!membership) return notFound()

  // Get members
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, joined_at, profiles(username, balance, total_won, total_staked)')
    .eq('group_id', params.id)
    .order('joined_at', { ascending: true })

  // Get markets for this group
  const { data: markets } = await supabase
    .from('markets')
    .select('*, market_options(*)')
    .eq('group_id', params.id)
    .order('created_at', { ascending: false })

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  return (
    <GroupClient
      group={group}
      members={members ?? []}
      markets={markets ?? []}
      profile={profile}
      userId={user!.id}
    />
  )
}
