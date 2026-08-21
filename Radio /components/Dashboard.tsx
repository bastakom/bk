'use client'

import { useEffect, useMemo, useState } from 'react'
import { RadioBrief, RADIO_BRIEF_STATUSES, RadioBriefStatus } from '@/Radio/lib/types'

const labels: Record<RadioBriefStatus, string> = {
  ny: 'Ny brief',
  manus: 'Manus',
  inspelning: 'Inspelning',
  levererad: 'Levererad',
}

const sections: Array<[string, string, keyof RadioBrief]> = [
  ['1', 'Syfte med kampanjen', 'syfte'],
  ['2', 'Målgrupp', 'malgrupp'],
  ['3', 'Huvudbudskap', 'budskap'],
  ['4', 'Call to action', 'cta'],
  ['5', 'Ton och känsla', 'ton'],
  ['', 'Övriga tankar', 'ovriga_tankar'],
  ['6', 'Praktiskt', 'praktiskt'],
  ['', 'Kampanjperiod detaljer', 'period_detaljer'],
  ['', 'Övrigt', 'ovrigt'],
  ['7', 'Att tänka på', 'tankapa'],
]

function daysLeft(deadline: string | null) {
  if (!deadline) {
    return null
  }

  const today = new Date()
  today.setHours(12, 0, 0, 0)

  const due = new Date(`${deadline}T12:00:00`)
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

function deadlineText(deadline: string | null) {
  const days = daysLeft(deadline)

  if (days === null) {
    return 'Ingen deadline'
  }

  if (days < 0) {
    return 'Deadline passerad'
  }

  if (days === 0) {
    return 'Deadline idag'
  }

  if (days === 1) {
    return 'Deadline imorgon'
  }

  return `Deadline om ${days} dagar`
}

function nextStatus(status: RadioBriefStatus) {
  const index = RADIO_BRIEF_STATUSES.indexOf(status)
  return RADIO_BRIEF_STATUSES[Math.min(index + 1, RADIO_BRIEF_STATUSES.length - 1)]
}

function fullText(brief: RadioBrief) {
  const meta = [
    `${brief.kund} - ${brief.order_id || 'utan order-id'}`,
    `Kontakt: ${brief.kontaktperson || ''}, ${brief.telefon || ''}, ${brief.epost || ''}`,
    `Säljare: ${brief.saljare || ''}`,
    `Kampanjperiod: ${brief.kampanjperiod || ''}`,
    `Format: ${brief.format || ''} - ${brief.antal_spottar || ''}`,
    `Deadline: ${brief.deadline || ''}`,
  ].join('\n')

  const content = sections
    .filter(([, , key]) => brief[key])
    .map(([number, title, key]) => `${number ? `${number}. ` : ''}${title.toUpperCase()}\n${brief[key]}`)
    .join('\n\n')

  return `${meta}\n\n${content}`
}

export default function Dashboard() {
  const [briefs, setBriefs] = useState<RadioBrief[]>([])
  const [selected, setSelected] = useState<RadioBrief | null>(null)
  const [filter, setFilter] = useState<RadioBriefStatus | 'alla'>('alla')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/api/radio-briefs')
      .then((response) => response.json())
      .then((data) => {
        setBriefs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeout = window.setTimeout(() => setToast(''), 1600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return briefs
      .filter((brief) => filter === 'alla' || brief.status === filter)
      .filter((brief) => {
        if (!normalizedQuery) {
          return true
        }

        return [
          brief.kund,
          brief.order_id,
          brief.kontaktperson,
          brief.saljare,
          brief.telefon,
          brief.epost,
          brief.budskap,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      })
  }, [briefs, filter, query])

  async function copy(text: string | null, label: string) {
    if (!text) {
      return
    }

    await navigator.clipboard.writeText(text)
    setToast(`${label} kopierad`)
  }

  async function moveForward(brief: RadioBrief) {
    const status = nextStatus(brief.status)

    const response = await fetch(`/api/radio-briefs/${brief.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })

    if (!response.ok) {
      setToast('Status kunde inte uppdateras')
      return
    }

    const updated = await response.json()
    setBriefs((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    setSelected(updated)
    setToast(`${updated.kund} flyttad till ${labels[updated.status as RadioBriefStatus].toLowerCase()}`)
  }

  async function logout() {
    await fetch('/api/radio-auth/logout', { method: 'POST' })
    window.location.reload()
  }

  return (
    <main className="min-h-screen bg-[#f3f3f1] text-[#0b0b0b]">
      <header className="sticky top-0 z-20 border-b-2 border-black bg-[#f3f3f1]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex w-7 flex-col gap-1">
              <span className="h-0.5 bg-black" />
              <span className="h-0.5 w-2/3 bg-black" />
              <span className="h-0.5 w-5/6 bg-black" />
              <span className="h-0.5 bg-black" />
            </div>
            <h1 className="text-2xl font-bold text-black">Inkomna radiobriefer</h1>
            <button className="ml-auto border border-black px-3 py-2 text-sm font-semibold" onClick={logout}>
              Logga ut
            </button>
          </div>

          <input
            className="w-full border border-[#dededa] bg-white px-4 py-3 outline-none focus:border-black"
            placeholder="Sök kund, order-id, säljare eller kontaktperson"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <nav className="flex gap-2 overflow-x-auto">
            {(['alla', ...RADIO_BRIEF_STATUSES] as const).map((status) => (
              <button
                key={status}
                className={`whitespace-nowrap border px-3 py-2 text-sm font-semibold ${
                  filter === status ? 'border-black bg-black text-white' : 'border-[#dededa] bg-white'
                }`}
                onClick={() => setFilter(status)}
              >
                {status === 'alla' ? 'Alla' : labels[status]}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[1fr_520px]">
        <section className="grid content-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading && <p>Laddar briefer...</p>}
          {!loading && filtered.length === 0 && (
            <div className="border border-dashed border-[#dededa] bg-white p-8 text-[#70706c] md:col-span-2 xl:col-span-3">
              Inga briefer matchar urvalet.
            </div>
          )}
          {filtered.map((brief) => {
            const hot = brief.status !== 'levererad' && (daysLeft(brief.deadline) ?? 99) <= 2

            return (
              <button
                key={brief.id}
                className={`border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-black ${
                  selected?.id === brief.id ? 'border-black' : 'border-[#dededa]'
                } ${brief.status === 'levererad' ? 'opacity-60' : ''}`}
                onClick={() => setSelected(brief)}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex w-5 flex-col gap-1">
                    {RADIO_BRIEF_STATUSES.map((status, index) => (
                      <span
                        key={status}
                        className={`h-0.5 ${
                          index <= RADIO_BRIEF_STATUSES.indexOf(brief.status)
                            ? brief.status === 'ny'
                              ? 'bg-[#d6202b]'
                              : 'bg-black'
                            : 'bg-[#dededa]'
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-[0.1em] ${brief.status === 'ny' ? 'text-[#d6202b]' : ''}`}>
                    {labels[brief.status]}
                  </span>
                  <span className="ml-auto text-xs text-[#70706c]">{brief.order_id}</span>
                </div>

                <h2 className="text-2xl font-bold leading-tight text-black">{brief.kund}</h2>
                <p className="mt-1 text-sm text-[#70706c]">
                  {brief.kontaktperson || 'Ingen kontakt'} - säljare {brief.saljare || 'saknas'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="border border-[#dededa] px-2 py-1">{brief.format || 'Format saknas'}</span>
                  <span className="border border-[#dededa] px-2 py-1">{brief.antal_spottar || 'Antal saknas'}</span>
                  <span className={`border px-2 py-1 ${hot ? 'border-[#d6202b] bg-[#fdecec] text-[#d6202b]' : 'border-black'}`}>
                    {deadlineText(brief.deadline)}
                  </span>
                </div>
                <p className="mt-4 line-clamp-2 text-sm text-[#70706c]">
                  <strong className="text-black">Budskap:</strong> {brief.budskap || 'Saknas'}
                </p>
              </button>
            )
          })}
        </section>

        <aside className="min-h-[520px] border border-black bg-white">
          {!selected ? (
            <div className="p-6 text-[#70706c]">Välj en brief i listan.</div>
          ) : (
            <div>
              <div className="sticky top-[148px] border-b border-black bg-white p-5">
                <h2 className="pr-8 text-3xl font-bold leading-tight text-black">{selected.kund}</h2>
                <p className="mt-1 text-sm text-[#70706c]">
                  {selected.order_id || 'Utan order-id'} - {selected.format || 'Format saknas'} - {deadlineText(selected.deadline)}
                </p>
              </div>

              <div className="border-b border-[#dededa] p-5">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#70706c]">
                  Kontakt och kampanj
                </h3>
                {[
                  ['Kontakt', selected.kontaktperson],
                  ['Telefon', selected.telefon],
                  ['E-post', selected.epost],
                  ['Säljare', selected.saljare],
                  ['Period', selected.kampanjperiod],
                  ['Format', selected.format],
                  ['Antal', selected.antal_spottar],
                ].map(([label, value]) => (
                  <button
                    key={label}
                    className="grid w-full grid-cols-[100px_1fr] gap-3 border-b border-dotted border-[#dededa] py-2 text-left hover:bg-[#fafaf8]"
                    onClick={() => copy(value, label)}
                  >
                    <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#70706c]">{label}</span>
                    <span>{value || 'Saknas'}</span>
                  </button>
                ))}
              </div>

              {sections.map(([number, title, key]) => {
                const value = selected[key] ? String(selected[key]) : ''
                const critical = key === 'tankapa'

                return (
                  <button
                    key={key}
                    className={`block w-full border-b p-5 text-left hover:bg-[#fafaf8] ${
                      critical ? 'border-l-4 border-l-[#d6202b] bg-[#fdf6f6]' : 'border-[#dededa]'
                    }`}
                    onClick={() => copy(value, title)}
                  >
                    <div className="mb-2 flex items-baseline gap-3">
                      {number && <span className="text-xs text-[#70706c]">{number}</span>}
                      <h3 className={`font-bold ${critical ? 'text-[#d6202b]' : 'text-black'}`}>{title}</h3>
                      {value && <span className="ml-auto text-xs font-bold uppercase tracking-[0.08em] text-[#70706c]">Kopiera</span>}
                    </div>
                    <p className={`whitespace-pre-wrap ${value ? '' : 'italic text-[#70706c]'}`}>
                      {value || 'Kunden lämnade fältet tomt'}
                    </p>
                  </button>
                )
              })}

              <div className="sticky bottom-0 flex gap-2 border-t border-black bg-white p-4">
                <button
                  className="flex-1 border border-black px-4 py-3 font-semibold"
                  onClick={() => copy(fullText(selected), 'Hela briefen')}
                >
                  Kopiera hela briefen
                </button>
                <button
                  className="flex-1 bg-black px-4 py-3 font-semibold text-white disabled:opacity-60"
                  disabled={selected.status === 'levererad'}
                  onClick={() => moveForward(selected)}
                >
                  {selected.status === 'levererad'
                    ? 'Levererad'
                    : `Flytta till ${labels[nextStatus(selected.status)].toLowerCase()}`}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 bg-black px-5 py-3 text-sm font-semibold text-white">
          {toast}
        </div>
      )}
    </main>
  )
}
