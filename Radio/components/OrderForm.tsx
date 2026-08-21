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
  ['syfte', '1', 'Syfte med kampanjen'],
  ['malgrupp', '2', 'Målgrupp'],
  ['budskap', '3', 'Huvudbudskap'],
  ['cta', '4', 'Call to action'],
  ['ton', '5', 'Ton och känsla'],
  ['ovriga_tankar', '', 'Övriga tankar'],
  ['praktiskt', '6', 'Praktiskt'],
  ['period_detaljer', '', 'Kampanjperiod detaljer'],
  ['ovrigt', '', 'Övrigt'],
  ['tankapa', '7', 'Att tänka på'],
] as const

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
    <main className="min-h-screen bg-[#f3f3f1] text-[15px] leading-[1.45] text-[#0b0b0b] antialiased">
      <header className="sticky top-0 z-40 border-b-[1.5px] border-black bg-[#f3f3f1]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-[18px] py-3">
          <Mark />
          <div className="font-sans text-[19px] font-extrabold uppercase tracking-normal text-black">
            BK <span className="ml-2 text-sm font-medium normal-case text-[#70706c]">Skicka radiobrief</span>
          </div>
          <a
            className="ml-auto border-[1.5px] border-black px-3 py-1.5 text-[13px] font-medium transition hover:bg-black hover:text-white"
            href="/dashboard"
          >
            Logga in
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-[18px] pb-24 pt-5">
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <input name="website" type="text" className="hidden" tabIndex={-1} autoComplete="off" />

          <section className="border-[1.5px] border-[#dededa] bg-white">
            <div className="border-b border-[#dededa] px-5 py-4">
              <h1 className="text-[28px] font-extrabold leading-none tracking-normal text-black md:text-[40px]">
                Radiobrief
              </h1>
              <p className="mt-2 text-sm text-[#70706c]">
                Fyll i briefen i samma ordning som produktionen använder den.
              </p>
            </div>

            <div className="grid gap-x-4 gap-y-3 border-b border-[#dededa] p-5 md:grid-cols-2">
              {fields.map(([name, label, type, required]) => (
                <label key={name} className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#70706c]">
                    {label}{required ? ' *' : ''}
                  </span>
                  <input
                    className="w-full border-[1.5px] border-[#dededa] bg-white px-3 py-3 text-[15px] outline-none transition focus:border-black"
                    name={name}
                    type={type}
                    required={required}
                  />
                </label>
              ))}
            </div>

            <div>
              {questions.map(([name, number, label]) => {
                const critical = name === 'tankapa'

                return (
                  <label
                    key={name}
                    className={`block border-b border-[#dededa] p-5 ${
                      critical ? 'border-l-[3px] border-l-[#d6202b] bg-[#fdf6f6]' : ''
                    }`}
                  >
                    <span className="mb-2 flex items-baseline gap-3">
                      {number && <span className="font-mono text-xs text-[#70706c]">{number}</span>}
                      <span className={`text-[16.5px] font-bold ${critical ? 'text-[#d6202b]' : 'text-black'}`}>
                        {label}
                      </span>
                    </span>
                    <textarea
                      className="min-h-28 w-full border-[1.5px] border-[#dededa] bg-white px-3 py-3 text-[15px] outline-none transition focus:border-black"
                      name={name}
                    />
                  </label>
                )
              })}
            </div>
          </section>

          <aside className="h-fit border-[1.5px] border-black bg-white lg:sticky lg:top-[76px]">
            <div className="border-b-[1.5px] border-black p-5">
              <h2 className="text-[22px] font-extrabold leading-tight text-black">Skicka in</h2>
              <p className="mt-2 text-sm text-[#70706c]">
                Briefen sparas i dashboarden och skickar mailnotis till produktionen.
              </p>
            </div>
            <div className="p-5">
              <button
                className="w-full bg-black px-5 py-3 font-semibold text-white transition hover:bg-[#2a2a28] disabled:opacity-60"
                type="submit"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Skickar...' : 'Skicka radiobrief'}
              </button>
              {status === 'sent' && (
                <p className="mt-3 border border-[#dededa] bg-[#e9e9e5] px-3 py-2 text-sm font-semibold">
                  Briefen är skickad.
                </p>
              )}
              {status === 'error' && (
                <p className="mt-3 border border-[#d6202b] bg-[#fdecec] px-3 py-2 text-sm font-semibold text-[#d6202b]">
                  {error}
                </p>
              )}
            </div>
          </aside>
        </form>
      </div>
    </main>
  )
}
