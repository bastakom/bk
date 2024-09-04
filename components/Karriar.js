import { storyblokEditable } from '@storyblok/react/rsc'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { IoMdArrowForward } from 'react-icons/io'

const KarriarForm = ({ blok }) => {
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    praktik: '',
    file: '',
  })

  const params = useParams()

  const [fileName, setFileName] = useState('Ladda upp din fil')

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1]
        setFormData({ ...formData, file: base64String })
        setFileName(file.name)
      }
      reader.readAsDataURL(file)
    } else {
      setFileName('Ladda upp din fil')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleButtonClick = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/karriarform', {
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
      className="full-width-element no-padding-bottom"
      {...storyblokEditable(blok)}
    >
      <div className="flex w-full justify-center items-center py-10 gap-10 flex-col max-md:px-4">
        {!sent ? (
          <form
            className="w-full lg:max-w-[30%] m-auto flex flex-col gap-10"
            onSubmit={handleButtonClick}
          >
            <div className="flex flex-col gap-5">
              <label>
                {params.lang === 'en'
                  ? 'Hello Dear Friends, my name is…*'
                  : 'Hej Bästa Kompisar, mitt namn är…*'}
              </label>
              <input
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                required
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            <div className="flex flex-col gap-5">
              <label>
                {params.lang === 'en'
                  ? 'You can contact me at my email address…*'
                  : 'Ni kan kontakta mig på min e-postadress…*'}
              </label>
              <input
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                type="email"
                onChange={handleChange}
                name="email"
                value={formData.email}
              />
            </div>
            <div className="flex flex-col gap-5">
              <label>
                {params.lang === 'en'
                  ? 'The area that I would like to work/practice in is…*'
                  : 'Området som jag skulle vilja jobba/praktisera inom är…*'}
              </label>
              <input
                className="bg-transparent border border-black rounded-[22px] py-2 px-5"
                type="text"
                onChange={handleChange}
                name="praktik"
                value={formData.praktik}
              />
            </div>

            <div className="w-full flex flex-col gap-4">
              <label>
                {params.lang === 'sv'
                  ? 'Och här är lite kort information om mig…*'
                  : 'And here is some brief information about me…*'}
              </label>
              <textarea
                className="bg-transparent border border-black rounded-[22px] py-5 px-5"
                rows={10}
                name="message"
                onChange={handleChange}
                value={formData.message}
              />
            </div>

            <div className="flex gap-5 flex-col">
              <label className="flex items-start md:items-center gap-2">
                {params.lang === 'en' ? 'CV, PM, Other' : 'CV, PM, Övrigt'}
              </label>
              <label htmlFor="file-upload" className="custom-file-upload">
                {fileName}
              </label>
              <input
                className="hover:cursor-help"
                id="file-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex gap-5">
              <input type="checkbox" required />
              <label className="flex items-start md:items-center gap-2">
                {params.lang === 'en'
                  ? 'I agree that Bästa Kompisar use the specified personal data to contact me.*'
                  : 'Jag godkänner att Bästa Kompisar använder angivna personuppgifter för att kontakta mig.*'}
              </label>
            </div>

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
                ? 'Thank you for your message, we will get back to you as soon as we can!'
                : 'Tack för ditt meddelande, vi återkommer så fort vi kan!'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default KarriarForm
