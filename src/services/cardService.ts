import { TarotCardData, ArcanaType, Suit, DeckStyle } from '../types';

// CONFIGURATION:
// Set this to true if you have placed your images in local folders
// Expected structure:
//   public/cards/noblet/le_bateleur.jpg
//   public/cards/cbd/le_bateleur.jpg
const USE_LOCAL_IMAGES = true;
const LOCAL_BASE_URL = '/cards'; 

/* 
  FILENAME CONVENTION GUIDE (All lowercase, no accents, spaces/apostrophes -> underscores):
  
  Majors:
  0: le_mat.jpg
  1: le_bateleur.jpg
  2: la_papesse.jpg
  3: l_imperatrice.jpg
  4: l_empereur.jpg
  5: le_pape.jpg
  6: l_amoureux.jpg
  7: le_chariot.jpg
  8: la_justice.jpg
  9: l_hermite.jpg
  10: la_roue_de_fortune.jpg
  11: la_force.jpg
  12: le_pendu.jpg
  13: la_mort.jpg
  14: temperance.jpg
  15: le_diable.jpg
  16: la_maison_dieu.jpg
  17: l_etoile.jpg
  18: la_lune.jpg
  19: le_soleil.jpg
  20: le_jugement.jpg
  21: le_monde.jpg

  Minors (Suits: batons, coupes, epees, deniers):
  Ace: as_de_batons.jpg
  2-10: 2_de_batons.jpg ... 10_de_batons.jpg
  Valet: valet_de_batons.jpg
  Cavalier: cavalier_de_batons.jpg
  Royne: royne_de_batons.jpg
  Roy: roy_de_batons.jpg
*/

// Helper to normalize strings for filenames (e.g. "L'Impératrice" -> "l_imperatrice")
const normalizeToFilename = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/['\s]/g, "_"); // Replace spaces and apostrophes with underscore
};

// Returns the width/height ratio.
// Noblet is approx 354x566 (Ratio ~0.625)
// Standard/CBD is often taller, approx 1:1.75 (Ratio ~0.57)
export const getDeckRatio = (style: DeckStyle): number => {
  if (style === 'noblet') {
    return 354 / 566; 
  }
  // Default/CBD
  return 300 / 525; // Approx 1:1.75 standard tarot ratio
};

const getCardAssetUrl = (fileName: string, displayName: string, type: 'front' | 'back', deckStyle: DeckStyle): string => {
  // Back Designs
  if (type === 'back') {
    if (deckStyle === 'noblet') {
      return 'https://www.transparenttextures.com/patterns/black-scales.png'; // Dark mystic
    } else {
      return 'https://www.transparenttextures.com/patterns/wood-pattern.png'; // Wood/Natural for CBD
    }
  }

  // Front Images (Real)
  if (USE_LOCAL_IMAGES) {
    return `${LOCAL_BASE_URL}/${deckStyle}/${fileName}.jpg`;
  }

  // FALLBACK: Dynamic Placeholders
  const encodedName = encodeURIComponent(displayName);
  const deckLabel = deckStyle === 'noblet' ? 'JN' : 'CBD';
  
  // Distinct visual styles for placeholders
  let bgColor = 'f5f5dc'; 
  let textColor = '333333';
  
  if (deckStyle === 'noblet') {
    // Noblet: Darker, older feel
    if (displayName.includes('Bâtons')) { bgColor = '2d5a27'; textColor = 'f5f5dc'; }
    if (displayName.includes('Coupes')) { bgColor = 'a32cc4'; textColor = 'ffffff'; }
    if (displayName.includes('Épées')) { bgColor = '3b82f6'; textColor = 'ffffff'; }
    if (displayName.includes('Deniers')) { bgColor = 'd97706'; textColor = 'ffffff'; }
    if (displayName.includes('Major')) { bgColor = '0f172a'; textColor = 'ffd700'; }
  } else {
    // CBD: Brighter, cleaner feel (simulated)
    if (displayName.includes('Bâtons')) { bgColor = '4ade80'; textColor = '064e3b'; }
    if (displayName.includes('Coupes')) { bgColor = 'f472b6'; textColor = '831843'; }
    if (displayName.includes('Épées')) { bgColor = '60a5fa'; textColor = '1e3a8a'; }
    if (displayName.includes('Deniers')) { bgColor = 'facc15'; textColor = '713f12'; }
    if (displayName.includes('Major')) { bgColor = '475569'; textColor = 'f8fafc'; }
  }

  return `https://placehold.co/300x520/${bgColor}/${textColor}.png?text=${encodedName}+(${deckLabel})&font=playfair-display`;
};

