import { isRadioDashboardAuthenticated } from '@/Radio/lib/auth'
import Dashboard from '@/Radio/components/Dashboard'
import LoginForm from '@/Radio/components/LoginForm'

export const metadata = {
  title: 'Radiobriefer - Dashboard',
  robots: {
    index: false,
    follow: false,
  },
}

export default function DashboardPage() {
  return isRadioDashboardAuthenticated() ? <Dashboard /> : <LoginForm />
}
