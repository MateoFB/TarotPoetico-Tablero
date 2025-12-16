import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TarotCardData, PlacedCard, DeckStyle } from './src/types';
import { createDeck, shuffleDeck, getDeckRatio, updateCardAssets } from './src/services/cardService';
import { Deck } from './src/components/Deck';
import { CardComponent } from './src/components/CardComponent';
import { Shuffle, Layers, ZoomIn, ZoomOut, Hand } from 'lucide-react';

export default function App() {
  const [deck, setDeck] = useState<TarotCardData[]>([]);
  const [placedCards, setPlacedCards] = useState<PlacedCard[]>([]);
  const [zIndexCounter, setZIndexCounter] = useState(10);
  const [currentDeckStyle, setCurrentDeckStyle] = useState<DeckStyle>('noblet');
  
  // --- Animation States ---
  const [isReturningCards, setIsReturningCards] = useState(false);
  const [isShufflingDeck, setIsShufflingDeck] = useState(false);

  // --- Viewport / Camera State ---
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Refs to hold current viewport state for high-frequency events (wheel)
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);

  // Sync refs with state
  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
  }, [pan, zoom]);

  // --- Interaction State (Drag & Rotate) ---
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<'DECK' | 'TABLE' | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null); 
  
  // Rotation Specific State
  const [isRotating, setIsRotating] = useState(false);
  const [rotatingCardId, setRotatingCardId] = useState<string | null>(null);
  const rotationCenterRef = useRef({ x: 0, y: 0 }); 
  
  // We use the previous mouse angle to calculate continuous deltas
  const lastMouseAngleRef = useRef(0); 

  // Offsets for dragging logic
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Ghost position is always SCREEN coordinates for rendering the drag preview
  const [ghostPosition, setGhostPosition] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 }); 
  const panStartRef = useRef({ x: 0, y: 0 }); 

  // Calculate deck ratio
  const deckRatio = useMemo(() => getDeckRatio(currentDeckStyle), [currentDeckStyle]);
  
  // Dimensions helper
  const getCurrentCardDimensions = () => {
    const isDesktop = window.innerWidth >= 640;
    const width = isDesktop ? 176 : 128;
    const height = width / deckRatio;
    return { width, height };
  };

  // Initialize ONLY on Mount (empty dependency array)
  useEffect(() => {
    resetGame('noblet');
  }, []);

  const resetGame = (style: DeckStyle) => {
    const newDeck = shuffleDeck(createDeck(style));
    setDeck(newDeck);
    setPlacedCards([]);
    setZIndexCounter(10);
    // Center the view roughly
    setPan({ x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 200 });
    setZoom(1);
    setIsReturningCards(false);
    setIsShufflingDeck(false);
  };

  // Logic to handle style switching without resetting the board
  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStyle = e.target.value as DeckStyle;
    setCurrentDeckStyle(newStyle);

    // Update remaining cards in deck
    setDeck(prevDeck => prevDeck.map(card => updateCardAssets(card, newStyle)));

    // Update cards already placed on table (preserving position, rotation, etc.)
    setPlacedCards(prevPlaced => prevPlaced.map(card => updateCardAssets(card, newStyle)));
  };

  // --- Coordinate Transformations ---

  // Convert Screen (Mouse) coordinates to World (Canvas) coordinates
  const screenToWorld = (screenX: number, screenY: number) => {
    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom
    };
  };

  // Helper to calculate angle in degrees from center point to mouse
  const calculateAngle = (centerX: number, centerY: number, mouseX: number, mouseY: number) => {
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    // atan2 returns radians from -PI to PI. Convert to degrees.
    // 0 is usually 3 o'clock.
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  const handleShuffleAndReset = () => {
    if (placedCards.length === 0) {
      // Just shuffle the deck in place if no cards on table
      setIsShufflingDeck(true);
      setDeck(prev => shuffleDeck(prev));
      setTimeout(() => setIsShufflingDeck(false), 600);
      return;
    }

    // 1. Calculate Deck World Position
    const cardDims = getCurrentCardDimensions();
    const deckScreenX = 32 + (cardDims.width / 2); // Center of deck on screen
    const deckScreenY = window.innerHeight - 32 - (cardDims.height / 2);
    
    // Convert that screen point to current world coordinates
    const targetWorld = screenToWorld(deckScreenX, deckScreenY);
    const targetX = targetWorld.x - (cardDims.width / 2); // Adjusted for top-left anchor
    const targetY = targetWorld.y - (cardDims.height / 2);

    // 2. Trigger "Fly Back" Animation
    setIsReturningCards(true);

    // Move all cards to the deck position and flip them down. Also RESET rotation.
    setPlacedCards(prev => prev.map(c => ({
      ...c,
      x: targetX,
      y: targetY,
      rotation: 0, // Reset rotation when returning to deck
      isFlipped: false, 
      zIndex: 9999 // Bring to top while flying
    })));

    // 3. Cleanup after animation completes
    setTimeout(() => {
      // Reconstitute the full deck
      const allCardsOnTable = placedCards.map(p => ({
        id: p.id,
        name: p.name,
        number: p.number,
        arcana: p.arcana,
        suit: p.suit,
        imageUrl: p.imageUrl,
        backImageUrl: p.backImageUrl,
        fileName: p.fileName
      }));
      
      const fullDeck = [...deck, ...allCardsOnTable];
      
      // Clear table
      setPlacedCards([]);
      // Shuffle logic (using current style to maintain images)
      setDeck(shuffleDeck(fullDeck));
      setIsReturningCards(false);

      // 4. Trigger Deck Shake Animation
      setIsShufflingDeck(true);
      setTimeout(() => setIsShufflingDeck(false), 600);

    }, 500); 
  };


  // --- Keyboard Events (Spacebar Pan) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false); 
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- Wheel Event (Zoom) ---
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); 

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      const mouseWorldX = (e.clientX - currentPan.x) / currentZoom;
      const mouseWorldY = (e.clientY - currentPan.y) / currentZoom;

      const zoomSensitivity = 0.001; 
      const delta = -e.deltaY; 
      let newZoom = currentZoom + delta * zoomSensitivity * currentZoom;
      newZoom = Math.min(Math.max(0.1, newZoom), 5);

      if (Math.abs(newZoom - currentZoom) < 0.0001) return;

      const newPanX = e.clientX - mouseWorldX * newZoom;
      const newPanY = e.clientY - mouseWorldY * newZoom;
      
      const newPan = { x: newPanX, y: newPanY };

      zoomRef.current = newZoom;
      panRef.current = newPan;

      setZoom(newZoom);
      setPan(newPan);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []); 

  // --- Mouse Handlers for Interactions ---

  const handleMouseDownDeck = (e: React.MouseEvent) => {
    if (deck.length === 0 || isShufflingDeck || isReturningCards) return;
    if (e.button !== 0) return; 
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragSource('DECK');
    setGhostPosition({ x: e.clientX, y: e.clientY });
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    
    const dims = getCurrentCardDimensions();
    setDragOffset({ x: dims.width / 2, y: dims.height / 2 }); 
  };

  const handleMouseDownTableCard = (e: React.MouseEvent, card: PlacedCard) => {
    if (isSpacePressed || e.button === 1 || isReturningCards) return; 
    if (e.button !== 0) return; 

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragSource('TABLE');
    setDraggedCardId(card.instanceId);
    dragStartPos.current = { x: e.clientX, y: e.clientY };

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

  const handleRotateStart = (e: React.MouseEvent, card: PlacedCard) => {
    e.preventDefault();
    e.stopPropagation();

    // Bring card to front
    const newZ = zIndexCounter + 1;
    setZIndexCounter(newZ);
    setPlacedCards(prev => prev.map(c => 
      c.instanceId === card.instanceId ? { ...c, zIndex: newZ } : c
    ));

    setIsRotating(true);
    setRotatingCardId(card.instanceId);

    // Calculate Card Center on Screen
    const cardDims = getCurrentCardDimensions();
    const screenX = card.x * zoom + pan.x;
    const screenY = card.y * zoom + pan.y;
    const centerX = screenX + (cardDims.width * zoom) / 2;
    const centerY = screenY + (cardDims.height * zoom) / 2;

    rotationCenterRef.current = { x: centerX, y: centerY };
    
    // Initialize the last mouse angle
    lastMouseAngleRef.current = calculateAngle(centerX, centerY, e.clientX, e.clientY);
  };

  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
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

    // 2. Rotation Logic (Incremental)
    if (isRotating && rotatingCardId) {
       const currentMouseAngle = calculateAngle(
         rotationCenterRef.current.x, 
         rotationCenterRef.current.y, 
         e.clientX, 
         e.clientY
       );

       // Calculate delta from previous frame
       let deltaAngle = currentMouseAngle - lastMouseAngleRef.current;
       
       // Normalize delta to be the shortest path (e.g., -179 to +179 shouldn't be +358, but -2)
       // Standard wrap-around handling:
       if (deltaAngle > 180) deltaAngle -= 360;
       if (deltaAngle < -180) deltaAngle += 360;

       setPlacedCards(prev => prev.map(c => {
         if (c.instanceId === rotatingCardId) {
           return { ...c, rotation: c.rotation + deltaAngle };
         }
         return c;
       }));
       
       // Update ref for next frame
       lastMouseAngleRef.current = currentMouseAngle;
       return;
    }

    // 3. Dragging Logic
    if (!isDragging) return;

    if (dragSource === 'DECK') {
      setGhostPosition({ x: e.clientX, y: e.clientY });
    } else if (dragSource === 'TABLE' && draggedCardId) {
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
  }, [isDragging, dragSource, draggedCardId, dragOffset, isPanning, pan, zoom, isRotating, rotatingCardId]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    // 1. End Panning
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // 2. End Rotation
    if (isRotating) {
      setIsRotating(false);
      setRotatingCardId(null);
      return;
    }

    // 3. End Dragging
    if (!isDragging) return;

    if (dragSource === 'DECK') {
      const newCardData = deck[0]; 
      const remainingDeck = deck.slice(1);

      const dropWorld = screenToWorld(e.clientX, e.clientY);
      const cardDims = getCurrentCardDimensions(); 
      
      const finalX = dropWorld.x - (cardDims.width / 2);
      const finalY = dropWorld.y - (cardDims.height / 2);

      const newPlacedCard: PlacedCard = {
        ...newCardData,
        instanceId: Math.random().toString(36).substr(2, 9),
        x: finalX,
        y: finalY,
        isFlipped: false,
        zIndex: zIndexCounter + 1,
        rotation: 0 // Default rotation
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
  }, [isDragging, dragSource, deck, dragOffset, zIndexCounter, draggedCardId, isPanning, pan, zoom, isRotating]);

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
    const centerScreenX = window.innerWidth / 2;
    const centerScreenY = window.innerHeight / 2;
    
    const currentZoom = zoom;
    let newZoom = currentZoom + delta;
    newZoom = Math.min(Math.max(0.1, newZoom), 5);
    
    if (newZoom === currentZoom) return;
    
    // Zoom around center of screen
    const mouseWorldX = (centerScreenX - pan.x) / currentZoom;
    const mouseWorldY = (centerScreenY - pan.y) / currentZoom;
    
    const newPanX = centerScreenX - mouseWorldX * newZoom;
    const newPanY = centerScreenY - mouseWorldY * newZoom;
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const ghostDims = getCurrentCardDimensions();

  return (
    <div 
      ref={containerRef}
      className={`relative w-screen h-screen bg-mystic-900 overflow-hidden select-none ${isSpacePressed || isPanning ? 'cursor-grab active:cursor-grabbing' : ''} ${isRotating ? 'cursor-crosshair' : ''}`}
      onMouseDown={handleBackgroundMouseDown}
    >
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-mystic-accent to-transparent" />

      {/* --- UI LAYER (Fixed) --- */}
      <div className="absolute top-4 left-4 z-[10000] flex flex-col sm:flex-row gap-2 items-start sm:items-center pointer-events-auto">
        <div className="flex gap-2">
          {/* Combined Shuffle & Reset Button */}
          <button 
            onClick={handleShuffleAndReset}
            disabled={isReturningCards || isShufflingDeck}
            className={`flex items-center gap-2 px-6 py-2 bg-mystic-800 border border-mystic-gold/50 text-mystic-gold rounded transition-all shadow-lg group ${isReturningCards || isShufflingDeck ? 'opacity-50 cursor-wait' : 'hover:bg-mystic-800/80 hover:shadow-mystic-gold/20'}`}
          >
            <Shuffle size={18} className={`transition-transform duration-500 ${isShufflingDeck ? 'animate-spin' : 'group-hover:rotate-180'}`} />
            <span className="font-serif font-bold tracking-wider hidden sm:inline">
              {placedCards.length > 0 ? 'Recoger y barajar' : 'Barajar'}
            </span>
          </button>
        </div>

        <div className="flex items-center bg-mystic-800 border border-mystic-gold/50 rounded shadow-lg overflow-hidden ml-0 sm:ml-4">
          <div className="px-3 py-2 border-r border-mystic-gold/30 bg-mystic-900/50">
             <Layers size={18} className="text-mystic-gold" />
          </div>
          <select 
            value={currentDeckStyle}
            onChange={handleStyleChange}
            onMouseDown={(e) => e.stopPropagation()} 
            className="bg-transparent text-mystic-gold font-serif text-sm px-4 py-2 outline-none cursor-pointer hover:bg-mystic-700/50 transition-colors"
          >
            <option value="noblet" className="bg-mystic-900">Jean Noblet (Marseille)</option>
            <option value="cbd" className="bg-mystic-900">CBD (Marseille)</option>
          </select>
        </div>
      </div>

      <div className="absolute bottom-8 right-8 z-[10000] flex flex-col gap-2 pointer-events-auto">
        <div className="bg-mystic-800 border border-mystic-gold/50 rounded-lg shadow-xl overflow-hidden flex flex-col">
          <button 
            onClick={() => zoomStep(0.2)} 
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
            onClick={() => zoomStep(-0.2)} 
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

      <div className="absolute top-4 right-4 z-0 text-right opacity-50 pointer-events-none">
        <h1 className="text-2xl font-serif text-mystic-gold">Tablero de Tarot Poético</h1>
        <p className="text-sm font-sans text-slate-400">Mazo actual: {currentDeckStyle === 'noblet' ? 'Jean Noblet' : 'CBD'}</p>
      </div>

      <div className="absolute bottom-8 left-8 z-[1000] pointer-events-auto">
        <Deck 
          cardsRemaining={deck.length} 
          onMouseDown={handleMouseDownDeck}
          aspectRatio={deckRatio}
          isShuffling={isShufflingDeck}
        />
      </div>

      {/* --- WORLD LAYER (Transformed) --- */}
      <div 
        className="w-full h-full origin-top-left will-change-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        {placedCards.map((card) => (
          <CardComponent
            key={card.instanceId}
            card={card}
            onMouseDown={(e) => handleMouseDownTableCard(e, card)}
            onRotateStart={(e) => handleRotateStart(e, card)}
            isDragging={isDragging && draggedCardId === card.instanceId}
            isRotating={isRotating && rotatingCardId === card.instanceId}
            aspectRatio={deckRatio}
            transitionDuration={isReturningCards ? '0.5s' : '0.2s'}
          />
        ))}
      </div>

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