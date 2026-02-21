'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import styles from './NavSidebar.module.css'

const NAV = [
  { href: '/markets', icon: '🎯', label: 'Markets' },
  { href: '/create', icon: '➕', label: 'Create Market' },
  { href: '/my-bets', icon: '🎟', label: 'My Bets' },
  { href: '/leaderboard', icon: '🏆', label: 'Leaderboard' },
]

export default function NavSidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={styles.sidebar}>
        <Link href="/markets" className={styles.logo}>
          Mates<span>Bet</span>
        </Link>

        {profile && (
          <div className={styles.profileCard}>
            <div className={styles.avatar}>{profile.username[0].toUpperCase()}</div>
            <div>
              <div className={styles.username}>{profile.username}</div>
              <div className={styles.balance}>${profile.balance.toFixed(2)}</div>
            </div>
          </div>
        )}

        <nav className={styles.nav}>
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          ← Sign Out
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav className={styles.mobileNav}>
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.mobileNavItem} ${pathname === item.href ? styles.active : ''}`}
          >
            <span className={styles.mobileNavIcon}>{item.icon}</span>
            <span className={styles.mobileNavLabel}>{item.label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
