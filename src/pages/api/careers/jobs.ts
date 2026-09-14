import type { APIRoute } from 'astro';
import { getCrmConfig } from '../../../lib/server/crm-config';
export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const config = getCrmConfig();
  if (!config) return json(500, { message: 'Careers are temporarily unavailable.' });
  try {
    const response = await fetch(`${config.baseUrl}/api/public/careers/${config.publicId}/jobs`, {
      headers: { Authorization: `Bearer ${config.token}`, 'X-Website-Origin': new URL(request.url).origin },
    });
    const body = await response.text();
    return new Response(body, { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': response.ok ? 'public, max-age=60' : 'no-store' } });
  } catch { return json(502, { message: 'Careers are temporarily unavailable.' }); }
};
function json(status: number, value: unknown) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }
