import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export const dynamic = 'force-static'

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const requestedPath = params.path.join('/')

  if (requestedPath.includes('..')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const filePath = path.join(
    process.cwd(),
    'aqvancia-preview-2026',
    requestedPath
  )
  const file = await readFile(filePath)
  const extension = path.extname(filePath).toLowerCase()

  return new NextResponse(file, {
    headers: {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
