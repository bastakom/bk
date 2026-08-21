import { Resend } from 'resend'
import { getRadioSql } from '@/Radio/lib/db'
import { isRadioDashboardAuthenticated } from '@/Radio/lib/auth'
import { isRadioBriefStatus } from '@/Radio/lib/types'

const ORDER_ORIGIN = 'https://order.bastakompisar.se'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ORDER_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function value(data: Record<string, unknown>, key: string) {
  const raw = data[key]

  if (typeof raw !== 'string') {
    return null
  }

  const trimmed = raw.trim()
  return trimmed ? trimmed : null
}

function escapeHtml(input: string | null) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendNotification(brief: Record<string, string | null>) {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.RADIO_BRIEF_NOTIFICATION_TO

  if (!apiKey || !to) {
    return
  }

  const resend = new Resend(apiKey)
  const from = process.env.RADIO_BRIEF_FROM || 'Radiobriefer <onboarding@resend.dev>'
  const dashboardUrl =
    process.env.RADIO_DASHBOARD_URL || 'https://order.bastakompisar.se/dashboard'

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2>Ny radiobrief: ${escapeHtml(brief.kund)}</h2>
      <p><strong>Order-ID:</strong> ${escapeHtml(brief.order_id)}</p>
      <p><strong>Kontakt:</strong> ${escapeHtml(brief.kontaktperson)}</p>
      <p><strong>Telefon:</strong> ${escapeHtml(brief.telefon)}</p>
      <p><strong>E-post:</strong> ${escapeHtml(brief.epost)}</p>
      <p><strong>Säljare:</strong> ${escapeHtml(brief.saljare)}</p>
      <p><strong>Kampanjperiod:</strong> ${escapeHtml(brief.kampanjperiod)}</p>
      <p><strong>Format:</strong> ${escapeHtml(brief.format)}</p>
      <p><strong>Antal spottar:</strong> ${escapeHtml(brief.antal_spottar)}</p>
      <hr>
      <p><strong>Huvudbudskap:</strong><br>${escapeHtml(brief.budskap)}</p>
      <p><a href="${escapeHtml(dashboardUrl)}">Öppna dashboarden</a></p>
    </div>
  `

  await resend.emails.send({
    from,
    to: [to],
    subject: `Ny radiobrief: ${brief.kund || 'utan kundnamn'}`,
    html,
  })
}

export async function options() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function listBriefs() {
  if (!isRadioDashboardAuthenticated()) {
    return Response.json({ error: 'Inte inloggad' }, { status: 401 })
  }

  const sql = getRadioSql()
  const rows = await sql`
    select *
    from radio_briefs
    order by deadline nulls last, skapad desc
  `

  return Response.json(rows)
}

export async function createBrief(req: Request) {
  const data = await req.json().catch(() => null)

  if (!data || typeof data !== 'object') {
    return Response.json(
      { error: 'Ogiltig data' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const d = data as Record<string, unknown>

  if (value(d, 'website')) {
    return Response.json({ ok: true }, { headers: CORS_HEADERS })
  }

  const brief = {
    order_id: value(d, 'order_id'),
    kund: value(d, 'kund'),
    kontaktperson: value(d, 'kontaktperson'),
    telefon: value(d, 'telefon'),
    epost: value(d, 'epost'),
    saljare: value(d, 'saljare'),
    kampanjperiod: value(d, 'kampanjperiod'),
    format: value(d, 'format'),
    antal_spottar: value(d, 'antal_spottar'),
    syfte: value(d, 'syfte'),
    malgrupp: value(d, 'malgrupp'),
    budskap: value(d, 'budskap'),
    cta: value(d, 'cta'),
    ton: value(d, 'ton'),
    ovriga_tankar: value(d, 'ovriga_tankar'),
    praktiskt: value(d, 'praktiskt'),
    period_detaljer: value(d, 'period_detaljer'),
    ovrigt: value(d, 'ovrigt'),
    tankapa: value(d, 'tankapa'),
    deadline: value(d, 'deadline'),
  }

  if (!brief.kund) {
    return Response.json(
      { error: 'Kund måste fyllas i' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const sql = getRadioSql()
  const insertedRows = await sql`
    insert into radio_briefs
      (order_id, kund, kontaktperson, telefon, epost, saljare,
       kampanjperiod, format, antal_spottar,
       syfte, malgrupp, budskap, cta, ton, ovriga_tankar,
       praktiskt, period_detaljer, ovrigt, tankapa, deadline)
    values
      (${brief.order_id}, ${brief.kund}, ${brief.kontaktperson},
       ${brief.telefon}, ${brief.epost}, ${brief.saljare},
       ${brief.kampanjperiod}, ${brief.format}, ${brief.antal_spottar},
       ${brief.syfte}, ${brief.malgrupp}, ${brief.budskap}, ${brief.cta},
       ${brief.ton}, ${brief.ovriga_tankar}, ${brief.praktiskt},
       ${brief.period_detaljer}, ${brief.ovrigt}, ${brief.tankapa},
       ${brief.deadline})
    returning *
  ` as Array<Record<string, unknown>>
  const [inserted] = insertedRows

  try {
    await sendNotification(brief)
  } catch (error) {
    console.error('Kunde inte skicka radiobrief-notis', error)
  }

  return Response.json({ ok: true, brief: inserted }, { headers: CORS_HEADERS })
}

export async function updateBriefStatus(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!isRadioDashboardAuthenticated()) {
    return Response.json({ error: 'Inte inloggad' }, { status: 401 })
  }

  const id = Number(params.id)

  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: 'Ogiltigt id' }, { status: 400 })
  }

  const { status } = await req.json().catch(() => ({ status: null }))

  if (!isRadioBriefStatus(status)) {
    return Response.json({ error: 'Ogiltig status' }, { status: 400 })
  }

  const sql = getRadioSql()
  const updatedRows = await sql`
    update radio_briefs
    set status = ${status}, uppdaterad = now()
    where id = ${id}
    returning *
  ` as Array<Record<string, unknown>>
  const [updated] = updatedRows

  if (!updated) {
    return Response.json({ error: 'Briefen hittades inte' }, { status: 404 })
  }

  return Response.json(updated)
}
