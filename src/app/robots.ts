import type { MetadataRoute } from 'next';

/** Herramienta interna: que ningún buscador la indexe (D22). */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
