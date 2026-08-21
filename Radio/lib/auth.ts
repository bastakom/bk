import { cookies } from 'next/headers'
import { createHash, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'bk_radio_session'
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)

  if (left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}

function getPasswordHash() {
  const hash = process.env.RADIO_DASHBOARD_PASSWORD_HASH
  const password = process.env.RADIO_DASHBOARD_PASSWORD

  if (hash) {
    return hash
  }

  if (password) {
    return sha256(password)
  }

  return ''
}

export function isValidDashboardPassword(password: string) {
  const expectedHash = getPasswordHash()

  if (!expectedHash || !password) {
    return false
  }

  return safeEqual(sha256(password), expectedHash)
}

export function getSessionValue() {
  const secret = process.env.RADIO_DASHBOARD_SESSION_SECRET

  if (!secret) {
    return ''
  }

  return sha256(`radio-dashboard:${secret}`)
}

export function isRadioDashboardAuthenticated() {
  const sessionValue = getSessionValue()
  const cookieValue = cookies().get(COOKIE_NAME)?.value

  if (!sessionValue || !cookieValue) {
    return false
  }

  return safeEqual(cookieValue, sessionValue)
}

export function setRadioDashboardSession() {
  const sessionValue = getSessionValue()

  if (!sessionValue) {
    throw new Error('RADIO_DASHBOARD_SESSION_SECRET saknas')
  }

  cookies().set(COOKIE_NAME, sessionValue, {
    httpOnly: true,
    maxAge: ONE_WEEK_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

export function clearRadioDashboardSession() {
  cookies().set(COOKIE_NAME, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}
