import type { APIRoute } from 'astro';
import { getCrmConfig } from '../../../lib/server/crm-config';
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const config = getCrmConfig();
  if (!config) return json(500, { message: 'Applications are temporarily unavailable.' });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json(400, { message: 'Invalid application.' }); }
  if (typeof body.website === 'string' && body.website.trim()) return json(201, { accepted: true });
  const slug = String(body.slug ?? '').trim();
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const coverLetter = String(body.coverLetter ?? '').trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { message: 'Please complete the required fields.' });
  if (coverLetter.length > 10_000) return json(400, { message: 'Cover letter is too long.' });
  try {
    const response = await fetch(`${config.baseUrl}/api/public/careers/${config.publicId}/jobs/${encodeURIComponent(slug)}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}`, 'Idempotency-Key': crypto.randomUUID(), 'X-Website-Origin': new URL(request.url).origin },
      body: JSON.stringify({ name, email, phone: body.phone || null, location: body.location || null, coverLetter: coverLetter || null, answers: {}, consent: body.consent === true, privacyVersion: '2026-09', resumeUploadToken: typeof body.resumeUploadToken === 'string' ? body.resumeUploadToken : undefined, website: '' }),
    });
    const result = await response.text();
    return new Response(result, { status: response.status, headers: { 'Content-Type': 'application/json' } });
  } catch { return json(502, { message: 'We could not submit your application. Please try again.' }); }
};
function json(status: number, value: unknown) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }
