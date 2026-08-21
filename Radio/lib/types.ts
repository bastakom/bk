export const RADIO_BRIEF_STATUSES = [
  'ny',
  'manus',
  'inspelning',
  'levererad',
] as const

export type RadioBriefStatus = (typeof RADIO_BRIEF_STATUSES)[number]

export type RadioBrief = {
  id: number
  order_id: string | null
  kund: string
  kontaktperson: string | null
  telefon: string | null
  epost: string | null
  saljare: string | null
  kampanjperiod: string | null
  format: string | null
  antal_spottar: string | null
  syfte: string | null
  malgrupp: string | null
  budskap: string | null
  cta: string | null
  ton: string | null
  ovriga_tankar: string | null
  praktiskt: string | null
  period_detaljer: string | null
  ovrigt: string | null
  tankapa: string | null
  status: RadioBriefStatus
  deadline: string | null
  skapad: string
}

export function isRadioBriefStatus(value: unknown): value is RadioBriefStatus {
  return (
    typeof value === 'string' &&
    RADIO_BRIEF_STATUSES.includes(value as RadioBriefStatus)
  )
}
