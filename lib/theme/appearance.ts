export type Appearance = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export const APPEARANCE_KEY = 'gakit.appearance.v1';
export const SYSTEM_QUERY = '(prefers-color-scheme: dark)';

export function parseAppearance(value: unknown): Appearance {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveAppearance(preference: Appearance, systemDark: boolean): ResolvedTheme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

// Both bootstrap and runtime execute these same validators. No user input is
// interpolated into executable script, and only the root attribute is changed.
export const appearanceBootstrap = `(()=>{const parse=${parseAppearance.toString()};const resolve=${resolveAppearance.toString()};let preference='system';try{preference=parse(localStorage.getItem('${APPEARANCE_KEY}'))}catch{}document.documentElement.dataset.theme=resolve(preference,matchMedia('${SYSTEM_QUERY}').matches)})()`;
