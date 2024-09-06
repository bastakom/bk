import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { orgnr, email, foretagsnamn, faktureringsadress, referens } =
    await req.json()

  const messageBody = `
    <div style="background-color: #f9f9f9; padding: 20px;">
      <p>Orgnr: ${orgnr}</p>
      <p>Företagsnamn: ${foretagsnamn}</p>
      <h3>Faktureringsepost: ${email}</h3>
      <p>Faktureringsadress: ${faktureringsadress}</p>
      <p>Referens: ${referens}</p>
    </div>
  `
  try {
    const { data, error } = await resend.emails.send({
      from: 'Notifikation: BK-origanisation <onboarding@resend.dev>',
      to: ['info@bastakompisar.se'],
      subject: 'Notifikation från BK origanisation',
      html: messageBody,
    })

    if (error) {
      return Response.json({ error }, { status: 500 })
    }

    return Response.json(data)
  } catch (error) {
    return Response.json({ error }, { status: 500 })
  }
}
