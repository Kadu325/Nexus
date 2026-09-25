'use client';

import * as React from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
// Natural Earth 1:110m via world-atlas (domínio público), embarcado no bundle: sem provedor de mapas externo.
import world from 'world-atlas/countries-110m.json';
import { label } from '@/lib/labels';

interface Point {
  id: string;
  name: string;
  type: string;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  projects: number;
  isDemo?: boolean;
}

const W = 560;
const H = 520;

export function BrazilMap({ points }: { points: Point[] }) {
  const [hover, setHover] = React.useState<Point | null>(null);
  const { d, project } = React.useMemo(() => {
    const countries = feature(world as any, (world as any).objects.countries) as any;
    const brazil = countries.features.find((f: any) => String(f.id) === '076');
    const projection = geoMercator().fitSize([W, H], brazil);
    return { d: geoPath(projection)(brazil) ?? '', project: (lng: number, lat: number) => projection([lng, lat]) };
  }, []);

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Mapa do Brasil com ${points.length} unidade(s) localizada(s)`}>
        <path d={d} fill="#EDF7EE" stroke="#1B5E20" strokeWidth={1} />
        {points.map((p) => {
          const xy = project(p.lng, p.lat);
          if (!xy) return null;
          const r = 6 + Math.min(6, p.projects * 2);
          return (
            <g
              key={p.id}
              transform={`translate(${xy[0]},${xy[1]})`}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              role="button"
              aria-label={`${p.name}, ${label('unitType', p.type)}, ${p.city ?? ''} ${p.state ?? ''}, ${p.projects} projeto(s)`}
              className="cursor-pointer outline-none"
            >
              <circle r={r + 8} fill="transparent" />
              <circle r={r} fill={p.type === 'FAZENDA' ? '#2E7D32' : '#1565C0'} stroke="#fff" strokeWidth={2} opacity={0.9} />
            </g>
          );
        })}
      </svg>
      {hover ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
          <p className="font-semibold text-ink">{hover.name}</p>
          <p className="text-muted">
            {label('unitType', hover.type)} · {hover.city ?? '—'}/{hover.state ?? '—'}
          </p>
          <p className="text-muted">{hover.projects} projeto(s) vinculado(s)</p>
          {hover.isDemo ? <p className="text-petrol-text">Dado demonstrativo</p> : null}
        </div>
      ) : null}
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-full bg-[#2E7D32]" aria-hidden /> Fazenda
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-full bg-[#1565C0]" aria-hidden /> Filial, armazém ou escritório
        </span>
        <span>Tamanho do ponto: número de projetos.</span>
      </figcaption>
    </figure>
  );
}
