import { NextResponse } from 'next/server'

import { getRadioSql } from '@/Radio/lib/db'

export async function GET(req: Request) {
  const configuredSecret = process.env.RADIO_INIT_SECRET
  const providedSecret = new URL(req.url).searchParams.get('secret')

  if (!configuredSecret) {
    return NextResponse.json(
      { ok: false, error: 'RADIO_INIT_SECRET saknas i Vercel.' },
      { status: 500 }
    )
  }

  if (!providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json(
      { ok: false, error: 'Fel eller saknad secret.' },
      { status: 401 }
    )
  }

  const sql = getRadioSql()

  await sql`
    create table if not exists radio_briefs (
      id              bigserial primary key,
      order_id        text,
      kund            text not null,
      kontaktperson   text,
      telefon         text,
      epost           text,
      saljare         text,
      kampanjperiod   text,
      format          text,
      antal_spottar   text,

      syfte           text,
      malgrupp        text,
      budskap         text,
      cta             text,
      ton             text,
      ovriga_tankar   text,
      praktiskt       text,
      period_detaljer text,
      ovrigt          text,
      tankapa         text,

      status          text not null default 'ny'
                      check (status in ('ny', 'manus', 'inspelning', 'levererad')),
      deadline        date,
      skapad          timestamptz not null default now(),
      uppdaterad      timestamptz not null default now()
    )
  `

  await sql`
    create index if not exists radio_briefs_status_deadline_idx
      on radio_briefs (status, deadline)
  `

  await sql`
    create index if not exists radio_briefs_created_idx
      on radio_briefs (skapad desc)
  `

  return NextResponse.json({
    ok: true,
    message: 'radio_briefs-tabellen finns nu.',
  })
}
