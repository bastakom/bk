import {
  clearRadioDashboardSession,
  isValidDashboardPassword,
  setRadioDashboardSession,
} from '@/Radio/lib/auth'

export async function login(req: Request) {
  const { password } = await req.json().catch(() => ({ password: '' }))

  if (!isValidDashboardPassword(String(password || ''))) {
    return Response.json({ error: 'Fel lösenord' }, { status: 401 })
  }

  setRadioDashboardSession()

  return Response.json({ ok: true })
}

export async function logout() {
  clearRadioDashboardSession()

  return Response.json({ ok: true })
}
