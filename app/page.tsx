import { PublicViewPage } from './public-view/PublicViewPage';

// Keep the public landing page statically renderable. The header resolves auth
// with the browser Supabase client, so this route can stay cacheable at the edge
// instead of running a serverless render on every visit.
export const dynamic = 'force-static';

export default function Home() {
  return <PublicViewPage />;
}
