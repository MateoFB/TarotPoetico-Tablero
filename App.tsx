import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TarotCardData, PlacedCard, DeckStyle } from './src/types';
import { createDeck, shuffleDeck, getDeckRatio } from './src/services/cardService';
import { Deck } from './src/components/Deck';
import { CardComponent } from './src/components/CardComponent';
import { RotateCcw, Shuffle, Layers } from 'lucide-react';

export default function App() {
  const [deck, setDeck] = useState<TarotCardData[]>([]);
  const [placedCards, setPlacedCards] = useState<PlacedCard[]>([]);
  const [zIndexCounter, setZIndexCounter] = useState(10);
  const [currentDeckStyle, setCurrentDeckStyle] = useState<DeckStyle>('noblet');
  
  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<'DECK' | 'TABLE' | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null); 
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [ghostPosition, setGhostPosition] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate deck ratio and derive approximate pixel dimensions for drag offsets
  const deckRatio = useMemo(() => getDeckRatio(currentDeckStyle), [currentDeckStyle]);
  
  // Dimensions helper for drag centering logic (Approximation based on Tailwind classes)
  // w-32 (128px) on mobile, sm:w-44 (176px) on desktop
  const getCurrentCardDimensions = () => {
    const isDesktop = window.innerWidth >= 640;
    const width = isDesktop ? 176 : 128;
    const height = width / deckRatio;
    return { width, height };
  };

  // Initialize
  useEffect(() => {
    resetGame(currentDeckStyle);
  }, [currentDeckStyle]); // Re-init when deck style changes

  const resetGame = (style: DeckStyle) => {
    const newDeck = shuffleDeck(createDeck(style));
    setDeck(newDeck);
    setPlacedCards([]);
    setZIndexCounter(10);
  };

  const handleShuffle = () => {
    const allCards: TarotCardData[] = [...deck, ...placedCards.map(p => ({
      id: p.id,
      name: p.name,
      number: p.number,
      arcana: p.arcana,
      suit: p.suit,
      imageUrl: p.imageUrl,
      backImageUrl: p.backImageUrl,
      fileName: p.fileName
    }))];
    
    setPlacedCards([]);
    setDeck(shuffleDeck(allCards));
  };

  // --- Mouse Handlers for Drag & Drop ---

  const handleMouseDownDeck = (e: React.MouseEvent) => {
    if (deck.length === 0) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragSource('DECK');
    setGhostPosition({ x: e.clientX, y: e.clientY });
    
    // Center the drag on the card
    const dims = getCurrentCardDimensions();
    setDragOffset({ x: dims.width / 2, y: dims.height / 2 }); 
  };

  const handleMouseDownTableCard = (e: React.MouseEvent, card: PlacedCard) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragSource('TABLE');
    setDraggedCardId(card.instanceId);

    // Calculate offset from top-left of the card to the mouse cursor
    // The card position is (card.x, card.y)
    setDragOffset({
      x: e.clientX - card.x,
      y: e.clientY - card.y
    });

    const newZ = zIndexCounter + 1;
    setZIndexCounter(newZ);
    setPlacedCards(prev => prev.map(c => 
      c.instanceId === card.instanceId ? { ...c, zIndex: newZ } : c
    ));
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    if (dragSource === 'DECK') {
      setGhostPosition({ x: e.clientX, y: e.clientY });
    } else if (dragSource === 'TABLE' && draggedCardId) {
      setPlacedCards(prev => prev.map(c => {
        if (c.instanceId === draggedCardId) {
          return {
            ...c,
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y
          };
        }
        return c;
      }));
    }
  }, [isDragging, dragSource, draggedCardId, dragOffset]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    if (dragSource === 'DECK') {
      const newCardData = deck[0]; 
      const remainingDeck = deck.slice(1);

      const dropX = e.clientX - dragOffset.x;
      const dropY = e.clientY - dragOffset.y;

      const newPlacedCard: PlacedCard = {
        ...newCardData,
        instanceId: Math.random().toString(36).substr(2, 9),
        x: dropX,
        y: dropY,
        isFlipped: false,
        zIndex: zIndexCounter + 1
      };

      setZIndexCounter(prev => prev + 1);
      setPlacedCards(prev => [...prev, newPlacedCard]);
      setDeck(remainingDeck);
    }

    setIsDragging(false);
    setDragSource(null);
    setDraggedCardId(null);
  }, [isDragging, dragSource, deck, dragOffset, zIndexCounter]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleFlip = (instanceId: string) => {
    setPlacedCards(prev => prev.map(c => 
      c.instanceId === instanceId ? { ...c, isFlipped: !c.isFlipped } : c
    ));
  };

  // Helper to render ghost card with correct dimensions
  const ghostDims = isDragging && dragSource === 'DECK' ? getCurrentCardDimensions() : { width: 0, height: 0 };

  return (
    <div 
      ref={containerRef}
      className="relative w-screen h-screen bg-mystic-900 overflow-hidden select-none"
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-mystic-accent to-transparent" />

      {/* Controls */}
      <div className="absolute top-4 left-4 z-[10000] flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex gap-2">
          <button 
            onClick={() => resetGame(currentDeckStyle)}
            className="flex items-center gap-2 px-4 py-2 bg-mystic-800 border border-mystic-gold/50 text-mystic-gold hover:bg-mystic-800/80 rounded transition-colors shadow-lg"
            title="Reset Game"
          >
            <RotateCcw size={18} />
            <span className="font-serif hidden sm:inline">Resetear</span>
          </button>
          <button 
            onClick={handleShuffle}
            className="flex items-center gap-2 px-4 py-2 bg-mystic-800 border border-mystic-gold/50 text-mystic-gold hover:bg-mystic-800/80 rounded transition-colors shadow-lg"
            title="Shuffle All Cards"
          >
            <Shuffle size={18} />
            <span className="font-serif hidden sm:inline">Mezclar</span>
          </button>
        </div>

        {/* Deck Selector */}
        <div className="flex items-center bg-mystic-800 border border-mystic-gold/50 rounded shadow-lg overflow-hidden ml-0 sm:ml-4">
          <div className="px-3 py-2 border-r border-mystic-gold/30 bg-mystic-900/50">
             <Layers size={18} className="text-mystic-gold" />
          </div>
          <select 
            value={currentDeckStyle}
            onChange={(e) => setCurrentDeckStyle(e.target.value as DeckStyle)}
            className="bg-transparent text-mystic-gold font-serif text-sm px-4 py-2 outline-none cursor-pointer hover:bg-mystic-700/50 transition-colors"
          >
            <option value="noblet" className="bg-mystic-900">Jean Noblet (Marseille)</option>
            <option value="cbd" className="bg-mystic-900">CBD (Marseille)</option>
          </select>
        </div>
      </div>

      {/* Information / Title */}
      <div className="absolute top-4 right-4 z-0 text-right opacity-50 pointer-events-none">
        <h1 className="text-2xl font-serif text-mystic-gold">Tablero de Tarot Poético</h1>
        <p className="text-sm font-sans text-slate-400">Mazo actual: {currentDeckStyle === 'noblet' ? 'Jean Noblet' : 'CBD'}</p>
      </div>

      {/* Deck Position */}
      <div className="absolute bottom-8 left-8 z-[1000]">
        <Deck 
          cardsRemaining={deck.length} 
          onMouseDown={handleMouseDownDeck}
          aspectRatio={deckRatio}
        />
      </div>

      {/* Placed Cards Layer */}
      <div className="absolute inset-0 z-10">
        {placedCards.map((card) => (
          <CardComponent
            key={card.instanceId}
            card={card}
            onFlip={handleFlip}
            onMouseDown={(e) => handleMouseDownTableCard(e, card)}
            isDragging={isDragging && draggedCardId === card.instanceId}
            aspectRatio={deckRatio}
          />
        ))}
      </div>

      {/* Ghost Card while Dragging from Deck */}
      {isDragging && dragSource === 'DECK' && (
        <div 
          className="fixed pointer-events-none z-[9999] opacity-80"
          style={{
            left: ghostPosition.x - dragOffset.x,
            top: ghostPosition.y - dragOffset.y,
            width: ghostDims.width,
            height: ghostDims.height,
          }}
        >
             <div className="w-full h-full bg-mystic-800 rounded-xl border-2 border-mystic-gold/50 shadow-2xl flex items-center justify-center">
                 <div className="w-full h-full bg-cover bg-center opacity-80" style={{ backgroundImage: `url(https://www.transparenttextures.com/patterns/black-scales.png)`, backgroundColor: '#1e293b' }} />
             </div>
        </div>
      )}
    </div>
  );
}