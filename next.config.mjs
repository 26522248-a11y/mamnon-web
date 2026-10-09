/**
 * Two ways to reach the API (see DEPLOY.md):
 *  - Proxy mode (recommended on Vercel): set API_INTERNAL_URL=https://<api>.onrender.com and leave NEXT_PUBLIC_API_URL unset.
 *    The browser calls same-origin /api/v1/* and Next rewrites it to the API, so the refresh cookie is first-party
 *    (works on iPhone Safari, which blocks third-party cookies).
 *  - Direct mode: NEXT_PUBLIC_API_URL=https://<api>.onrender.com (API needs CORS_ORIGIN + COOKIE_SAMESITE=none).
 * Local dev: .env.local sets NEXT_PUBLIC_API_URL=http://localhost:3001 → direct mode, nothing changes.
 */
const apiInternal = (process.env.API_INTERNAL_URL || "").replace(/\/+$/, "");
const proxy = !!apiInternal && process.env.NEXT_PUBLIC_API_URL === undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(proxy ? { env: { NEXT_PUBLIC_API_URL: "" } } : {}),
  async rewrites() {
    return proxy ? [{ source: "/api/:path*", destination: `${apiInternal}/api/:path*` }] : [];
  },
};

export default nextConfig;
