'use client'

import { storyblokEditable } from '@storyblok/react'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { IoMdArrowForward } from 'react-icons/io'

const OrgForm = ({ blok }) => {
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState('')
  const [formData, setFormData] = useState({
    orgnr: '',
    email: '',
    foretagsnamn: '',
    faktureringsadress: '',
    referens: '',
  })

  const params = useParams()
  const isEnglish = params.lang === 'en'
  const isSubmitting = status === 'loading'

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleButtonClick = async (e) => {
    e.preventDefault()
    setStatus('loading')

    try {
      const response = await fetch('/api/organisation', {
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
      ? isEnglish
        ? 'Sending company details...'
        : 'Skickar företagsuppgifter...'
      : status === 'error'
        ? isEnglish
          ? 'The company details could not be sent. Please try again.'
          : 'Företagsuppgifterna kunde inte skickas. Försök igen.'
        : ''

  return (
    <div
      className="bg-[#F7F0EE] full-width-element no-padding-bottom"
      {...storyblokEditable(blok)}
    >
      <div className="flex w-full justify-center items-center py-10 lg:py-20 gap-10 flex-col max-md:text-center max-md:px-4">
        {!sent ? (
          <form
            className="w-full lg:max-w-[30%] m-auto flex flex-col gap-10"
            onSubmit={handleButtonClick}
          >
            <div className="flex flex-col gap-5">
              <label htmlFor="organisation-number">Orgnmr:</label>
              <input
                id="organisation-number"
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                required
                type="text"
                name="orgnr"
                autoComplete="organization"
                aria-describedby="organisation-number-help"
                value={formData.orgnr}
                onChange={handleChange}
              />
              <span id="organisation-number-help" className="sr-only">
                {isEnglish ? 'Enter the organisation number.' : 'Ange organisationsnummer.'}
              </span>
            </div>

            <div className="flex flex-col gap-5">
              <label htmlFor="organisation-company-name">Företagsnamn:</label>
              <input
                id="organisation-company-name"
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                required
                type="text"
                name="foretagsnamn"
                autoComplete="organization"
                aria-describedby="organisation-company-name-help"
                value={formData.foretagsnamn}
                onChange={handleChange}
              />
              <span id="organisation-company-name-help" className="sr-only">
                {isEnglish ? 'Enter the company name.' : 'Ange företagsnamn.'}
              </span>
            </div>

            <div className="flex flex-col gap-5">
              <label htmlFor="organisation-email">Faktureringsepost:</label>
              <input
                id="organisation-email"
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                required
                type="email"
                name="email"
                autoComplete="email"
                aria-describedby="organisation-email-help"
                value={formData.email}
                onChange={handleChange}
              />
              <span id="organisation-email-help" className="sr-only">
                {isEnglish ? 'Enter the billing email address.' : 'Ange faktureringsepost.'}
              </span>
            </div>

            <div className="flex flex-col gap-5">
              <label htmlFor="organisation-billing-address">Faktureringsadress:</label>
              <input
                id="organisation-billing-address"
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                required
                type="text"
                name="faktureringsadress"
                autoComplete="street-address"
                aria-describedby="organisation-billing-address-help"
                value={formData.faktureringsadress}
                onChange={handleChange}
              />
              <span id="organisation-billing-address-help" className="sr-only">
                {isEnglish ? 'Enter the billing address.' : 'Ange faktureringsadress.'}
              </span>
            </div>

            <div className="flex flex-col gap-5">
              <label htmlFor="organisation-reference">Referens:</label>
              <input
                id="organisation-reference"
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                type="text"
                name="referens"
                aria-describedby="organisation-reference-help"
                value={formData.referens}
                onChange={handleChange}
              />
              <span id="organisation-reference-help" className="sr-only">
                {isEnglish ? 'Enter a reference if needed.' : 'Ange referens vid behov.'}
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
              className="w-full flex gap-2 justify-end disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (isEnglish ? 'Sending' : 'Skickar') : isEnglish ? 'Send' : 'Skicka'}
              <span>
                <IoMdArrowForward fontSize={'1.3em'} color="#FF6062" />
              </span>
            </button>
          </form>
        ) : (
          <div className="lg:h-[50vh] flex items-center justify-center" aria-live="polite">
            <div>{isEnglish ? 'Thank you for your message!' : 'Tack för uppgifterna!'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrgForm
