'use client';

import { Star } from 'lucide-react';
import { useId } from 'react';
import { useFavorites } from './FavoritesProvider';

export default function FavoriteButton({ robotId, name }: { robotId: string; name: string }) {
  const {ids,ready,error,toggle} = useFavorites();
  const saved = ids.includes(robotId);
  const errorId = useId();
  return <div>
    <button type="button" className="button favorite-button" disabled={!ready} aria-pressed={saved}
      aria-label={`${saved ? 'Remove from favorites / เลิกปักดาว' : 'Save to favorites / ปักดาว'}: ${name}`}
      aria-describedby={error ? errorId : undefined} onClick={event => {event.stopPropagation(); toggle(robotId);}}>
      <Star size={18} aria-hidden="true" fill={saved ? 'currentColor' : 'none'}/>
      {!ready ? 'Loading…' : saved ? 'Saved / ปักดาวแล้ว' : 'Save / ปักดาว'}
    </button>
    {error && <p id={errorId} role="alert" className="muted">{error}</p>}
  </div>;
}
