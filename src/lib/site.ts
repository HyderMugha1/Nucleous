const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const inferredOrigin =
  typeof window !== "undefined" && window.location?.origin ? window.location.origin : "https://app.your-domain.example.com";

const siteUrl = trimTrailingSlash(import.meta.env.VITE_SITE_URL || inferredOrigin);

export const siteConfig = {
  name: "Nucleus",
  tagLine: "Media Intelligence Platform",
  siteUrl,
  privacyUrl: `${siteUrl}/privacy`,
  termsUrl: `${siteUrl}/terms`,
  contactUrl: `${siteUrl}/contact`,
};
