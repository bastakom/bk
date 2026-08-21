'use client'

import { FormEvent, useState } from 'react'

export default function LoginForm() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const form = event.currentTarget
    const password = String(new FormData(form).get('password') || '')

    const response = await fetch('/api/radio-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (!response.ok) {
      setError('Fel lösenord.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f3f1] px-4 text-[#0b0b0b]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm border border-black bg-white p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex w-6 flex-col gap-1">
            <span className="h-0.5 bg-black" />
            <span className="h-0.5 w-2/3 bg-black" />
            <span className="h-0.5 w-5/6 bg-black" />
            <span className="h-0.5 bg-black" />
          </div>
          <h1 className="text-2xl font-bold text-black">Radiobriefer</h1>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Lösenord</span>
          <input
            className="w-full border border-[#dededa] px-4 py-3 outline-none focus:border-black"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="mt-3 text-sm font-semibold text-[#d6202b]">{error}</p>}

        <button
          className="mt-5 w-full bg-black px-5 py-3 font-semibold text-white disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Loggar in...' : 'Logga in'}
        </button>
      </form>
    </main>
  )
}
