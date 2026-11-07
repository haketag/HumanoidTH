'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { FAVORITES_KEY, parseFavorites, toggleFavorite } from '@/lib/favorites';

const mockupKey = 'humanoidth:optimus-prime-mockup:liked';
const FavoritesContext = createContext<{
  ids: string[];
  ready: boolean;
  error: string;
  toggle: (id: string) => void;
  mockupLiked: boolean;
  toggleMockup: () => void;
} | null>(null);
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [mockupLiked, setMockupLiked] = useState(false);
  const current = useRef<string[]>([]);
  useEffect(() => {
    const load = () => {
      try { const next = parseFavorites(localStorage.getItem(FAVORITES_KEY)); current.current = next; setIds(next); setError(''); }
      catch { setError('อ่านรายการปักดาวไม่ได้ ข้อมูลอาจเสียหายหรือเบราว์เซอร์ปิดกั้นพื้นที่จัดเก็บ / Cannot read favorites.'); }
      setReady(true);
    };
    const loadMockup = () => {
      try { setMockupLiked(localStorage.getItem(mockupKey) === 'true'); }
      catch { /* Storage can be disabled. */ }
    };
    load();
    loadMockup();
    const sync = (event: StorageEvent) => {
      if (event.key === FAVORITES_KEY || event.key === null) load();
      if (event.key === mockupKey || event.key === null) loadMockup();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const toggle = (id: string) => {
    try {
      const next = toggleFavorite(current.current, id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      current.current = next;
      setIds(next);
      setError('');
    } catch { setError('บันทึกรายการไม่ได้ โปรดอนุญาตพื้นที่จัดเก็บหรือเก็บไม่เกิน 200 รายการ / Cannot save favorites.'); }
  };
  function toggleMockup() {
    const next = !mockupLiked;
    try {
      if (next) localStorage.setItem(mockupKey, 'true');
      else localStorage.removeItem(mockupKey);
    } catch { /* Keep the selection for the current visit. */ }
    setMockupLiked(next);
  }
  return <FavoritesContext.Provider value={{ids,ready,error,toggle,mockupLiked,toggleMockup}}>{children}</FavoritesContext.Provider>;
}
export function useFavorites() {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error('FavoritesProvider is required');
  return value;
}
