'use client'

import { FormEvent, useState } from 'react'

function Mark() {
  return (
    <div className="flex w-[22px] shrink-0 flex-col gap-0.5">
      <span className="h-0.5 bg-black" />
      <span className="h-0.5 w-[70%] bg-black" />
      <span className="h-0.5 w-[85%] bg-black" />
      <span className="h-0.5 bg-black" />
    </div>
  )
}

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
    <main className="min-h-screen bg-[#f3f3f1] text-[15px] leading-[1.45] text-[#0b0b0b] antialiased">
      <header className="border-b-[1.5px] border-black bg-[#f3f3f1]/95">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-[18px] py-3">
          <Mark />
          <div className="font-sans text-[19px] font-extrabold uppercase tracking-normal text-black">
            BK <span className="ml-2 text-sm font-medium normal-case text-[#70706c]">Radiobriefer</span>
          </div>
          <a
            className="ml-auto border-[1.5px] border-black px-3 py-1.5 text-[13px] font-medium transition hover:bg-black hover:text-white"
            href="/"
          >
            Till formuläret
          </a>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-55px)] max-w-[1200px] place-items-center px-[18px] py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-[420px] border-[1.5px] border-black bg-white">
          <div className="border-b-[1.5px] border-black p-5">
            <h1 className="text-[32px] font-extrabold leading-none tracking-normal text-black">
              Logga in
            </h1>
            <p className="mt-2 text-sm text-[#70706c]">
              Dashboarden är låst med det gemensamma radiolösenordet.
            </p>
          </div>

          <div className="p-5">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#70706c]">
                Lösenord
              </span>
              <input
                className="w-full border-[1.5px] border-[#dededa] bg-white px-3 py-3 text-[17px] outline-none transition focus:border-black"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>

            {error && (
              <p className="mt-3 border border-[#d6202b] bg-[#fdecec] px-3 py-2 text-sm font-semibold text-[#d6202b]">
                {error}
              </p>
            )}

            <button
              className="mt-5 w-full bg-black px-5 py-3 font-semibold text-white transition hover:bg-[#2a2a28] disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
