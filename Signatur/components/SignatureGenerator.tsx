'use client'

import { FormEvent, useMemo, useRef, useState } from 'react'

const ADDRESS = 'Södra Tullgatan 3, 211 40 Malmö'
const SWITCHBOARD = '040 127 327'
const WEBSITE = 'bastakompisar.se'
const FONT_STACK = "'Sofia Pro', Arial, Helvetica, sans-serif"

type SignatureData = {
  name: string
  title: string
  phone: string
}

const fields = [
  {
    name: 'name',
    label: 'Namn',
    type: 'text',
    help: 'Förnamn och efternamn som ska visas i signaturen.',
  },
  {
    name: 'phone',
    label: 'Mobilnummer',
    type: 'tel',
    help: 'Visas exakt som du skriver det. Länken rensas automatiskt för Outlook.',
  },
] as const

const defaultData: SignatureData = {
  name: 'Alex Tanski',
  title: 'Digital projektledare',
  phone: '0709 48 68 30',
}

function normalizeTitle(value: string) {
  return value.trim().toUpperCase()
}

function formatPhoneNumber(value: string) {
  let digits = value.replace(/[^\d]/g, '')

  if (digits.length === 9 && digits.startsWith('7')) {
    digits = `0${digits}`
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`
  }

  return value.trim()
}

function getPhoneHref(value: string) {
  const trimmed = value.trim()
  const plus = trimmed.startsWith('+') ? '+' : ''
  const digits = trimmed.replace(/[^\d]/g, '')

  return `${plus}${digits}`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function Mark() {
  return (
    <div className="flex w-[22px] shrink-0 flex-col gap-0.5">
      <span className="h-0.5 bg-black" />
      <span className="h-0.5 w-[70%] bg-black" />
      <span className="h-0.5 w-[85%] bg-black" />
      <span className="h-0.5 bg-black" />
    </div>
  )
}

function RequiredMark() {
  return <span className="text-[#d6202b]"> *</span>
}

function buildSignatureHtml(data: SignatureData, logoUrl: string) {
  const name = escapeHtml(data.name.trim())
  const title = escapeHtml(normalizeTitle(data.title))
  const phone = escapeHtml(formatPhoneNumber(data.phone))
  const phoneHref = escapeHtml(getPhoneHref(data.phone))
  const logoSrc = escapeHtml(logoUrl)

  return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:520px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;font-family:${FONT_STACK};color:#242124;">
  <tr>
    <td style="padding:0 0 22px 0;font-family:${FONT_STACK};font-size:18px;line-height:22px;font-weight:400;color:#242124;">Bästa hälsningar,</td>
  </tr>
  <tr>
    <td style="padding:0 0 21px 0;font-family:${FONT_STACK};font-size:34px;line-height:38px;font-weight:700;color:#242124;">${name}</td>
  </tr>
  <tr>
    <td style="padding:0;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
          <td valign="middle" style="width:106px;padding:0 30px 0 0;">
            <img src="${logoSrc}" width="96" alt="BK" style="display:block;width:96px;height:auto;border:0;outline:none;text-decoration:none;">
          </td>
          <td valign="middle" style="padding:0;font-family:${FONT_STACK};color:#242124;">
            <div style="font-size:20px;line-height:28px;font-weight:400;letter-spacing:1px;text-transform:uppercase;color:#242124;">${title}</div>
            <div style="font-size:20px;line-height:28px;font-weight:400;color:#242124;"><a href="tel:${phoneHref}" style="color:#242124;text-decoration:none;">${phone}</a></div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:25px 0 0 0;">
      <div style="width:160px;height:1px;background:#242124;line-height:1px;font-size:1px;">&nbsp;</div>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 0 0 0;font-family:${FONT_STACK};font-size:16px;line-height:22px;font-weight:400;color:#5d5a5d;">
      <div>${ADDRESS}</div>
      <div>Växel ${SWITCHBOARD}, <a href="https://${WEBSITE}/" style="color:#5d5a5d;text-decoration:none;">${WEBSITE}</a></div>
    </td>
  </tr>
</table>`.trim()
}

function buildPlainText(data: SignatureData) {
  return [
    'Bästa hälsningar,',
    '',
    data.name.trim(),
    `${normalizeTitle(data.title)} ${formatPhoneNumber(data.phone)}`,
    '',
    ADDRESS,
    `Växel ${SWITCHBOARD}, ${WEBSITE}`,
  ].join('\n')
}

export default function SignatureGenerator() {
  const [formData, setFormData] = useState<SignatureData>(defaultData)
  const [signatureData, setSignatureData] = useState<SignatureData>(defaultData)
  const [message, setMessage] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)

  const logoUrl =
    typeof window === 'undefined' ? '' : `${window.location.origin}/bk-black.png`
  const signatureHtml = useMemo(
    () => buildSignatureHtml(signatureData, logoUrl),
    [signatureData, logoUrl]
  )
  const plainText = useMemo(() => buildPlainText(signatureData), [signatureData])

  function updateField(field: keyof SignatureData, value: string) {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSignatureData({
      name: formData.name.trim(),
      title: formData.title.trim(),
      phone: formatPhoneNumber(formData.phone),
    })
    setFormData((current) => ({
      ...current,
      phone: formatPhoneNumber(current.phone),
    }))
    setMessage('Förhandsvisningen är uppdaterad.')
  }

  async function copySignature() {
    setMessage('')

    try {
      if (navigator.clipboard && 'ClipboardItem' in window) {
        const htmlBlob = new Blob([signatureHtml], { type: 'text/html' })
        const textBlob = new Blob([plainText], { type: 'text/plain' })

        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          }),
        ])

        setMessage('Signaturen är kopierad.')
        return
      }
    } catch {
      // Falls back to DOM selection below.
    }

    const preview = previewRef.current

    if (!preview) {
      setMessage('Kunde inte kopiera signaturen.')
      return
    }

    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(preview)
    selection?.removeAllRanges()
    selection?.addRange(range)

    const copied = document.execCommand('copy')
    selection?.removeAllRanges()

    setMessage(copied ? 'Signaturen är kopierad.' : 'Kunde inte kopiera signaturen.')
  }

  return (
    <main className="min-h-screen bg-[#f3f3f1] text-[15px] leading-[1.45] text-[#0b0b0b] antialiased">
      <header className="sticky top-0 z-40 border-b-[1.5px] border-black bg-[#f3f3f1]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-[18px] py-3">
          <Mark />
          <div className="font-sans text-[19px] font-extrabold uppercase tracking-normal text-black">
            BK <span className="ml-2 text-sm font-medium normal-case text-[#70706c]">Mailsignatur</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-[18px] pb-24 pt-5">
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="border-[1.5px] border-[#dededa] bg-white">
            <div className="border-b border-[#dededa] px-5 py-4">
              <h1 className="text-[28px] font-extrabold leading-none tracking-normal text-black md:text-[40px]">
                Mailsignatur
              </h1>
              <p className="mt-2 max-w-[760px] text-sm text-[#70706c]">
                Fyll i dina uppgifter och kopiera signaturen till Outlook.
              </p>
              <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#70706c]">
                <span className="text-[#d6202b]">*</span> Obligatorisk
              </p>
            </div>

            <div className="grid gap-x-4 gap-y-4 border-b border-[#dededa] p-5 md:grid-cols-2">
              {fields.map((field) => (
                <label key={field.name} className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#70706c]">
                    {field.label}
                    <RequiredMark />
                  </span>
                  <input
                    className="w-full border-[1.5px] border-[#dededa] bg-white px-3 py-3 text-[15px] outline-none transition focus:border-black"
                    type={field.type}
                    value={formData[field.name]}
                    onChange={(event) => updateField(field.name, event.target.value)}
                    required
                  />
                  <span className="mt-1.5 block text-[12px] leading-snug text-[#70706c]">
                    {field.help}
                  </span>
                </label>
              ))}
            </div>

            <label className="block border-b border-[#dededa] p-5">
              <span className="mb-2 flex items-baseline gap-3">
                <span className="font-mono text-xs text-[#70706c]">1</span>
                <span className="text-[16.5px] font-bold text-black">
                  Titel
                  <RequiredMark />
                </span>
              </span>
              <span className="mb-3 block max-w-[820px] text-[13px] leading-snug text-[#70706c]">
                Skriv titeln som den ska visas. Längre titlar kan radbrytas i signaturen.
              </span>
              <textarea
                className="min-h-28 w-full border-[1.5px] border-[#dededa] bg-white px-3 py-3 text-[15px] outline-none transition focus:border-black"
                value={formData.title}
                onChange={(event) => updateField('title', event.target.value)}
                required
              />
            </label>

            <section className="p-5">
              <span className="mb-2 flex items-baseline gap-3">
                <span className="font-mono text-xs text-[#70706c]">2</span>
                <span className="text-[16.5px] font-bold text-black">Förhandsvisning</span>
              </span>
              <div className="overflow-x-auto border-[1.5px] border-[#dededa] bg-white p-5">
                <div
                  ref={previewRef}
                  className="inline-block min-w-[520px] bg-white p-0"
                  dangerouslySetInnerHTML={{ __html: signatureHtml }}
                />
              </div>
            </section>
          </section>

          <aside className="h-fit border-[1.5px] border-black bg-white lg:sticky lg:top-[76px]">
            <div className="border-b-[1.5px] border-black p-5">
              <h2 className="text-[22px] font-extrabold leading-tight text-black">Skapa signatur</h2>
              <p className="mt-2 text-sm text-[#70706c]">
                Uppdatera förhandsvisningen och kopiera sedan den renderade signaturen.
              </p>
            </div>
            <div className="space-y-3 p-5">
              <button
                className="w-full bg-black px-5 py-3 font-semibold text-white transition hover:bg-[#2a2a28]"
                type="submit"
              >
                Visa min signatur
              </button>
              <button
                className="w-full border-[1.5px] border-black px-5 py-3 font-semibold transition hover:bg-black hover:text-white"
                type="button"
                onClick={copySignature}
              >
                Kopiera signaturen
              </button>
              {message && (
                <p className="border border-[#dededa] bg-[#e9e9e5] px-3 py-2 text-sm font-semibold">
                  {message}
                </p>
              )}
            </div>
          </aside>
        </form>
      </div>
    </main>
  )
}
