/**
 * Localization catalog (DATA-01). A minimal key→string table so UI text is
 * external data rather than hard-coded constants. Defaults to Portuguese-first
 * per the game.md spec.
 */
export type Locale = 'pt' | 'en';

export const STRINGS: Record<Locale, Record<string, string>> = {
  pt: {
    app_name: 'OpenCaesar',
    paused: 'Pausado',
    resume: 'Continuar',
    save: 'Salvar',
    restart: 'Reiniciar',
    treasury: 'Tesouro',
    population: 'População',
    prosperity: 'Prosperidade',
    happiness: 'Felicidade',
    low_food: 'Abastecimento de alimentos baixo — construa fazendas e celeiros',
  },
  en: {
    app_name: 'OpenCaesar',
    paused: 'Paused',
    resume: 'Resume',
    save: 'Save',
    restart: 'Restart',
    treasury: 'Treasury',
    population: 'Population',
    prosperity: 'Prosperity',
    happiness: 'Happiness',
    low_food: 'Food supply is low — build farms and granaries',
  },
};

export function localize(locale: Locale, key: string): string {
  const table = STRINGS[locale] ?? STRINGS.pt;
  return table[key] ?? key;
}

export function translateAll(locale: Locale): Record<string, string> {
  return { ...(STRINGS[locale] ?? STRINGS.pt) };
}
