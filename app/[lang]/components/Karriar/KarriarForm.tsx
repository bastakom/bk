'use client'

import { useState } from 'react'
import { render } from 'storyblok-rich-text-react-renderer'

interface Props {
  props: any
}

const KarriarForm = ({ props }: Props) => {
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  })

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleButtonClick = async (e: any) => {
    e.preventDefault()
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
    }
  }
  return (
    <div className="flex w-full justify-center items-center py-20 gap-10 flex-col">
      <h1 className="text-[20px] uppercase font-normal">{props.title}</h1>
      <span className="text-[30px] font-normal">{render(props.content)}</span>
      <span className="text-[20px] font-normal text-center">
        {render(props.adress)}
      </span>
      {/* FORM */}

      {!sent ? (
        <form
          className={`w-full lg:max-w-[30%] m-auto flex flex-col gap-10`}
          onSubmit={handleButtonClick}
        >
          <div className={`flex flex-col gap-5`}>
            <label>Hej Bästa Kompisar, mitt namn är…*</label>
            <input
              className="bg-transparent border border-black rounded-[22px] py-2 px-5"
              required
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />
          </div>
          <div className={`flex flex-col gap-5`}>
            <label>Ni kan kontakta mig på min e-postadress…*</label>
            <input
              className="bg-transparent border border-black rounded-[22px] py-2 px-5"
              type="email"
              onChange={handleChange}
              name="email"
              value={formData.email}
            />
          </div>

          <div className="w-full  flex flex-col gap-4 ">
            <label>Jag skulle vilja veta mer om…*</label>
            <textarea
              className="bg-transparent border border-black rounded-[22px] py-5 px-5"
              rows={10}
              name="message"
              onChange={handleChange}
              value={formData.message}
            />
          </div>
          <div>
            <label className="flex items-start md:items-center gap-2">
              GDPR
            </label>
          </div>

          <button className="button primary m-auto" type="submit">
            Skicka
          </button>
        </form>
      ) : (
        <div className="lg:h-[50vh] flex items-center justify-center">
          <div>TACK</div>
        </div>
      )}
    </div>
  )
}

export default KarriarForm
