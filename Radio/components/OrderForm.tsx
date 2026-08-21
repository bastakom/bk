'use client'

import { FormEvent, useState } from 'react'

const fields = [
  ['kund', 'Kund', 'text', true],
  ['order_id', 'Order-ID', 'text', false],
  ['kontaktperson', 'Kontaktperson', 'text', false],
  ['telefon', 'Telefon', 'tel', false],
  ['epost', 'E-post', 'email', false],
  ['saljare', 'Säljare', 'text', false],
  ['kampanjperiod', 'Kampanjperiod', 'text', false],
  ['deadline', 'Deadline', 'date', false],
  ['format', 'Format', 'text', false],
  ['antal_spottar', 'Antal spottar', 'text', false],
] as const

const questions = [
  ['syfte', '1. Syfte med kampanjen'],
  ['malgrupp', '2. Målgrupp'],
  ['budskap', '3. Huvudbudskap'],
  ['cta', '4. Call to action'],
  ['ton', '5. Ton och känsla'],
  ['ovriga_tankar', 'Övriga tankar'],
  ['praktiskt', '6. Praktiskt'],
  ['period_detaljer', 'Kampanjperiod detaljer'],
  ['ovrigt', 'Övrigt'],
  ['tankapa', '7. Att tänka på'],
] as const

export default function OrderForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setError('')

    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form))

    const response = await fetch('/api/radio-briefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error || 'Beställningen kunde inte skickas.')
      setStatus('error')
      return
    }

    form.reset()
    setStatus('sent')
  }

  return (
    <main className="min-h-screen bg-[#f3f3f1] px-4 py-6 text-[#0b0b0b]">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center gap-4 border-b-2 border-black pb-4">
          <div className="flex w-7 flex-col gap-1">
            <span className="h-0.5 bg-black" />
            <span className="h-0.5 w-2/3 bg-black" />
            <span className="h-0.5 w-5/6 bg-black" />
            <span className="h-0.5 bg-black" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.12em] text-[#70706c]">
              Bästa Kompisar
            </p>
            <h1 className="text-3xl font-bold text-black md:text-5xl">
              Radiobrief
            </h1>
          </div>
          <a
            className="ml-auto border border-black px-4 py-2 text-sm font-semibold hover:bg-black hover:text-white"
            href="/dashboard"
          >
            Logga in
          </a>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          <input name="website" type="text" className="hidden" tabIndex={-1} autoComplete="off" />

          <section className="grid gap-4 md:grid-cols-2">
            {fields.map(([name, label, type, required]) => (
              <label key={name} className="block">
                <span className="mb-1 block text-sm font-semibold">{label}</span>
                <input
                  className="w-full border border-[#dededa] bg-white px-4 py-3 outline-none focus:border-black"
                  name={name}
                  type={type}
                  required={required}
                />
              </label>
            ))}
          </section>

          <section className="space-y-4">
            {questions.map(([name, label]) => (
              <label key={name} className="block">
                <span className={`mb-1 block text-sm font-semibold ${name === 'tankapa' ? 'text-[#d6202b]' : ''}`}>
                  {label}
                </span>
                <textarea
                  className={`min-h-28 w-full border bg-white px-4 py-3 outline-none focus:border-black ${
                    name === 'tankapa' ? 'border-[#d6202b]' : 'border-[#dededa]'
                  }`}
                  name={name}
                />
              </label>
            ))}
          </section>

          <div className="flex flex-col gap-3 border-t border-black pt-5 md:flex-row md:items-center">
            <button
              className="bg-black px-6 py-3 font-semibold text-white disabled:opacity-60"
              type="submit"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Skickar...' : 'Skicka radiobrief'}
            </button>
            {status === 'sent' && (
              <p className="font-semibold text-green-700">Briefen är skickad.</p>
            )}
            {status === 'error' && (
              <p className="font-semibold text-[#d6202b]">{error}</p>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}
