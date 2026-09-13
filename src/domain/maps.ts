import { env } from '@/config/env';
import type { EventLocation } from '@/types';

export interface ResolvedPlace {
  /** texto usado para localizar o lugar (nunca coordenadas inventadas) */
  query: string;
  /** coordenadas somente se estiverem explicitamente no link */
  coords?: { lat: number; lng: number };
}

/**
 * Extrai informação de um link do Google Maps sem chamadas de rede.
 * Suporta: /@lat,lng, ?q=, ?query=, /place/Nome/. Links curtos (maps.app.goo.gl)
 * não podem ser resolvidos no navegador — nesse caso usamos o endereço digitado.
 */
export function resolvePlace(location: Pick<EventLocation, 'mapsUrl' | 'address' | 'name'>): ResolvedPlace | null {
  const fallback = [location.name, location.address].filter(Boolean).join(', ').trim();
  const raw = location.mapsUrl?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      const at = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const q = url.searchParams.get('q') ?? url.searchParams.get('query');
      const placeName = url.pathname.match(/\/place\/([^/]+)/)?.[1];
      if (q) {
        const coord = q.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
        return coord ? { query: q, coords: { lat: +coord[1], lng: +coord[2] } } : { query: q };
      }
      if (at) {
        const query = placeName ? decodeURIComponent(placeName.replace(/\+/g, ' ')) : `${at[1]},${at[2]}`;
        return { query, coords: { lat: +at[1], lng: +at[2] } };
      }
      if (placeName) return { query: decodeURIComponent(placeName.replace(/\+/g, ' ')) };
    } catch {
      /* link inválido: segue para o endereço */
    }
  }
  return fallback ? { query: fallback } : null;
}

export function isGoogleMapsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return /(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname.startsWith('/maps') || /goo\.gl$|maps\.app\.goo\.gl$/.test(u.hostname);
  } catch {
    return false;
  }
}

/** URL do iframe. Com chave: Maps Embed API oficial. Sem chave: embed público por consulta. */
export function embedUrl(place: ResolvedPlace): string {
  const q = place.coords ? `${place.coords.lat},${place.coords.lng}` : place.query;
  if (env.googleMapsApiKey) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(env.googleMapsApiKey)}&q=${encodeURIComponent(q)}&language=pt-BR`;
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed&hl=pt-BR`;
}

export function openInMapsUrl(location: EventLocation, place: ResolvedPlace | null): string {
  if (location.mapsUrl) return location.mapsUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place?.query ?? location.address)}`;
}

export function directionsUrl(place: ResolvedPlace): string {
  const dest = place.coords ? `${place.coords.lat},${place.coords.lng}` : place.query;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
