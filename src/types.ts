export enum ArcanaType {
  MAJOR = 'Major',
  MINOR = 'Minor'
}

export enum Suit {
  BATONS = 'Bâtons',   // Wands
  COUPES = 'Coupes',   // Cups
  EPEES = 'Épées',     // Swords
  DENIERS = 'Deniers', // Pentacles
  NONE = 'None'
}

export type DeckStyle = 'noblet' | 'cbd';

export interface TarotCardData {
  id: string;
  name: string;      // The display name (e.g., "Valet de Bâtons")
  number: number;
  arcana: ArcanaType;
  suit: Suit;
  fileName: string;  // The expected filename for the asset (e.g., "valet_de_batons.jpg")
  imageUrl: string;  // The fully resolved URL
  backImageUrl: string;
}

export interface PlacedCard extends TarotCardData {
  instanceId: string;
  x: number;
  y: number;
  isFlipped: boolean;
  zIndex: number;
}

export interface DragItem {
  type: 'DECK_CARD' | 'TABLE_CARD';
  cardId?: string;
  instanceId?: string;
  offsetX?: number;
  offsetY?: number;
}