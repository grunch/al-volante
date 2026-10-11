// Player-facing copy in Rioplatense Spanish. Keys stay in English (see AGENTS.md, "Idiomas").
export const esAR = {
  appTitle: 'Al volante: Comuna 13',
  appTagline: 'Prepará el examen de licencia B en Núñez, de la teoría al volante.',
  skipToContent: 'Saltar al contenido',
  garageHeading: 'Mi garaje',
  garageSceneLabel: 'Vista 3D del garaje con un auto de práctica',
  garageSceneLoading: 'Cargando el garaje…',
  garageSceneUnavailable:
    'Tu navegador no pudo iniciar los gráficos 3D (WebGL). Podés seguir usando la parte teórica sin problemas.',
  buildStatus: 'En construcción: fase 2, base de la aplicación.',
  footerSources: 'Contenido basado en material público del Gobierno de la Ciudad de Buenos Aires. Proyecto no oficial.',
} as const;

export type MessageKey = keyof typeof esAR;

/** Returns the Spanish copy for a message key; the key type makes missing strings a compile error. */
export function t(key: MessageKey): string {
  return esAR[key];
}
