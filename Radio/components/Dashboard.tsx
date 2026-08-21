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
  if (!deadline) return null
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const due = new Date(`${deadline}T12:00:00`)
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

function deadlineText(deadline: string | null) {
  const days = daysLeft(deadline)
  if (days === null) return 'Ingen deadline'
  if (days < 0) return 'Deadline passerad'
  if (days === 0) return 'Deadline idag'
  if (days === 1) return 'Deadline imorgon'
  return `Deadline om ${days} dagar`
}

function nextStatus(status: RadioBriefStatus) {
  const index = RADIO_BRIEF_STATUSES.indexOf(status)
  return RADIO_BRIEF_STATUSES[Math.min(index + 1, RADIO_BRIEF_STATUSES.length - 1)]
}

function previousStatus(status: RadioBriefStatus) {
  const index = RADIO_BRIEF_STATUSES.indexOf(status)
  return RADIO_BRIEF_STATUSES[Math.max(index - 1, 0)]
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

function SearchIcon() {
  return (
    <svg className="absolute left-[15px] top-[15px] opacity-45" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
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
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 1600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const counts = useMemo(() => {
    return {
      alla: briefs.length,
      ny: briefs.filter((brief) => brief.status === 'ny').length,
      manus: briefs.filter((brief) => brief.status === 'manus').length,
      inspelning: briefs.filter((brief) => brief.status === 'inspelning').length,
      levererad: briefs.filter((brief) => brief.status === 'levererad').length,
    }
  }, [briefs])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return briefs
      .filter((brief) => filter === 'alla' || brief.status === filter)
      .filter((brief) => {
        if (!normalizedQuery) return true
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
    if (!text) return
    await navigator.clipboard.writeText(text)
    setToast(`${label} kopierad`)
  }

  async function updateStatus(brief: RadioBrief, status: RadioBriefStatus) {
    if (status === brief.status) {
      return
    }

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

  async function moveForward(brief: RadioBrief) {
    await updateStatus(brief, nextStatus(brief.status))
  }

  async function moveBackward(brief: RadioBrief) {
    await updateStatus(brief, previousStatus(brief.status))
  }

  async function deleteSelectedBrief(brief: RadioBrief) {
    const confirmed = window.confirm(`Radera briefen för ${brief.kund}? Detta kan inte ångras.`)
    if (!confirmed) return

    const response = await fetch(`/api/radio-briefs/${brief.id}`, { method: 'DELETE' })
    if (!response.ok) {
      setToast('Briefen kunde inte raderas')
      return
    }

    setBriefs((current) => current.filter((item) => item.id !== brief.id))
    setSelected(null)
    setToast('Briefen raderades')
  }

  async function logout() {
    await fetch('/api/radio-auth/logout', { method: 'POST' })
    window.location.reload()
  }

  return (
    <main className="min-h-screen bg-[#f3f3f1] pb-24 text-[15px] leading-[1.45] text-[#0b0b0b] antialiased">
      <header className="sticky top-0 z-40 border-b-[1.5px] border-black bg-[#f3f3f1]/95 backdrop-blur">
        <div className="mx-auto max-w-[1200px] px-[18px] pb-0 pt-3">
          <div className="flex items-center gap-3">
            <Mark />
            <div className="font-sans text-[19px] font-extrabold uppercase tracking-normal text-black">
              BK <span className="ml-2 text-sm font-medium normal-case text-[#70706c]">Inkomna radiobriefer</span>
            </div>
            <button
              className="ml-auto border-[1.5px] border-black px-3 py-1.5 text-[13px] font-medium transition hover:bg-black hover:text-white"
              onClick={logout}
            >
              Logga ut
            </button>
          </div>

          <div className="relative mt-3">
            <SearchIcon />
            <input
              className="w-full border-[1.5px] border-[#dededa] bg-white py-[13px] pl-11 pr-12 text-[17px] outline-none transition focus:border-black"
              placeholder="Sök kund, Order-ID, säljare eller kontaktperson..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="absolute right-3 top-3.5 border border-[#dededa] px-1.5 py-0.5 font-mono text-[11px] text-[#70706c]">/</span>
          </div>

          <nav className="mt-3 flex overflow-x-auto">
            {(['alla', ...RADIO_BRIEF_STATUSES] as const).map((status) => (
              <button
                key={status}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-[2.5px] px-3.5 py-2 text-sm font-medium transition ${
                  filter === status
                    ? status === 'ny'
                      ? 'border-[#d6202b] text-[#d6202b]'
                      : 'border-black text-black'
                    : 'border-transparent text-[#70706c] hover:text-black'
                }`}
                onClick={() => setFilter(status)}
              >
                {status === 'alla' ? 'Alla' : labels[status]}
                <span className={`border px-1.5 py-px font-mono text-[11.5px] ${filter === status ? 'border-black' : 'border-[#dededa]'}`}>
                  {counts[status]}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-[18px]">
        <section className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-3.5">
          {loading && <p>Laddar briefer...</p>}
          {!loading && filtered.length === 0 && (
            <div className="col-span-full border-[1.5px] border-dashed border-[#dededa] p-[60px_20px] text-center text-[#70706c]">
              <h3 className="m-0 mb-1.5 text-xl font-bold text-black">Inga briefer matchar urvalet.</h3>
            </div>
          )}

          {filtered.map((brief) => {
            const hot = brief.status !== 'levererad' && (daysLeft(brief.deadline) ?? 99) <= 2
            const stageIndex = RADIO_BRIEF_STATUSES.indexOf(brief.status)

            return (
              <button
                key={brief.id}
                className={`flex min-h-[230px] flex-col border-[1.5px] bg-white text-left transition hover:-translate-y-0.5 hover:border-black focus:outline-[#d6202b] ${
                  selected?.id === brief.id ? 'border-black' : 'border-[#dededa]'
                } ${brief.status === 'levererad' ? 'opacity-60 hover:opacity-100' : ''}`}
                onClick={() => setSelected(brief)}
              >
                <div className="border-b border-[#dededa] px-4 py-3.5">
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <div className="flex w-5 flex-col gap-[2.5px]">
                      {RADIO_BRIEF_STATUSES.map((status, index) => (
                        <span
                          key={status}
                          className={`h-[2.5px] ${
                            index <= stageIndex
                              ? brief.status === 'ny'
                                ? 'bg-[#d6202b]'
                                : 'bg-black'
                              : 'bg-[#dededa]'
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${brief.status === 'ny' ? 'text-[#d6202b]' : 'text-black'}`}>
                      {labels[brief.status]}
                    </span>
                    <span className="ml-auto font-mono text-xs text-[#70706c]">{brief.order_id}</span>
                  </div>
                  <h2 className="text-2xl font-bold leading-[1.1] tracking-normal text-black">{brief.kund}</h2>
                  <p className="mt-1 text-[13px] text-[#70706c]">
                    {brief.kontaktperson || 'Ingen kontakt'} - säljare {brief.saljare || 'saknas'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 px-4 py-3">
                  <span className="border border-[#dededa] px-2 py-1 font-mono text-[11.5px]">{brief.format || 'Format saknas'}</span>
                  <span className="border border-[#dededa] px-2 py-1 font-mono text-[11.5px]">{brief.antal_spottar || 'Antal saknas'}</span>
                  <span className={`border px-2 py-1 font-mono text-[11.5px] ${hot ? 'border-[#d6202b] bg-[#fdecec] text-[#d6202b]' : 'border-black'}`}>
                    {deadlineText(brief.deadline)}
                  </span>
                </div>

                <p className="line-clamp-2 px-4 pb-3 text-[13.5px] text-[#70706c]">
                  <strong className="font-semibold text-black">Budskap:</strong> {brief.budskap || 'Saknas'}
                </p>

                <div className="mt-auto flex border-t border-[#dededa]">
                  <span className="flex-1 border-r border-[#dededa] px-2 py-3 text-center text-[12.5px] font-medium text-[#70706c]">
                    Öppna brief
                  </span>
                  <span className="flex-1 px-2 py-3 text-center text-[12.5px] font-medium text-[#70706c]">
                    {labels[brief.status]}
                  </span>
                </div>
              </button>
            )
          })}
        </section>
      </div>

      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition ${selected ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setSelected(null)}
      />

      <aside
        className={`fixed bottom-0 right-0 top-0 z-[70] w-full max-w-[560px] overflow-y-auto border-l-[1.5px] border-black bg-white transition duration-300 ${
          selected ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Brief"
      >
        {selected && (
          <div>
            <div className="sticky top-0 z-10 border-b-[1.5px] border-black bg-white px-5 py-4">
              <button
                className="absolute right-4 top-3.5 h-8 w-8 border-[1.5px] border-[#dededa] text-base hover:border-black"
                onClick={() => setSelected(null)}
                aria-label="Stäng"
              >
                ×
              </button>
              <h2 className="pr-10 text-[27px] font-bold leading-[1.1] tracking-normal text-black">{selected.kund}</h2>
              <p className="mt-1 font-mono text-xs text-[#70706c]">
                {selected.order_id || 'Utan order-id'} - {selected.format || 'Format saknas'} - {deadlineText(selected.deadline)}
              </p>
            </div>

            <div className="border-b border-[#dededa] px-5 py-4">
              <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#70706c]">Kontakt och kampanj</h3>
              {([
                ['Kontakt', selected.kontaktperson],
                ['Telefon', selected.telefon],
                ['E-post', selected.epost],
                ['Säljare', selected.saljare],
                ['Period', selected.kampanjperiod],
                ['Format', selected.format],
                ['Antal', selected.antal_spottar],
              ] as Array<[string, string | null]>).map(([label, value]) => (
                <button
                  key={label}
                  className="grid w-full grid-cols-[96px_1fr_22px] items-center gap-2.5 border-b border-dotted border-[#dededa] py-2 pl-0 pr-2 text-left hover:bg-[#fafaf8]"
                  onClick={() => copy(value, label)}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#70706c]">{label}</span>
                  <span className="overflow-wrap-anywhere text-[15px]">{value || 'Saknas'}</span>
                  <span className="text-right text-[#70706c] opacity-0 group-hover:opacity-100">⌘</span>
                </button>
              ))}
            </div>

            {sections.map(([number, title, key]) => {
              const value = selected[key] ? String(selected[key]) : ''
              const critical = key === 'tankapa'

              return (
                <button
                  key={key}
                  className={`block w-full border-b border-[#dededa] px-5 py-4 text-left transition hover:bg-[#fafaf8] ${
                    critical ? 'border-l-[3px] border-l-[#d6202b] bg-[#fdf6f6] hover:bg-[#fcefef]' : ''
                  }`}
                  onClick={() => copy(value, title)}
                >
                  <div className="mb-1.5 flex items-baseline gap-2.5">
                    {number && <span className="shrink-0 font-mono text-xs text-[#70706c]">{number}</span>}
                    <h3 className={`text-[16.5px] font-semibold tracking-normal ${critical ? 'text-[#d6202b]' : 'text-black'}`}>
                      {title}
                    </h3>
                    {value && <span className="ml-auto shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#70706c]">Kopiera</span>}
                  </div>
                  <p className={`whitespace-pre-wrap text-[15px] ${value ? '' : 'italic text-[#70706c]'}`}>
                    {value || 'Kunden lämnade fältet tomt'}
                  </p>
                </button>
              )
            })}

            <div className="sticky bottom-0 flex gap-2 border-t-[1.5px] border-black bg-white px-5 py-3">
              <button className="flex-1 border-[1.5px] border-black px-3 py-3 text-sm font-medium hover:bg-[#f0f0ec]" onClick={() => copy(fullText(selected), 'Hela briefen')}>
                Kopiera hela briefen
              </button>
              <button
                className="border-[1.5px] border-black px-3 py-3 text-sm font-medium hover:bg-[#f0f0ec] disabled:opacity-40"
                disabled={selected.status === 'ny'}
                onClick={() => moveBackward(selected)}
              >
                Tillbaka
              </button>
              <button className="border-[1.5px] border-[#d6202b] px-3 py-3 text-sm font-medium text-[#d6202b]" onClick={() => deleteSelectedBrief(selected)}>
                Radera
              </button>
              <button
                className="flex-1 bg-black px-3 py-3 text-sm font-medium text-white hover:bg-[#2a2a28] disabled:opacity-60"
                disabled={selected.status === 'levererad'}
                onClick={() => moveForward(selected)}
              >
                {selected.status === 'levererad' ? 'Levererad' : `Flytta till ${labels[nextStatus(selected.status)].toLowerCase()}`}
              </button>
            </div>
          </div>
        )}
      </aside>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 bg-black px-[18px] py-3 text-sm font-medium text-white">
          {toast}
        </div>
      )}
    </main>
  )
}
