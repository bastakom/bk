'use client'

import { useState } from 'react'
import { render } from 'storyblok-rich-text-react-renderer'

interface Props {
  props: any
}

const FormBlock = ({ props }: Props) => {
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  })

  const isSubmitting = status === 'loading'

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleButtonClick = async (e: any) => {
    e.preventDefault()
    setStatus('loading')

    try {
      const response = await fetch('/sv/api/form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setStatus('success')
        setSent(true)
      } else {
        setStatus('error')
        setSent(false)
      }
    } catch (error) {
      console.error('Error sending message.', error)
      setStatus('error')
      setSent(false)
    }
  }

  const statusMessage =
    status === 'loading'
      ? 'Skickar meddelande...'
      : status === 'error'
        ? 'Meddelandet kunde inte skickas. Försök igen.'
        : ''

  return (
    <div className="flex w-full justify-center items-center py-20 gap-10 flex-col">
      <h1 className="text-[20px] uppercase font-normal">{props.title}</h1>
      <span className="text-[30px] font-normal">{render(props.content)}</span>
      <span className="text-[20px] font-normal text-center">
        {render(props.adress)}
      </span>

      {!sent ? (
        <form
          className="w-full lg:max-w-[30%] m-auto flex flex-col gap-10"
          onSubmit={handleButtonClick}
        >
          <div className="flex flex-col gap-5">
            <label htmlFor="formblock-name">Hej Bästa Kompisar, mitt namn är…*</label>
            <input
              id="formblock-name"
              className="bg-transparent border border-black rounded-[22px] py-2 px-5"
              required
              type="text"
              name="name"
              autoComplete="name"
              aria-describedby="formblock-name-help"
              value={formData.name}
              onChange={handleChange}
            />
            <span id="formblock-name-help" className="sr-only">
              Ange ditt namn.
            </span>
          </div>

          <div className="flex flex-col gap-5">
            <label htmlFor="formblock-email">Ni kan kontakta mig på min e-postadress…*</label>
            <input
              id="formblock-email"
              className="bg-transparent border border-black rounded-[22px] py-2 px-5"
              required
              type="email"
              name="email"
              autoComplete="email"
              aria-describedby="formblock-email-help"
              value={formData.email}
              onChange={handleChange}
            />
            <span id="formblock-email-help" className="sr-only">
              Ange din e-postadress.
            </span>
          </div>

          <div className="w-full flex flex-col gap-4">
            <label htmlFor="formblock-message">Jag skulle vilja veta mer om…*</label>
            <textarea
              id="formblock-message"
              className="bg-transparent border border-black rounded-[22px] py-5 px-5"
              required
              rows={10}
              name="message"
              aria-describedby="formblock-message-help"
              value={formData.message}
              onChange={handleChange}
            />
            <span id="formblock-message-help" className="sr-only">
              Skriv ditt meddelande.
            </span>
          </div>

          <div>
            <label htmlFor="formblock-pdf-file" className="flex items-start md:items-center gap-2">
              GDPR
            </label>
          </div>

          <div>
            <input
              type="file"
              id="formblock-pdf-file"
              name="pdfFile"
              accept=".pdf"
              required
              aria-describedby="formblock-pdf-file-help"
            />
            <span id="formblock-pdf-file-help" className="sr-only">
              Ladda upp en PDF-fil.
            </span>
          </div>

          <div aria-live="polite" aria-atomic="true">
            {statusMessage && (
              <p className={status === 'error' ? 'text-red-700' : 'sr-only'} role={status === 'error' ? 'alert' : undefined}>
                {statusMessage}
              </p>
            )}
          </div>

          <button
            className="button primary m-auto disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Skickar' : 'Skicka'}
          </button>
        </form>
      ) : (
        <div className="lg:h-[50vh] flex items-center justify-center" aria-live="polite">
          <div>TACK</div>
        </div>
      )}
    </div>
  )
}

export default FormBlock
