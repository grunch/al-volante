import type { ReactElement } from 'react';

// Regulatory shapes and colours as drawn in the manual's annex IV (manual PDF 185–186).
const RED = '#c8102e';
const WHITE = '#ffffff';
const BLACK = '#111111';

const DRAWINGS: Record<string, ReactElement> = {
  'sign.regulatory.priority.stop': (
    <>
      <polygon points="30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30" fill={WHITE} />
      <polygon points="32,7 68,7 93,32 93,68 68,93 32,93 7,68 7,32" fill={RED} />
      <text
        x="50"
        y="59"
        textAnchor="middle"
        fontSize="26"
        fontWeight="700"
        fill={WHITE}
        fontFamily="Arial, sans-serif"
      >
        PARE
      </text>
    </>
  ),
  'sign.regulatory.priority.yield': (
    <>
      <polygon points="4,8 96,8 50,94" fill={RED} />
      <polygon points="20,17 80,17 50,74" fill={WHITE} />
    </>
  ),
  'sign.regulatory.prohibition.wrong-way': (
    <>
      <circle cx="50" cy="50" r="47" fill={WHITE} />
      <circle cx="50" cy="50" r="43" fill={RED} />
      <rect x="18" y="42" width="64" height="16" fill={WHITE} />
    </>
  ),
  'sign.regulatory.prohibition.no-parking': (
    <>
      <circle cx="50" cy="50" r="47" fill={RED} />
      <circle cx="50" cy="50" r="38" fill={WHITE} />
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fontSize="44"
        fontWeight="700"
        fill={BLACK}
        fontFamily="Arial, sans-serif"
      >
        E
      </text>
      <line x1="23" y1="23" x2="77" y2="77" stroke={RED} strokeWidth="9" />
    </>
  ),
};

/** Whether a vector drawing exists for the sign; activities only use signs that can be drawn. */
export function hasSignDrawing(signId: string): boolean {
  return signId in DRAWINGS;
}

/** Draws a road sign; `description` (the catalog's visual description) is its accessible name. */
export function SignGraphic({ signId, description }: { signId: string; description: string }) {
  const drawing = DRAWINGS[signId];
  if (!drawing) {
    return (
      <p className="sign-fallback" role="img" aria-label={description}>
        {description}
      </p>
    );
  }
  return (
    <svg className="sign-graphic" viewBox="0 0 100 100" role="img" aria-label={description}>
      {drawing}
    </svg>
  );
}
