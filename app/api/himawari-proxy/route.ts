import { NextResponse } from 'next/server';
import { publishedHimawari } from '@/lib/server/publishedHimawari';

export const runtime = 'nodejs';
export const maxDuration = 60;

const unavailable = () => NextResponse.json(
  { error: 'satellite imagery temporarily unavailable' },
  { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } },
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('manifest') === '1') {
    try {
      return NextResponse.json(await publishedHimawari(), {
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30' },
      });
    } catch {
      return unavailable();
    }
  }

  const time = searchParams.get('time');
  if (!time || !/^(?:([01]\d|2[0-3])[0-5]\d|\d{14})$/.test(time)) {
    return NextResponse.json({ error: 'time (UTC stamp or HHMM) required' }, {
      status: 400, headers: { 'Cache-Control': 'no-store' },
    });
  }
  try {
    const publication = await publishedHimawari();
    const stamp = time.length === 14 ? time : [...publication.frames].reverse().find(s => s.slice(8, 12) === time);
    if (!stamp || !publication.image_urls[stamp]) {
      return NextResponse.json({ error: 'satellite frame not published' }, {
        status: 404, headers: { 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.redirect(publication.image_urls[stamp], {
      status: 307, headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return unavailable();
  }
}
