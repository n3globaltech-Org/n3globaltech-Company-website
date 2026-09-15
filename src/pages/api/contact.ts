import type { APIRoute } from 'astro';
import { getCrmConfig } from '../../lib/server/crm-config';

// Cloudflare server endpoint. CRM_API_TOKEN is a secret binding and is never
// serialized into browser JavaScript or returned in a response.
export const prerender = false;

const ALLOWED_INTERESTS = new Set([
  'custom_software', 'saas', 'web', 'mobile', 'ai_automation', 'cloud_infra', 'branding', 'other',
  'website_development', 'mobile_app_development', 'web_application', 'cloud_devops', 'software_support', 'custom_software_implementation',
]);

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  const config = getCrmConfig();
  if (!config) return jsonResponse(500, {
    success: false, error_code: 'misconfigured',
    message: 'Contact endpoint is not configured. Please email contact@n3global.tech.',
  });
  const apiUrl = config.baseUrl + '/api/website-enquiries/' + config.publicId;
  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return jsonResponse(400, { success: false, error_code: 'invalid_json', message: 'Invalid request body.' }); }

  if (typeof payload.website === 'string' && payload.website.trim()) {
    return jsonResponse(201, { success: true, lead_id: 'noop' });
  }

  const name = String(payload.name ?? '').trim();
  const email = String(payload.email ?? '').trim().toLowerCase();
  const phone = String(payload.phone ?? '').trim();
  const company = String(payload.company ?? '').trim();
  const interest = String(payload.interest ?? payload.service ?? payload.project_type ?? '').trim();
  const message = String(payload.message ?? '').trim();
  if (!name) return jsonResponse(400, { success: false, message: 'Please enter your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse(400, { success: false, message: 'Please enter a valid email address.' });
  if (!ALLOWED_INTERESTS.has(interest)) return jsonResponse(400, { success: false, message: 'Please select a valid project type.' });
  if (message.length < 10 || message.length > 5_000) return jsonResponse(400, { success: false, message: 'Please provide a message between 10 and 5,000 characters.' });
  if (phone && (phone.length < 7 || phone.length > 30)) return jsonResponse(400, { success: false, message: 'Please enter a valid phone number.' });

  const requestUrl = new URL(request.url);
  const pageUrl = typeof payload.pageUrl === 'string' ? payload.pageUrl : undefined;
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  try {
    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
        'Idempotency-Key': crypto.randomUUID(),
        'X-Website-Origin': requestUrl.origin,
      },
      body: JSON.stringify({ name, email, phone: phone || null, company: company || null, interest, message, pageUrl, metadata }),
    });
    let upstreamBody: Record<string, unknown> = {};
    try { upstreamBody = await upstream.json(); } catch { /* response body is optional */ }
    if (!upstream.ok) return jsonResponse(upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502, {
      success: false,
      error_code: typeof upstreamBody.error_code === 'string' ? upstreamBody.error_code : 'upstream_error',
      message: typeof upstreamBody.message === 'string' ? upstreamBody.message : 'We could not deliver your message right now. Please try again or email contact@n3global.tech.',
    });
    return jsonResponse(201, {
      success: true,
      lead_id: typeof upstreamBody.id === 'string' ? upstreamBody.id : null,
      lead_code: typeof upstreamBody.code === 'string' ? upstreamBody.code : null,
      message: 'Enquiry received. We will get back to you shortly.',
    });
  } catch (error) {
    console.error('CRM proxy error:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse(502, { success: false, error_code: 'upstream_unreachable', message: 'We could not reach our CRM right now. Please try again or email contact@n3global.tech.' });
  }
};

export const GET: APIRoute = () => jsonResponse(405, { success: false, error_code: 'method_not_allowed', message: 'Use POST.' });
