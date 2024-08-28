import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { name, email, message, file, praktik } = await req.json()

  const messageBody = `
    <div style="background-color: #f9f9f9; padding: 20px;">
      <p>Meddelande från: ${name}</p>
      <h3>Email: ${email}</h3>
      <p>Jag skulle vilja praktisera som: ${praktik}</p>
      <p>Meddelande: ${message}</p>
    </div>
  `
  try {
    const { data, error } = await resend.emails.send({
      from: `BK-Karriar: ${name} <onboarding@resend.dev>`,
      to: ['info@bastakompisar.se'],
      subject: 'Notifikation från BK Karriar',
      html: messageBody,
      attachments: [
        {
          content: file,
          filename: 'CV/annat.pdf',
        },
      ],
    })

    if (error) {
      return Response.json({ error }, { status: 500 })
    }

    return Response.json(data)
  } catch (error) {
    return Response.json({ error }, { status: 500 })
  }
}