// New Helper Function to update assets for an existing card object (preserving other data)
export const updateCardAssets = <T extends TarotCardData>(card: T, style: DeckStyle): T => {
  return {
    ...card,
    imageUrl: getCardAssetUrl(card.fileName, card.name, 'front', style),
    backImageUrl: getCardAssetUrl('back', 'Back', 'back', style)
  };
};

// Tarot de Marseille Major Arcana
const majorArcanaData = [
  { number: 0, name: "Le Mat" },
  { number: 1, name: "Le Bateleur" },
  { number: 2, name: "La Papesse" },
  { number: 3, name: "L'Impératrice" },
  { number: 4, name: "L'Empereur" },
  { number: 5, name: "Le Pape" },
  { number: 6, name: "L'Amoureux" },
  { number: 7, name: "Le Chariot" },
  { number: 8, name: "La Justice" }, 
  { number: 9, name: "L'Hermite" },
  { number: 10, name: "La Roue de Fortune" },
  { number: 11, name: "La Force" },   
  { number: 12, name: "Le Pendu" },
  { number: 13, name: "La Mort" },
  { number: 14, name: "Tempérance" },
  { number: 15, name: "Le Diable" },
  { number: 16, name: "La Maison Dieu" },
  { number: 17, name: "L'Étoile" },
  { number: 18, name: "La Lune" },
  { number: 19, name: "Le Soleil" },
  { number: 20, name: "Le Jugement" },
  { number: 21, name: "Le Monde" }
];

const suits = [Suit.BATONS, Suit.COUPES, Suit.EPEES, Suit.DENIERS];

export const createDeck = (deckStyle: DeckStyle): TarotCardData[] => {
  const deck: TarotCardData[] = [];

  // 1. Create Major Arcana
  majorArcanaData.forEach((data) => {
    const id = `major_${data.number}`;
    const fileName = normalizeToFilename(data.name);
    deck.push({
      id,
      name: data.name,
      number: data.number,
      arcana: ArcanaType.MAJOR,
      suit: Suit.NONE,
      fileName,
      imageUrl: getCardAssetUrl(fileName, data.name, 'front', deckStyle),
      backImageUrl: getCardAssetUrl('back', 'Back', 'back', deckStyle) 
    });
  });

  // 2. Create Minor Arcana
  suits.forEach((suit) => {
    for (let i = 1; i <= 14; i++) {
      let name = '';
      
      // French numbering/naming for cards
      if (i <= 10) {
        name = `${i} de ${suit}`; 
        if (i === 1) name = `As de ${suit}`;
      }
      
      // Court Cards
      if (i === 11) { name = `Valet de ${suit}`; }
      if (i === 12) { name = `Cavalier de ${suit}`; }
      if (i === 13) { name = `Royne de ${suit}`; } 
      if (i === 14) { name = `Roy de ${suit}`; }    

      const fileName = normalizeToFilename(name);
      const id = `${normalizeToFilename(suit)}_${i}`;

      deck.push({
        id,
        name,
        number: i,
        arcana: ArcanaType.MINOR,
        suit: suit,
        fileName,
        imageUrl: getCardAssetUrl(fileName, name, 'front', deckStyle),
        backImageUrl: getCardAssetUrl('back', 'Back', 'back', deckStyle)
      });
    }
  });

  return deck;
};

export const shuffleDeck = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};