import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import styles from './groups.module.css'

export const revalidate = 0

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id, joined_at, groups(id, name, description, invite_code, created_by, created_at)')
    .eq('user_id', user!.id)
    .order('joined_at', { ascending: false })

  const groups = memberships?.map(m => m.groups as any).filter(Boolean) ?? []

  // Get member counts
  const groupIds = groups.map((g: any) => g.id)
  const { data: memberCounts } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds.length ? groupIds : ['none'])

  const countMap: Record<string, number> = {}
  memberCounts?.forEach(m => {
    countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1
  })

  // Get market counts
  const { data: marketCounts } = await supabase
    .from('markets')
    .select('group_id')
    .in('group_id', groupIds.length ? groupIds : ['none'])

  const marketMap: Record<string, number> = {}
  marketCounts?.forEach(m => {
    if (m.group_id) marketMap[m.group_id] = (marketMap[m.group_id] ?? 0) + 1
  })

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>GROUPS</h1>
          <p className={styles.subtitle}>Private betting rooms for your crew</p>
        </div>
        <Link href="/groups/create" className={styles.createBtn}>
          + Create Group
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🏠</div>
          <div className={styles.emptyTitle}>No groups yet</div>
          <p>Create one and send the invite link to your mates</p>
          <Link href="/groups/create" className={styles.emptyBtn}>
            Create your first group →
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {groups.map((group: any) => (
            <Link key={group.id} href={`/groups/${group.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardIcon}>🎯</div>
                <div className={styles.cardInfo}>
                  <div className={styles.cardName}>{group.name}</div>
                  {group.description && (
                    <div className={styles.cardDesc}>{group.description}</div>
                  )}
                </div>
                {group.created_by === user!.id && (
                  <div className={styles.ownerBadge}>OWNER</div>
                )}
              </div>

              <div className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatVal}>{countMap[group.id] ?? 0}</span>
                  <span className={styles.cardStatLabel}>Members</span>
                </div>
                <div className={styles.cardStatDivider}/>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatVal}>{marketMap[group.id] ?? 0}</span>
                  <span className={styles.cardStatLabel}>Markets</span>
                </div>
                <div className={styles.cardStatDivider}/>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatCode}>{group.invite_code}</span>
                  <span className={styles.cardStatLabel}>Invite Code</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
