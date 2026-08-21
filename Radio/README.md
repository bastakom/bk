# Radio

Det här är den separata radiobrief-modulen för `bastakom/bk`.

Lägg hela mappen `Radio/` längst upp i repot.

## Innehåll

- `components/OrderForm.tsx` - publikt formulär
- `components/Dashboard.tsx` - intern dashboard
- `components/LoginForm.tsx` - lösenordsinloggning
- `lib/auth.ts` - env-baserad dashboard-session
- `lib/db.ts` - Neon/Postgres-koppling
- `lib/types.ts` - typer och statusar
- `database/radio_briefs.sql` - tabellen som ska köras i Neon

## Viktigt

Next.js kräver fortfarande små route-filer i `app/`. De kan vara tunna och bara importera från `Radio/`.

Exempel:

```tsx
// app/order/page.tsx
import OrderForm from '@/Radio/components/OrderForm'

export const metadata = {
  title: 'Radiobrief - Bästa Kompisar',
  robots: { index: false, follow: false },
}

export default function OrderPage() {
  return <OrderForm />
}
```

```tsx
// app/order/dashboard/page.tsx
import { isRadioDashboardAuthenticated } from '@/Radio/lib/auth'
import Dashboard from '@/Radio/components/Dashboard'
import LoginForm from '@/Radio/components/LoginForm'

export const metadata = {
  title: 'Radiobriefer - Dashboard',
  robots: { index: false, follow: false },
}

export default function DashboardPage() {
  return isRadioDashboardAuthenticated() ? <Dashboard /> : <LoginForm />
}
```

```ts
// app/api/radio-briefs/route.ts
export {
  createBrief as POST,
  listBriefs as GET,
  options as OPTIONS,
} from '@/Radio/api/radioBriefs'
```

```ts
// app/api/radio-briefs/[id]/route.ts
export {
  updateBriefStatus as PATCH,
} from '@/Radio/api/radioBriefs'
```

```ts
// app/api/radio-auth/login/route.ts
export {
  login as POST,
} from '@/Radio/api/auth'
```

```ts
// app/api/radio-auth/logout/route.ts
export {
  logout as POST,
} from '@/Radio/api/auth'
```

Middleware behöver också skriva om subdomänen:

```ts
const orderHost = 'order.bastakompisar.se'

if (hostname === orderHost) {
  if (pathname === '/') {
    url.pathname = '/order'
    return NextResponse.rewrite(url)
  }

  if (pathname === '/dashboard') {
    url.pathname = '/order/dashboard'
    return NextResponse.rewrite(url)
  }

  if (pathname.startsWith('/order')) {
    return
  }
}
```

## Beroende

Lägg till Neon-driver i repot:

```bash
yarn add @neondatabase/serverless
```

## Vercel env-vars

```env
DATABASE_URL=
RESEND_API_KEY=
RADIO_BRIEF_NOTIFICATION_TO=richard@bastakompisar.se
RADIO_BRIEF_FROM=Radiobriefer <onboarding@resend.dev>
RADIO_DASHBOARD_URL=https://order.bastakompisar.se/dashboard
RADIO_DASHBOARD_PASSWORD_HASH=
RADIO_DASHBOARD_SESSION_SECRET=
```
