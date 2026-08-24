import { cookies } from 'next/headers'
import { createHash, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'bk_signature_session'
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
  const hash = process.env.SIGNATURE_GENERATOR_PASSWORD_HASH
  const password = process.env.SIGNATURE_GENERATOR_PASSWORD

  if (hash) {
    return hash
  }

  if (password) {
    return sha256(password)
  }

  return ''
}

export function isValidSignaturePassword(password: string) {
  const expectedHash = getPasswordHash()

  if (!expectedHash || !password) {
    return false
  }

  return safeEqual(sha256(password), expectedHash)
}

function getSessionValue() {
  const secret = process.env.SIGNATURE_GENERATOR_SESSION_SECRET

  if (!secret) {
    return ''
  }

  return sha256(`signature-generator:${secret}`)
}

export function isSignatureGeneratorAuthenticated() {
  const sessionValue = getSessionValue()
  const cookieValue = cookies().get(COOKIE_NAME)?.value

  if (!sessionValue || !cookieValue) {
    return false
  }

  return safeEqual(cookieValue, sessionValue)
}

export function setSignatureGeneratorSession() {
  const sessionValue = getSessionValue()

  if (!sessionValue) {
    throw new Error('SIGNATURE_GENERATOR_SESSION_SECRET saknas')
  }

  cookies().set(COOKIE_NAME, sessionValue, {
    httpOnly: true,
    maxAge: ONE_WEEK_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}
