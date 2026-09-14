import type { APIRoute } from 'astro';
export const prerender = false;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_BYTES = 5 * 1024 * 1024;

export const POST: APIRoute = async ({ request }) => {
  const config = crmConfig();
  if (!config) return json(500, { message: 'Applications are temporarily unavailable.' });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json(400, { message: 'Invalid upload request.' }); }
  const slug = String(body.slug ?? '').trim();
  const fileName = String(body.fileName ?? '').trim();
  const mimeType = String(body.mimeType ?? '').trim().toLowerCase();
  const fileSize = Number(body.fileSize);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !fileName || !ALLOWED_MIME.has(mimeType) || !Number.isInteger(fileSize) || fileSize < 1 || fileSize > MAX_BYTES) {
    return json(400, { message: 'Résumé must be a PDF, DOC, or DOCX file no larger than 5 MB.' });
  }
  try {
    const response = await fetch(`${config.baseUrl}/api/public/careers/${config.publicId}/jobs/${encodeURIComponent(slug)}/resume-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}`, 'X-Website-Origin': new URL(request.url).origin },
      body: JSON.stringify({ fileName, mimeType, fileSize }),
    });
    const result = await response.text();
    return new Response(result, { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch { return json(502, { message: 'We could not prepare the résumé upload. Please try again.' }); }
};

function crmConfig() {
  const token = import.meta.env.CRM_API_TOKEN; const base = import.meta.env.CRM_API_BASE_URL; const publicId = import.meta.env.CRM_WEBSITE_PUBLIC_ID; const legacy = import.meta.env.CRM_API_URL;
  if (!token) return null;
  if (base && publicId) return { token, baseUrl: String(base).replace(/\/$/, ''), publicId: String(publicId) };
  if (!legacy) return null;
  try { const url = new URL(legacy); return { token, baseUrl: url.origin, publicId: url.pathname.split('/').filter(Boolean).at(-1)! }; } catch { return null; }
}
function json(status: number, value: unknown) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
