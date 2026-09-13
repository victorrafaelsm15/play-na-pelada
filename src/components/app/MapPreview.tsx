import { useMemo, useState } from 'react';
import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import type { EventLocation } from '@/types';
import { directionsUrl, embedUrl, openInMapsUrl, resolvePlace } from '@/domain/maps';

/**
 * Mapa da pelada. Usa a Maps Embed API quando VITE_GOOGLE_MAPS_API_KEY existe;
 * sem chave, usa o embed público por consulta. Nunca inventa coordenadas.
 */
export function MapPreview({ location, height = 180 }: { location: EventLocation; height?: number }) {
  const place = useMemo(() => resolvePlace(location), [location]);
  const [failed, setFailed] = useState(false);

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-lift">
      {place && !failed ? (
        <iframe
          title={`Mapa de ${location.name}`}
          src={embedUrl(place)}
          className="block w-full border-0 bg-chalk-soft"
          style={{ height }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="pitch-lines flex flex-col items-center justify-center bg-turf-800 text-chalk" style={{ height }}>
          <MapPin />
          <p className="mt-1 text-sm text-chalk/80">Mapa indisponível para este endereço</p>
        </div>
      )}
      <div className="p-4">
        <p className="font-semibold">{location.name}{location.court ? `, ${location.court}` : ''}</p>
        <p className="text-sm text-ink-muted">{location.address}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={openInMapsUrl(location, place)} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-chalk-line text-sm font-semibold hover:border-ink/30">
            <ExternalLink size={16} /> Abrir no Maps
          </a>
          <a href={place ? directionsUrl(place) : openInMapsUrl(location, null)} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-turf-800 text-sm font-semibold text-chalk hover:bg-turf-700">
            <Navigation size={16} /> Traçar rota
          </a>
        </div>
      </div>
    </div>
  );
}
