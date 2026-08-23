'use client'

import { FormEvent, useState } from 'react'

const fields = [
  {
    name: 'kund',
    label: 'Kund',
    type: 'text',
    required: true,
    help: 'Företaget eller kunden som spotten gäller.',
  },
  {
    name: 'order_id',
    label: 'Order-ID',
    type: 'text',
    required: false,
    help: 'Fyll i om det finns ett internt ordernummer eller projektnummer.',
  },
  {
    name: 'kontaktperson',
    label: 'Kontaktperson',
    type: 'text',
    required: true,
    help: 'Personen som produktionen kan kontakta vid frågor om briefen.',
  },
  {
    name: 'telefon',
    label: 'Telefon',
    type: 'tel',
    required: false,
    help: '',
  },
  {
    name: 'epost',
    label: 'E-post',
    type: 'email',
    required: true,
    help: '',
  },
  {
    name: 'saljare',
    label: 'Säljare',
    type: 'text',
    required: true,
    help: 'Namnet på ansvarig säljare internt.',
  },
  {
    name: 'kampanjperiod',
    label: 'Kampanjperiod',
    type: 'text',
    required: false,
    help: 'Exempel: vecka 38-40, september, eller start- och slutdatum.',
  },
  {
    name: 'deadline',
    label: 'Deadline',
    type: 'date',
    required: true,
    help: 'Datumet då manuset eller spotten behöver vara klar.',
  },
  {
    name: 'format',
    label: 'Format',
    type: 'text',
    required: true,
    help: 'Exempel: 20 sek, 30 sek, sponsorship, eller annat format.',
  },
  {
    name: 'antal_spottar',
    label: 'Antal spottar',
    type: 'text',
    required: true,
    help: 'Ange antal versioner eller spotlängder som ska produceras.',
  },
] as const

const questions = [
  {
    name: 'syfte',
    number: '1',
    label: 'Syfte med kampanjen',
    required: true,
    help: 'Vad ska kampanjen uppnå? Exempel: driva besök, skapa kännedom, sälja en tjänst eller lyfta ett erbjudande.',
  },
  {
    name: 'malgrupp',
    number: '2',
    label: 'Målgrupp',
    required: true,
    help: 'Beskriv vem spotten ska prata med. Exempel: privatpersoner, företagare, villaägare, unga vuxna eller befintliga kunder.',
  },
  {
    name: 'budskap',
    number: '3',
    label: 'Huvudbudskap',
    required: true,
    help: 'Det viktigaste lyssnaren ska förstå eller komma ihåg efter att ha hört spotten.',
  },
  {
    name: 'cta',
    number: '4',
    label: 'Call to action',
    required: true,
    help: 'Vad ska lyssnaren göra? Exempel: besöka webbplatsen, boka tid, ringa, handla eller ta del av ett erbjudande.',
  },
  {
    name: 'ton',
    number: '5',
    label: 'Ton och känsla',
    required: true,
    help: 'Beskriv känslan i spotten. Exempel: trygg, snabb, säljig, varm, humoristisk, exklusiv eller informativ.',
  },
  {
    name: 'ovriga_tankar',
    number: '',
    label: 'Övriga tankar',
    required: false,
    help: 'Sådant som kan hjälpa produktionen men inte passar i något annat fält.',
  },
  {
    name: 'praktiskt',
    number: '6',
    label: 'Praktiskt',
    required: false,
    help: 'Praktiska detaljer som uttal, öppettider, webbadress, telefonnummer eller villkor som måste vara rätt.',
  },
  {
    name: 'period_detaljer',
    number: '',
    label: 'Kampanjperiod detaljer',
    required: false,
    help: 'Fyll i om det finns särskilda datum, perioder, sändningsfönster eller tidsstyrda budskap.',
  },
  {
    name: 'ovrigt',
    number: '',
    label: 'Övrigt',
    required: false,
    help: 'Övrig information som produktionen bör känna till.',
  },
  {
    name: 'tankapa',
    number: '7',
    label: 'Att tänka på',
    required: false,
    help: 'Extra viktigt: saker som absolut inte får bli fel, juridiska krav, känsliga formuleringar eller kundens egna önskemål.',
  },
] as const

const requiredFieldNames = [
  ...fields.filter((field) => field.required).map((field) => field.name),
  ...questions.filter((question) => question.required).map((question) => question.name),
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

function RequiredMark() {
  return <span className="text-[#d6202b]"> *</span>
}

function missingRequiredFields(formData: FormData) {
  return requiredFieldNames.filter((name) => {
    const value = formData.get(name)
    return typeof value !== 'string' || value.trim() === ''
  })
}

export default function OrderForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setError('')

    const form = event.currentTarget
    const formData = new FormData(form)
    const missingFields = missingRequiredFields(formData)

    if (missingFields.length > 0) {
      setError('Fyll i alla obligatoriska fält innan du skickar briefen.')
      setStatus('error')
      return
    }

    const body = Object.fromEntries(formData)

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
              <p className="mt-2 max-w-[760px] text-sm text-[#70706c]">
                Fyll i underlaget så tydligt som möjligt. Ju mer konkret briefen är, desto snabbare kan produktionen ta fram ett manus som matchar kundens behov.
              </p>
              <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#70706c]">
                <span className="text-[#d6202b]">*</span> Obligatorisk
              </p>
            </div>

            <div className="grid gap-x-4 gap-y-4 border-b border-[#dededa] p-5 md:grid-cols-2">
              {fields.map((field) => (
                <label key={field.name} className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#70706c]">
                    {field.label}
                    {field.required && <RequiredMark />}
                  </span>
                  <input
                    className="w-full border-[1.5px] border-[#dededa] bg-white px-3 py-3 text-[15px] outline-none transition focus:border-black"
                    name={field.name}
                    type={field.type}
                    required={field.required}
                  />
                  {field.help && (
                    <span className="mt-1.5 block text-[12px] leading-snug text-[#70706c]">
                      {field.help}
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div>
              {questions.map((question) => {
                const critical = question.name === 'tankapa'

                return (
                  <label
                    key={question.name}
                    className={`block border-b border-[#dededa] p-5 ${
                      critical ? 'border-l-[3px] border-l-[#d6202b] bg-[#fdf6f6]' : ''
                    }`}
                  >
                    <span className="mb-2 flex items-baseline gap-3">
                      {question.number && <span className="font-mono text-xs text-[#70706c]">{question.number}</span>}
                      <span className={`text-[16.5px] font-bold ${critical ? 'text-[#d6202b]' : 'text-black'}`}>
                        {question.label}
                        {question.required && <RequiredMark />}
                      </span>
                    </span>
                    {question.help && (
                      <span className="mb-3 block max-w-[820px] text-[13px] leading-snug text-[#70706c]">
                        {question.help}
                      </span>
                    )}
                    <textarea
                      className="min-h-28 w-full border-[1.5px] border-[#dededa] bg-white px-3 py-3 text-[15px] outline-none transition focus:border-black"
                      name={question.name}
                      required={question.required}
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
