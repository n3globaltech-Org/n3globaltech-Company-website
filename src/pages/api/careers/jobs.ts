import type { APIRoute } from 'astro';
export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const config = crmConfig();
  if (!config) return json(500, { message: 'Careers are temporarily unavailable.' });
  try {
    const response = await fetch(`${config.baseUrl}/api/public/careers/${config.publicId}/jobs`, {
      headers: { Authorization: `Bearer ${config.token}`, 'X-Website-Origin': new URL(request.url).origin },
    });
    const body = await response.text();
    return new Response(body, { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': response.ok ? 'public, max-age=60' : 'no-store' } });
  } catch { return json(502, { message: 'Careers are temporarily unavailable.' }); }
};
function crmConfig() {
  const token = import.meta.env.CRM_API_TOKEN;
  const explicitBase = import.meta.env.CRM_API_BASE_URL;
  const explicitPublicId = import.meta.env.CRM_WEBSITE_PUBLIC_ID;
  const legacyUrl = import.meta.env.CRM_API_URL;
  if (!token) return null;
  if (explicitBase && explicitPublicId) return { token, baseUrl: String(explicitBase).replace(/\/$/, ''), publicId: String(explicitPublicId) };
  if (!legacyUrl) return null;
  try { const url = new URL(legacyUrl); return { token, baseUrl: url.origin, publicId: url.pathname.split('/').filter(Boolean).at(-1)! }; } catch { return null; }
}
function json(status: number, value: unknown) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }
