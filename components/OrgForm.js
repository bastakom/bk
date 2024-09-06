import { storyblokEditable } from '@storyblok/react/rsc'
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

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleButtonClick = async (e) => {
    e.preventDefault()
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
    }
  }

  return (
    <div
      className="bg-[#F7F0EE] full-width-element no-padding-bottom"
      {...storyblokEditable(blok)}
    >
      <div className="flex w-full justify-center items-center py-10 lg:py-20 gap-10 flex-col max-md:text-center max-md:px-4">
        {!sent ? (
          <form
            className={`w-full lg:max-w-[30%] m-auto flex flex-col gap-10`}
            onSubmit={handleButtonClick}
          >
            <div className={`flex flex-col gap-5`}>
              <label>{params.lang === 'en' ? 'Orgnmr: ' : 'Orgnmr: '}</label>
              <input
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                required
                type="text"
                name="orgnr"
                value={formData.orgnr}
                onChange={handleChange}
              />
            </div>
            <div className={`flex flex-col gap-5`}>
              <label>
                {params.lang === 'en' ? 'Företagsnamn: ' : 'Företagsnamn: '}
              </label>
              <input
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                required
                type="text"
                name="foretagsnamn"
                value={formData.foretagsnamn}
                onChange={handleChange}
              />
            </div>
            <div className={`flex flex-col gap-5`}>
              <label>
                {params.lang === 'en'
                  ? 'Faktureringsepost:'
                  : 'Faktureringsepost:'}
              </label>
              <input
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                type="email"
                onChange={handleChange}
                name="email"
                value={formData.email}
              />
            </div>
            <div className={`flex flex-col gap-5`}>
              <label>
                {params.lang === 'en'
                  ? 'Faktureringsadress:'
                  : 'Faktureringsadress:'}
              </label>
              <input
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                type="text"
                onChange={handleChange}
                name="faktureringsadress"
                value={formData.faktureringsadress}
              />
            </div>
            <div className={`flex flex-col gap-5`}>
              <label>{params.lang === 'en' ? 'Referens:' : 'Referens:'}</label>
              <input
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                type="text"
                onChange={handleChange}
                name="referens"
                value={formData.referens}
              />
            </div>

            {/* <div className="flex gap-5">
              <input type="checkbox" style={{ width: '35px' }} />
              <label className="flex items-start md:items-center text-left gap-2">
                {params.lang === 'en'
                  ? 'I agree that Bästa Kompisar use the specified personal data to contact me.*'
                  : 'Jag godkänner att Bästa Kompisar använder angivna personuppgifter för att kontakta mig.*'}
              </label>
            </div> */}

            <button className="w-full flex gap-2 justify-end" type="submit">
              {params.lang === 'en' ? 'Send' : 'Skicka'}
              <span>
                <IoMdArrowForward fontSize={'1.3em'} color="#FF6062" />
              </span>
            </button>
          </form>
        ) : (
          <div className="lg:h-[50vh] flex items-center justify-center">
            <div>
              {params.lang === 'en'
                ? 'Thank you for your message!'
                : 'Tack för uppgifterna!'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrgForm
