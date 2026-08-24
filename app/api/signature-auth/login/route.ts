import { NextResponse } from 'next/server'
import {
  isValidSignaturePassword,
  setSignatureGeneratorSession,
} from '@/Signatur/lib/auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!isValidSignaturePassword(password)) {
    return NextResponse.json({ error: 'Fel lösenord.' }, { status: 401 })
  }

  setSignatureGeneratorSession()

  return NextResponse.json({ ok: true })
}
