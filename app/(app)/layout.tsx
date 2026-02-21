import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavSidebar from '@/components/NavSidebar'
import styles from './app.module.css'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className={styles.appShell}>
      <NavSidebar profile={profile} />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
