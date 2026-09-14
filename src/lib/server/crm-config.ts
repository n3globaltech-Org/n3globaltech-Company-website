import { env as cloudflareEnv } from 'cloudflare:workers';

type CrmEnvironment = {
  CRM_API_TOKEN?: string;
  CRM_API_BASE_URL?: string;
  CRM_WEBSITE_PUBLIC_ID?: string;
  CRM_API_URL?: string;
};

export type CrmConfig = {
  token: string;
  baseUrl: string;
  publicId: string;
};

function getEnvironment(): CrmEnvironment {
  const runtime = cloudflareEnv as CrmEnvironment;
  // Production credentials come from encrypted Cloudflare Worker bindings.
  // This fallback supports local Astro development with a server-only .env.
  return {
    CRM_API_TOKEN: runtime.CRM_API_TOKEN || import.meta.env.CRM_API_TOKEN,
    CRM_API_BASE_URL: runtime.CRM_API_BASE_URL || import.meta.env.CRM_API_BASE_URL,
    CRM_WEBSITE_PUBLIC_ID: runtime.CRM_WEBSITE_PUBLIC_ID || import.meta.env.CRM_WEBSITE_PUBLIC_ID,
    CRM_API_URL: runtime.CRM_API_URL || import.meta.env.CRM_API_URL,
  };
}

export function getCrmConfig(): CrmConfig | null {
  const values = getEnvironment();
  const token = String(values.CRM_API_TOKEN ?? '').trim();
  const baseUrl = String(values.CRM_API_BASE_URL ?? '').trim().replace(/\/$/, '');
  const publicId = String(values.CRM_WEBSITE_PUBLIC_ID ?? '').trim();

  if (token && baseUrl && publicId) return { token, baseUrl, publicId };

  // Compatibility for deployments still using the former full endpoint.
  const legacyUrl = String(values.CRM_API_URL ?? '').trim();
  if (!token || !legacyUrl) {
    console.error('CRM proxy configuration is incomplete.', {
      tokenConfigured: Boolean(token),
      baseUrlConfigured: Boolean(baseUrl),
      publicIdConfigured: Boolean(publicId),
      legacyUrlConfigured: Boolean(legacyUrl),
    });
    return null;
  }

  try {
    const url = new URL(legacyUrl);
    const legacyPublicId = url.pathname.split('/').filter(Boolean).at(-1);
    if (!legacyPublicId) return null;
    return { token, baseUrl: url.origin, publicId: legacyPublicId };
  } catch {
    console.error('CRM_API_URL is not a valid URL.');
    return null;
  }
}
