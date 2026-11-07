'use client';

import { Heart } from 'lucide-react';
import { useFavorites } from '../components/FavoritesProvider';

export default function MockupLikeButton() {
  const { mockupLiked, ready, toggleMockup } = useFavorites();

  return (
    <button type="button" aria-pressed={mockupLiked} disabled={!ready} onClick={toggleMockup}>
      <Heart size={17} fill={mockupLiked ? 'currentColor' : 'none'} aria-hidden="true" /> ถูกใจ
    </button>
  );
}
