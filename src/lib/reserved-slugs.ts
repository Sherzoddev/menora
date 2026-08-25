export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "tv",
  "cabinet",
  "m",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export function isReservedSlug(slug: string) {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
