// The old bs42.net's projects page, still in search engines and old links. Its one project wasn't brought across, so
// it goes to the homepage, without the old query.
export function GET() {
  return new Response(null, { status: 308, headers: { Location: "/" } })
}
