export const FAVORITES_KEY = 'humanoidth:favorites:v1';
export const MAX_FAVORITES = 200;
export function parseFavorites(raw: string | null): string[] {
  if (raw === null) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > MAX_FAVORITES || !value.every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id))) {
    throw new Error('Invalid favorites data');
  }
  return [...new Set(value as string[])];
}
export function toggleFavorite(ids: string[], id: string): string[] {
  return parseFavorites(JSON.stringify(ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]));
}
