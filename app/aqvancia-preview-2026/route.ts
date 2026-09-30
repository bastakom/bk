import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-static'

export async function GET() {
  const filePath = path.join(process.cwd(), 'aqvancia-preview-2026', 'index.html')
  const html = await readFile(filePath, 'utf8')
  const htmlWithBase = html.replace(
    /<head>/i,
    '<head>\n  <base href="/aqvancia-preview-2026/">'
  )

  return new NextResponse(htmlWithBase, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
