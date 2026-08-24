import SignatureGenerator from '@/Signatur/components/SignatureGenerator'
import SignatureLogin from '@/Signatur/components/SignatureLogin'
import { isSignatureGeneratorAuthenticated } from '@/Signatur/lib/auth'

export const metadata = {
  title: 'Mailsignatur - Bästa Kompisar',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SignaturePage() {
  return isSignatureGeneratorAuthenticated() ? (
    <SignatureGenerator />
  ) : (
    <SignatureLogin />
  )
}
