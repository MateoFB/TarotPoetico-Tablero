import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TarotCardData, PlacedCard, DeckStyle } from './src/types';
import { createDeck, shuffleDeck, getDeckRatio } from './src/services/cardService';
import { Deck } from './src/components/Deck';
import { CardComponent } from './src/components/CardComponent';
import { RotateCcw, Shuffle, Layers, ZoomIn, ZoomOut, Maximize, Hand } from 'lucide-react';

export default function App() {
  const [deck, setDeck] = useState<TarotCardData[]>([]);
  const [placedCards, setPlacedCards] = useState<PlacedCard[]>([]);
  const [zIndexCounter, setZIndexCounter] = useState(10);
  const [currentDeckStyle, setCurrentDeckStyle] = useState<DeckStyle>('noblet');
  
  // --- Viewport / Camera State ---
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<'DECK' | 'TABLE' | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null); 
  
  // Offsets for dragging logic
  // For Table cards: Offset from card's top-left in WORLD coordinates
  // For Deck cards: Offset from card's top-left in SCREEN coordinates (until dropped)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Ghost position is always SCREEN coordinates for rendering the drag preview
  const [ghostPosition, setGhostPosition] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 }); // For click vs drag detection
  const panStartRef = useRef({ x: 0, y: 0 }); // Tracks mouse pos when panning starts

  // Calculate deck ratio
  const deckRatio = useMemo(() => getDeckRatio(currentDeckStyle), [currentDeckStyle]);
  
  // Dimensions helper
  const getCurrentCardDimensions = () => {
    const isDesktop = window.innerWidth >= 640;
    const width = isDesktop ? 176 : 128;
    const height = width / deckRatio;
    return { width, height };
  };

  // Initialize
  useEffect(() => {
    resetGame(currentDeckStyle);
  }, [currentDeckStyle]);

  const resetGame = (style: DeckStyle) => {
    const newDeck = shuffleDeck(createDeck(style));
    setDeck(newDeck);
    setPlacedCards([]);
    setZIndexCounter(10);
    // Reset view slightly centered if needed, or 0,0
    setPan({ x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 200 });
    setZoom(1);
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

  // --- Coordinate Transformations ---

  // Convert Screen (Mouse) coordinates to World (Canvas) coordinates
  const screenToWorld = (screenX: number, screenY: number) => {
    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom
    };
  };

  // --- Keyboard & Wheel Events (Zoom/Pan) ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        if (isPanning) setIsPanning(false);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Prevent browser zoom
      if (e.ctrlKey) {
        e.preventDefault();
      }
      
      // Zoom logic
      // We want to zoom towards the mouse cursor
      const zoomSensitivity = 0.001;
      const newZoom = Math.min(Math.max(0.1, zoom - e.deltaY * zoomSensitivity), 5);
      
      // Calculate where the mouse is in the world currently
      const mouseWorldBefore = screenToWorld(e.clientX, e.clientY);
      
      // Update Zoom
      setZoom(newZoom);

      // We need to adjust Pan so that the point under the mouse stays under the mouse
      // NewPan = MouseScreen - (MouseWorldBefore * NewZoom)
      // Note: Because setState is async, this math technically relies on 'zoom' being current. 
      // For smoother results in React 18, we calculate delta.
      // Ideally, we'd do this in one atomic state update or use refs for mutable values, 
      // but for this complexity, centering zoom or simple zoom is easier. 
      // Let's do simple centered zoom-in/out logic or simple offset correction:
      
      // Simplified Zoom (Zooming at center of screen usually safer for simple implementation, 
      // but let's try cursor zoom).
      
      const scaleFactor = newZoom / zoom;
      const newPanX = e.clientX - (e.clientX - pan.x) * scaleFactor;
      const newPanY = e.clientY - (e.clientY - pan.y) * scaleFactor;

      setPan({ x: newPanX, y: newPanY });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [zoom, pan, isPanning]);


  // --- Mouse Handlers for Interactions ---

  const handleMouseDownDeck = (e: React.MouseEvent) => {
    if (deck.length === 0) return;
    if (e.button !== 0) return; // Only Left Click
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragSource('DECK');
    setGhostPosition({ x: e.clientX, y: e.clientY });
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    
    // For deck, drag offset is from center of card (simple)
    const dims = getCurrentCardDimensions();
    setDragOffset({ x: dims.width / 2, y: dims.height / 2 }); 
  };

  const handleMouseDownTableCard = (e: React.MouseEvent, card: PlacedCard) => {
    if (isSpacePressed || e.button === 1) return; // Allow panning if space is held
    if (e.button !== 0) return; // Only left click for cards

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragSource('TABLE');
    setDraggedCardId(card.instanceId);
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    // Calculate offset in WORLD coordinates
    // We want the cursor to grab the exact point on the card
    const mouseWorld = screenToWorld(e.clientX, e.clientY);
    setDragOffset({
      x: mouseWorld.x - card.x,
      y: mouseWorld.y - card.y
    });

    const newZ = zIndexCounter + 1;
    setZIndexCounter(newZ);
    setPlacedCards(prev => prev.map(c => 
      c.instanceId === card.instanceId ? { ...c, zIndex: newZ } : c
    ));
  };

  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
    // Start Panning if: Middle Click (button 1) OR Spacebar is held OR Left click on background
    if (e.button === 1 || isSpacePressed || e.button === 0) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // 1. Panning Logic
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!isDragging) return;

    // 2. Dragging Logic
    if (dragSource === 'DECK') {
      // Moves in Screen Space
      setGhostPosition({ x: e.clientX, y: e.clientY });
    } else if (dragSource === 'TABLE' && draggedCardId) {
      // Moves in World Space
      // Current Mouse World Pos
      // We can't rely on 'zoom' inside this callback if not included in dep array,
      // but adding zoom to dep array causes re-attach of listeners. 
      // We use the functional update or refs if needed. 
      // For simplicity here, we assume zoom hasn't changed *during* the drag.
      
      // Re-calculating world pos inside callback manually to avoid stale closure issues with simple vars
      const currentMouseWorldX = (e.clientX - pan.x) / zoom;
      const currentMouseWorldY = (e.clientY - pan.y) / zoom;

      setPlacedCards(prev => prev.map(c => {
        if (c.instanceId === draggedCardId) {
          return {
            ...c,
            x: currentMouseWorldX - dragOffset.x,
            y: currentMouseWorldY - dragOffset.y
          };
        }
        return c;
      }));
    }
  }, [isDragging, dragSource, draggedCardId, dragOffset, isPanning, pan, zoom]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDragging) return;

    if (dragSource === 'DECK') {
      const newCardData = deck[0]; 
      const remainingDeck = deck.slice(1);

      // Convert Drop Location (Screen) to World
      const dropWorld = screenToWorld(e.clientX, e.clientY);
      
      // Center the card on the mouse pointer in world space
      // Since dragOffset was pixels in screen space (width/2), we need to scale it to world space
      const cardDims = getCurrentCardDimensions(); // returns pixel dims at scale 1
      
      // We want the card center to be at mouse position
      const finalX = dropWorld.x - (cardDims.width / 2);
      const finalY = dropWorld.y - (cardDims.height / 2);

      const newPlacedCard: PlacedCard = {
        ...newCardData,
        instanceId: Math.random().toString(36).substr(2, 9),
        x: finalX,
        y: finalY,
        isFlipped: false,
        zIndex: zIndexCounter + 1
      };

      setZIndexCounter(prev => prev + 1);
      setPlacedCards(prev => [...prev, newPlacedCard]);
      setDeck(remainingDeck);
    
    } else if (dragSource === 'TABLE' && draggedCardId) {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) {
        handleFlip(draggedCardId);
      }
    }

    setIsDragging(false);
    setDragSource(null);
    setDraggedCardId(null);
  }, [isDragging, dragSource, deck, dragOffset, zIndexCounter, draggedCardId, isPanning, pan, zoom]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleFlip = (instanceId: string) => {
    setPlacedCards(prev => prev.map(c => 
      c.instanceId === instanceId ? { ...c, isFlipped: !c.isFlipped } : c
    ));
  };

  const zoomStep = (delta: number) => {
    setZoom(prev => Math.min(Math.max(0.1, prev + delta), 5));
  };

  const ghostDims = getCurrentCardDimensions();

  return (
    <div 
      ref={containerRef}
      className={`relative w-screen h-screen bg-mystic-900 overflow-hidden select-none ${isSpacePressed || isPanning ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onMouseDown={handleBackgroundMouseDown}
    >
      {/* Background Ambience (Fixed to screen) */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-mystic-accent to-transparent" />

      {/* --- UI LAYER (Fixed) --- */}

      {/* Top Left Controls */}
      <div className="absolute top-4 left-4 z-[10000] flex flex-col sm:flex-row gap-2 items-start sm:items-center pointer-events-auto">
        <div className="flex gap-2">
          <button 
            onClick={() => resetGame(currentDeckStyle)}
            className="flex items-center gap-2 px-4 py-2 bg-mystic-800 border border-mystic-gold/50 text-mystic-gold hover:bg-mystic-800/80 rounded transition-colors shadow-lg"
          >
            <RotateCcw size={18} />
            <span className="font-serif hidden sm:inline">Reset</span>
          </button>
          <button 
            onClick={handleShuffle}
            className="flex items-center gap-2 px-4 py-2 bg-mystic-800 border border-mystic-gold/50 text-mystic-gold hover:bg-mystic-800/80 rounded transition-colors shadow-lg"
          >
            <Shuffle size={18} />
            <span className="font-serif hidden sm:inline">Shuffle</span>
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
            onMouseDown={(e) => e.stopPropagation()} // Prevent pan starting on select click
            className="bg-transparent text-mystic-gold font-serif text-sm px-4 py-2 outline-none cursor-pointer hover:bg-mystic-700/50 transition-colors"
          >
            <option value="noblet" className="bg-mystic-900">Jean Noblet (Marseille)</option>
            <option value="cbd" className="bg-mystic-900">CBD (Marseille)</option>
          </select>
        </div>
      </div>

      {/* Zoom Controls (Bottom Right) */}
      <div className="absolute bottom-8 right-8 z-[10000] flex flex-col gap-2 pointer-events-auto">
        <div className="bg-mystic-800 border border-mystic-gold/50 rounded-lg shadow-xl overflow-hidden flex flex-col">
          <button 
            onClick={() => zoomStep(0.1)} 
            className="p-2 hover:bg-mystic-700 text-mystic-gold border-b border-mystic-gold/20"
            title="Zoom In"
          >
            <ZoomIn size={20} />
          </button>
          <button 
            onClick={() => setZoom(1)} 
            className="p-2 hover:bg-mystic-700 text-mystic-gold border-b border-mystic-gold/20 font-sans text-xs"
            title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button 
            onClick={() => zoomStep(-0.1)} 
            className="p-2 hover:bg-mystic-700 text-mystic-gold"
            title="Zoom Out"
          >
            <ZoomOut size={20} />
          </button>
        </div>
        <div className="bg-mystic-800/80 p-2 rounded text-white/40 text-xs text-center pointer-events-none backdrop-blur-sm">
          <Hand size={12} className="inline mr-1"/> Space + Drag to Pan
        </div>
      </div>

      {/* Information / Title */}
      <div className="absolute top-4 right-4 z-0 text-right opacity-50 pointer-events-none">
        <h1 className="text-2xl font-serif text-mystic-gold">Arcana Tabletop</h1>
        <p className="text-sm font-sans text-slate-400">Current Deck: {currentDeckStyle === 'noblet' ? 'Jean Noblet' : 'CBD'}</p>
      </div>

      {/* Deck Position (Fixed UI) */}
      <div className="absolute bottom-8 left-8 z-[1000] pointer-events-auto">
        <Deck 
          cardsRemaining={deck.length} 
          onMouseDown={handleMouseDownDeck}
          aspectRatio={deckRatio}
        />
      </div>

      {/* --- WORLD LAYER (Transformed) --- */}
      <div 
        className="w-full h-full transform-origin-top-left will-change-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        {placedCards.map((card) => (
          <CardComponent
            key={card.instanceId}
            card={card}
            onMouseDown={(e) => handleMouseDownTableCard(e, card)}
            isDragging={isDragging && draggedCardId === card.instanceId}
            aspectRatio={deckRatio}
          />
        ))}
      </div>

      {/* Ghost Card (UI Layer - follows mouse exactly) */}
      {isDragging && dragSource === 'DECK' && (
        <div 
          className="fixed pointer-events-none z-[9999] opacity-80"
          style={{
            left: ghostPosition.x - dragOffset.x,
            top: ghostPosition.y - dragOffset.y,
            width: ghostDims.width, // Ghost is always UI scale (1) until dropped
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