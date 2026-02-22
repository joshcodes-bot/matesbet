'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import styles from './NavSidebar.module.css'

const NAV = [
  { href: '/markets',     icon: '🏠', label: 'Home' },
  { href: '/groups',      icon: '👥', label: 'My Groups' },
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
          <div className={styles.logoMark}>
            <svg viewBox="0 0 36 36" width="26" height="26" fill="none">
              <rect width="36" height="36" rx="9" fill="#0f0f1e"/>
              <rect x="4"  y="22" width="5" height="10" rx="1.5" fill="#252540"/>
              <rect x="12" y="16" width="5" height="16" rx="1.5" fill="#2e2e50"/>
              <rect x="20" y="9"  width="5" height="23" rx="1.5" fill="#f0e040" opacity="0.85"/>
              <rect x="28" y="3"  width="5" height="29" rx="1.5" fill="#f0e040"/>
              <polyline points="6.5,23 14.5,17 22.5,10 30.5,4"
                stroke="#40e0f0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="30.5" cy="4" r="2.2" fill="#40e0f0"/>
            </svg>
          </div>
          <span className={styles.logoText}>mates<span>bet</span></span>
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
