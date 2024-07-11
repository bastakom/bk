import nodemailer from 'nodemailer'

const usermail = 'philip@anlander.se'

export async function POST(req: Request) {
  const { name, email, message } = await req.json()

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'sentemailform@gmail.com',
      pass: 'poxmwlharcpoidqt',
    },
  })

  const messageBody = `
    <div style="background-color: #f9f9f9; padding: 20px;">
      <p>Meddelande från: ${name}</p>
      <h3>Email: ${email}</h3>
      <p>Meddelande: ${message}</p>
    </div>
  `

  try {
    transporter.sendMail({
      from: `${email}`,
      to: usermail,
      subject: `New message from ${name}`,
      html: messageBody,
      attachments: [
        {
          filename: 'document.pdf', // Name of the file
        },
      ],
    })
    return Response.json({ message: 'works' }, { status: 200 })
  } catch (error) {
    return Response.json({ error: 'Urls GET Error' }, { status: 500 })
  }
}
