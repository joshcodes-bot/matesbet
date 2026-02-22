'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import styles from './NavSidebar.module.css'

const NAV = [
  { href: '/markets',     icon: '🏠', label: 'Home' },
  { href: '/create',      icon: '➕', label: 'Create Market' },
  { href: '/my-bets',     icon: '🎟', label: 'My Bets' },
  { href: '/leaderboard', icon: '🏆', label: 'Leaderboard' },
  { href: '/settlements', icon: '🤝', label: 'Settlements' },
]

const CATEGORIES = [
  { label: 'Sport',   icon: '⚽' },
  { label: 'Gaming',  icon: '🎮' },
  { label: 'Racing',  icon: '🏁' },
  { label: 'Social',  icon: '🍺' },
  { label: 'Finance', icon: '💰' },
  { label: 'General', icon: '🎲' },
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
      <aside className={styles.sidebar}>

        {/* Logo */}
        <Link href="/markets" className={styles.logo}>
  <img src="/logo.png" alt="MatesBet" height={36} style={{ display: 'block' }} />
</Link>

        {/* Profile */}
        {profile && (
          <div className={styles.profileCard}>
            <div className={styles.avatar}>{profile.username[0].toUpperCase()}</div>
            <div className={styles.profileMeta}>
              <div className={styles.profileName}>{profile.username}</div>
              <div className={styles.profileBal}>${Number(profile.balance).toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className={styles.nav}>
          <div className={styles.navSection}>
            <span className={styles.navSectionLabel}>NAVIGATE</span>
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <div className={styles.navSection}>
            <span className={styles.navSectionLabel}>CATEGORIES</span>
            {CATEGORIES.map(c => (
              <Link
                key={c.label}
                href={`/markets?cat=${c.label.toLowerCase()}`}
                className={styles.navItem}
              >
                <span className={styles.navIcon}>{c.icon}</span>
                {c.label}
              </Link>
            ))}
          </div>
        </nav>

        <button className={styles.signOut} onClick={handleLogout}>
          ↩ Sign Out
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav className={styles.mobileNav}>
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.mobileNavItem} ${pathname === item.href ? styles.mobileNavActive : ''}`}
          >
            <span>{item.icon}</span>
            <span className={styles.mobileNavLabel}>{item.label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
