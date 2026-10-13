import type { City } from './model.ts';
import { CITY_COPY as copy } from '../i18n/es-AR.ts';

// The map is drawn 230-380 px wide (scale 0.39-0.64 of the view box): labels this size stay at 12 px or more.
const LEG_LABEL_SIZE = 32;
const LEG_MARKER_RADIUS = 19;
const CAPTION_SIZE = 32;

/** Geographic overview stays accessible and available without WebGL. */
export function RouteMap({ city, selected }: { city: City; selected: number }) {
  return (
    <svg className="city-map" viewBox="-185 -325 590 535" role="img" aria-label={copy.mapLabel}>
      <rect x="-185" y="-325" width="590" height="535" rx="14" fill="#edf0e7" />
      {city.roads
        .filter((road) => road.kind === 'context')
        .map((road) => (
          <path
            key={road.id}
            d={`M${road.a.x},${road.a.z} L${road.b.x},${road.b.z}`}
            stroke="#c7cdbf"
            strokeWidth="7"
          />
        ))}
      {city.legs.map((leg) => (
        <g key={leg.number}>
          <polyline
            points={leg.path.map((p) => `${p.x},${p.z}`).join(' ')}
            fill="none"
            stroke={leg.number === selected ? '#16766c' : '#839990'}
            strokeWidth={leg.number === selected ? 8 : 4}
            strokeLinejoin="round"
          />
          <circle
            cx={leg.path[0]?.x}
            cy={leg.path[0]?.z}
            r={LEG_MARKER_RADIUS}
            fill={leg.number === selected ? '#16766c' : '#243f47'}
          />
          <text
            x={leg.path[0]?.x}
            y={(leg.path[0]?.z ?? 0) + LEG_LABEL_SIZE * 0.36}
            textAnchor="middle"
            fill="white"
            fontSize={LEG_LABEL_SIZE}
            fontWeight="700"
          >
            {leg.number}
          </text>
        </g>
      ))}
      <path d="M355,-250 v-35 m0,0 l-6,10 m6,-10 l6,10" stroke="#243f47" strokeWidth="3" fill="none" />
      <text x="355" y="-290" textAnchor="middle" fontSize={CAPTION_SIZE} fontWeight="700" fill="#243f47">
        {copy.north}
      </text>
      <path d="M-145,155 h100 m-100,-5 v10 m100,-10 v10" stroke="#243f47" strokeWidth="2" />
      <text x="-95" y="188" textAnchor="middle" fontSize={CAPTION_SIZE} fill="#243f47">
        {copy.mapScale}
      </text>
    </svg>
  );
}
