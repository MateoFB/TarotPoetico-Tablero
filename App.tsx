import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TarotCardData, PlacedCard, DeckStyle, ArcanaType } from './src/types';
import { createDeck, shuffleDeck, getDeckRatio, updateCardAssets } from './src/services/cardService';
import { Deck } from './src/components/Deck';
import { CardComponent } from './src/components/CardComponent';
import { Shuffle, Layers, ZoomIn, ZoomOut, Hand, Filter } from 'lucide-react';

type FilterType = 'ALL' | 'MAJOR' | 'MINOR';

// Helper to get coordinates from either Mouse or Touch events
const getClientPos = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
  if ('touches' in e && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  } else if ('clientX' in e) {
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  }
  return { x: 0, y: 0 };
};

// Helper for pinch distance
const getPinchDistance = (e: TouchEvent) => {
  if (e.touches.length < 2) return null;
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

export default function App() {
  const [deck, setDeck] = useState<TarotCardData[]>([]);
  const [reserveCards, setReserveCards] = useState<TarotCardData[]>([]);
  const [placedCards, setPlacedCards] = useState<PlacedCard[]>([]);
  const [zIndexCounter, setZIndexCounter] = useState(10);
  const [currentDeckStyle, setCurrentDeckStyle] = useState<DeckStyle>('noblet');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  
  // --- Animation States ---
  const [isReturningCards, setIsReturningCards] = useState(false);
  const [isShufflingDeck, setIsShufflingDeck] = useState(false);

  // --- Viewport / Camera State ---
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Refs
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  // Track initial pinch distance for zoom
  const lastPinchDistRef = useRef<number | null>(null);
  // Track last touch time to prevent ghost mouse events
  const lastTouchTimeRef = useRef(0);

  // Sync refs with state
  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
  }, [pan, zoom]);

  // --- Interaction State (Drag & Rotate) ---
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<'DECK' | 'TABLE' | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null); 
  
  const [isRotating, setIsRotating] = useState(false);
  const [rotatingCardId, setRotatingCardId] = useState<string | null>(null);
  const rotationCenterRef = useRef({ x: 0, y: 0 }); 
  const lastMouseAngleRef = useRef(0); 

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [ghostPosition, setGhostPosition] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 }); 
  const panStartRef = useRef({ x: 0, y: 0 }); 

  // Calculate deck ratio
  const deckRatio = useMemo(() => getDeckRatio(currentDeckStyle), [currentDeckStyle]);
  
  const getCurrentCardDimensions = () => {
    const isDesktop = window.innerWidth >= 640;
    const width = isDesktop ? 176 : 128; // Smaller on mobile
    const height = width / deckRatio;
    return { width, height };
  };

  // Initialize
  useEffect(() => {
    resetGame('noblet');
    
    // Prevent default touch actions (like scrolling) to allow canvas manipulation
    const preventDefault = (e: Event) => e.preventDefault();
    document.body.addEventListener('touchmove', preventDefault, { passive: false });
    return () => {
      document.body.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  const resetGame = (style: DeckStyle) => {
    const newDeck = shuffleDeck(createDeck(style));
    setDeck(newDeck);
    setReserveCards([]);
    setPlacedCards([]);
    setZIndexCounter(10);
    setActiveFilter('ALL');
    
    // Responsive Initial Center
    const isMobile = window.innerWidth < 640;
    const initialX = window.innerWidth / 2 - (isMobile ? 0 : 100);
    const initialY = window.innerHeight / 2 - (isMobile ? 100 : 200);
    const initialZoom = isMobile ? 0.7 : 1;

    setPan({ x: initialX, y: initialY });
    setZoom(initialZoom);
    setIsReturningCards(false);
    setIsShufflingDeck(false);
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStyle = e.target.value as DeckStyle;
    setCurrentDeckStyle(newStyle);
    setDeck(prevDeck => prevDeck.map(card => updateCardAssets(card, newStyle)));
    setReserveCards(prevReserve => prevReserve.map(card => updateCardAssets(card, newStyle)));
    setPlacedCards(prevPlaced => prevPlaced.map(card => updateCardAssets(card, newStyle)));
  };

  const handleFilterChange = (type: FilterType) => {
    if (isReturningCards || isShufflingDeck) return;
    const allAvailable = [...deck, ...reserveCards];
    let newDeck: TarotCardData[] = [];
    let newReserve: TarotCardData[] = [];

    if (type === 'ALL') {
        newDeck = allAvailable;
        newReserve = [];
    } else if (type === 'MAJOR') {
        newDeck = allAvailable.filter(c => c.arcana === ArcanaType.MAJOR);
        newReserve = allAvailable.filter(c => c.arcana !== ArcanaType.MAJOR);
    } else if (type === 'MINOR') {
        newDeck = allAvailable.filter(c => c.arcana === ArcanaType.MINOR);
        newReserve = allAvailable.filter(c => c.arcana !== ArcanaType.MINOR);
    }
    setDeck(newDeck);
    setReserveCards(newReserve);
    setActiveFilter(type);
  };

  // --- Coordinate Transformations ---
  const screenToWorld = (screenX: number, screenY: number) => {
    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom
    };
  };

  const calculateAngle = (centerX: number, centerY: number, mouseX: number, mouseY: number) => {
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  const handleShuffleAndReset = () => {
    if (placedCards.length === 0) {
      setIsShufflingDeck(true);
      setDeck(prev => shuffleDeck(prev));
      setReserveCards(prev => shuffleDeck(prev));
      setTimeout(() => setIsShufflingDeck(false), 600);
      return;
    }

    const cardDims = getCurrentCardDimensions();
    const deckScreenX = 32 + (cardDims.width / 2);
    const deckScreenY = window.innerHeight - 32 - (cardDims.height / 2);
    const targetWorld = screenToWorld(deckScreenX, deckScreenY);
    const targetX = targetWorld.x - (cardDims.width / 2);
    const targetY = targetWorld.y - (cardDims.height / 2);

    setIsReturningCards(true);

    setPlacedCards(prev => prev.map(c => ({
      ...c,
      x: targetX,
      y: targetY,
      rotation: 0,
      isFlipped: false, 
      zIndex: 9999 
    })));

    setTimeout(() => {
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
      
      const fullCollection = [...deck, ...reserveCards, ...allCardsOnTable];
      const shuffledCollection = shuffleDeck(fullCollection);
      
      setPlacedCards([]);
      
      let nextDeck: TarotCardData[] = [];
      let nextReserve: TarotCardData[] = [];

      if (activeFilter === 'ALL') {
        nextDeck = shuffledCollection;
      } else if (activeFilter === 'MAJOR') {
        nextDeck = shuffledCollection.filter(c => c.arcana === ArcanaType.MAJOR);
        nextReserve = shuffledCollection.filter(c => c.arcana !== ArcanaType.MAJOR);
      } else if (activeFilter === 'MINOR') {
        nextDeck = shuffledCollection.filter(c => c.arcana === ArcanaType.MINOR);
        nextReserve = shuffledCollection.filter(c => c.arcana !== ArcanaType.MINOR);
      }

      setDeck(nextDeck);
      setReserveCards(nextReserve);
      setIsReturningCards(false);
      setIsShufflingDeck(true);
      setTimeout(() => setIsShufflingDeck(false), 600);

    }, 500); 
  };

  // --- Keyboard & Wheel ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) setIsSpacePressed(true);
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
      
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []); 

  // --- UNIFIED INPUT HANDLERS (Mouse & Touch) ---

  const handleStartDeck = (e: React.MouseEvent | React.TouchEvent) => {
    if (deck.length === 0 || isShufflingDeck || isReturningCards) return;
    
    if ('touches' in e) {
        lastTouchTimeRef.current = Date.now();
    } else {
        // Prevent mouse event if touch happened < 500ms ago
        if (Date.now() - lastTouchTimeRef.current < 500) return;
        if ('button' in e && e.button !== 0) return; 
    }

    e.stopPropagation();

    const pos = getClientPos(e);
    setIsDragging(true);
    setDragSource('DECK');
    setGhostPosition(pos);
    dragStartPos.current = pos;
    
    const dims = getCurrentCardDimensions();
    setDragOffset({ x: dims.width / 2, y: dims.height / 2 }); 
  };

  const handleStartTableCard = (e: React.MouseEvent | React.TouchEvent, card: PlacedCard) => {
    if ('touches' in e) {
        lastTouchTimeRef.current = Date.now();
    } else {
        if (Date.now() - lastTouchTimeRef.current < 500) return;
        if ('button' in e && e.button !== 0 && e.button !== undefined) return;
    }

    if (isSpacePressed || isReturningCards) return;

    e.stopPropagation();

    const pos = getClientPos(e);
    setIsDragging(true);
    setDragSource('TABLE');
    setDraggedCardId(card.instanceId);
    dragStartPos.current = pos;

    const mouseWorld = screenToWorld(pos.x, pos.y);
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

  const handleStartRotate = (e: React.MouseEvent | React.TouchEvent, card: PlacedCard) => {
    if ('touches' in e) {
        lastTouchTimeRef.current = Date.now();
    } else {
        if (Date.now() - lastTouchTimeRef.current < 500) return;
    }

    e.stopPropagation();
    e.preventDefault();

    const newZ = zIndexCounter + 1;
    setZIndexCounter(newZ);
    setPlacedCards(prev => prev.map(c => 
      c.instanceId === card.instanceId ? { ...c, zIndex: newZ } : c
    ));

    setIsRotating(true);
    setRotatingCardId(card.instanceId);

    const cardDims = getCurrentCardDimensions();
    const screenX = card.x * zoom + pan.x;
    const screenY = card.y * zoom + pan.y;
    const centerX = screenX + (cardDims.width * zoom) / 2;
    const centerY = screenY + (cardDims.height * zoom) / 2;

    rotationCenterRef.current = { x: centerX, y: centerY };
    
    const pos = getClientPos(e);
    lastMouseAngleRef.current = calculateAngle(centerX, centerY, pos.x, pos.y);
  };

  const handleStartBackground = (e: React.MouseEvent | React.TouchEvent) => {
    const isTouch = 'touches' in e;
    
    if (isTouch) {
        lastTouchTimeRef.current = Date.now();
    } else {
        if (Date.now() - lastTouchTimeRef.current < 500) return;
    }

    const isMouseLeft = 'button' in e && e.button === 0;

    if (isTouch || isSpacePressed || isMouseLeft) {
      setIsPanning(true);
      const pos = getClientPos(e);
      panStartRef.current = pos;
    }
  };

  // Global Move Handler (Window)
  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    // Check for Pinch Zoom first
    if ('touches' in e && e.touches.length === 2) {
      const dist = getPinchDistance(e);
      if (dist && lastPinchDistRef.current) {
        // Calculate zoom delta
        const delta = dist - lastPinchDistRef.current;
        const zoomSensitivity = 0.005;
        let newZoom = zoomRef.current + delta * zoomSensitivity;
        newZoom = Math.min(Math.max(0.1, newZoom), 5);
        
        // Zoom towards center of viewport roughly for simplicity on pinch
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const worldX = (centerX - panRef.current.x) / zoomRef.current;
        const worldY = (centerY - panRef.current.y) / zoomRef.current;
        
        const newPanX = centerX - worldX * newZoom;
        const newPanY = centerY - worldY * newZoom;

        setZoom(newZoom);
        setPan({x: newPanX, y: newPanY});
      }
      lastPinchDistRef.current = dist;
      return; 
    }

    const pos = getClientPos(e as any);

    // 1. Panning Logic
    if (isPanning) {
      const dx = pos.x - panStartRef.current.x;
      const dy = pos.y - panStartRef.current.y;
      
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      panStartRef.current = pos;
      return;
    }

    // 2. Rotation Logic
    if (isRotating && rotatingCardId) {
       const currentAngle = calculateAngle(
         rotationCenterRef.current.x, 
         rotationCenterRef.current.y, 
         pos.x, 
         pos.y
       );

       let deltaAngle = currentAngle - lastMouseAngleRef.current;
       if (deltaAngle > 180) deltaAngle -= 360;
       if (deltaAngle < -180) deltaAngle += 360;

       setPlacedCards(prev => prev.map(c => {
         if (c.instanceId === rotatingCardId) {
           return { ...c, rotation: c.rotation + deltaAngle };
         }
         return c;
       }));
       
       lastMouseAngleRef.current = currentAngle;
       return;
    }

    // 3. Dragging Logic
    if (!isDragging) return;

    if (dragSource === 'DECK') {
      setGhostPosition(pos);
    } else if (dragSource === 'TABLE' && draggedCardId) {
      const currentMouseWorldX = (pos.x - pan.x) / zoom;
      const currentMouseWorldY = (pos.y - pan.y) / zoom;

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

  // Global End Handler (Window)
  const handleEnd = useCallback((e: MouseEvent | TouchEvent) => {
    // Reset pinch ref
    if ('touches' in e && e.touches.length < 2) {
      lastPinchDistRef.current = null;
    }

    // 1. End Panning
    if (isPanning) {
      setIsPanning(false);
    }

    // 2. End Rotation
    if (isRotating) {
      setIsRotating(false);
      setRotatingCardId(null);
      return;
    }

    // 3. End Dragging
    if (!isDragging) return;

    const pos = 'changedTouches' in e && e.changedTouches.length > 0 
      ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
      : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };

    if (dragSource === 'DECK') {
      const newCardData = deck[0]; 
      const remainingDeck = deck.slice(1);

      const dropWorld = screenToWorld(pos.x, pos.y);
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
        rotation: 0 
      };

      setZIndexCounter(prev => prev + 1);
      setPlacedCards(prev => [...prev, newPlacedCard]);
      setDeck(remainingDeck);
    
    } else if (dragSource === 'TABLE' && draggedCardId) {
      const dx = pos.x - dragStartPos.current.x;
      const dy = pos.y - dragStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Relaxed threshold for mobile taps (15px)
      if (distance < 15) {
        handleFlip(draggedCardId);
      }
    }

    setIsDragging(false);
    setDragSource(null);
    setDraggedCardId(null);
  }, [isDragging, dragSource, deck, dragOffset, zIndexCounter, draggedCardId, isPanning, pan, zoom, isRotating]);

  // Attach Global Listeners
  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => handleMove(e);
    const onEnd = (e: MouseEvent | TouchEvent) => handleEnd(e);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [handleMove, handleEnd]);

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
      onMouseDown={handleStartBackground}
      onTouchStart={(e) => {
        // Initialize pinch dist if 2 fingers
        if (e.touches.length === 2) {
          lastPinchDistRef.current = getPinchDistance(e.nativeEvent);
        } else {
          handleStartBackground(e);
        }
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-mystic-accent to-transparent" />

      {/* --- UI LAYER (Fixed) --- */}
      <div className="absolute top-4 left-4 z-[10000] flex flex-col sm:flex-row gap-2 items-start sm:items-center pointer-events-auto">
        <div className="flex gap-2">
          <button 
            onClick={handleShuffleAndReset}
            disabled={isReturningCards || isShufflingDeck}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2 bg-mystic-800 border border-mystic-gold/50 text-mystic-gold rounded transition-all shadow-lg group ${isReturningCards || isShufflingDeck ? 'opacity-50 cursor-wait' : 'hover:bg-mystic-800/80 hover:shadow-mystic-gold/20'}`}
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
            onTouchStart={(e) => e.stopPropagation()}
            className="bg-transparent text-mystic-gold font-serif text-sm px-4 py-2 outline-none cursor-pointer hover:bg-mystic-700/50 transition-colors w-32 sm:w-auto"
          >
            <option value="noblet" className="bg-mystic-900">Jean Noblet</option>
            <option value="cbd" className="bg-mystic-900">CBD</option>
          </select>
        </div>
      </div>

      <div className="absolute bottom-24 sm:bottom-8 right-4 sm:right-8 z-[10000] flex flex-col gap-2 pointer-events-auto">
        <div className="bg-mystic-800 border border-mystic-gold/50 rounded-lg shadow-xl overflow-hidden flex flex-col">
          <button 
            onClick={() => zoomStep(0.2)} 
            className="p-3 sm:p-2 hover:bg-mystic-700 text-mystic-gold border-b border-mystic-gold/20"
            title="Zoom In"
          >
            <ZoomIn size={20} />
          </button>
          <button 
            onClick={() => setZoom(1)} 
            className="p-3 sm:p-2 hover:bg-mystic-700 text-mystic-gold border-b border-mystic-gold/20 font-sans text-xs"
            title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button 
            onClick={() => zoomStep(-0.2)} 
            className="p-3 sm:p-2 hover:bg-mystic-700 text-mystic-gold"
            title="Zoom Out"
          >
            <ZoomOut size={20} />
          </button>
        </div>
        <div className="hidden sm:block bg-mystic-800/80 p-2 rounded text-white/40 text-xs text-center pointer-events-none backdrop-blur-sm">
          <Hand size={12} className="inline mr-1"/> Drag to Pan
        </div>
      </div>

      <div className="absolute top-4 right-4 z-0 text-right opacity-50 pointer-events-none hidden sm:block">
        <h1 className="text-2xl font-serif text-mystic-gold">Tablero de Tarot Poético</h1>
        <p className="text-sm font-sans text-slate-400">Mazo actual: {currentDeckStyle === 'noblet' ? 'Jean Noblet' : 'CBD'}</p>
      </div>

      <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 sm:right-auto sm:left-8 z-[1000] flex flex-col items-center pointer-events-auto">
        <Deck 
          cardsRemaining={deck.length} 
          onStart={handleStartDeck}
          aspectRatio={deckRatio}
          isShuffling={isShufflingDeck}
        />
        
        {/* DECK FILTER BUTTONS - Responsive Container */}
        <div className="mt-4 flex flex-wrap justify-center gap-2 p-1 bg-mystic-900/80 backdrop-blur rounded-2xl sm:rounded-full border border-mystic-gold/30 max-w-[90vw] sm:max-w-none">
            <button 
                onClick={() => handleFilterChange('ALL')}
                onTouchStart={(e) => { e.stopPropagation(); handleFilterChange('ALL'); }}
                className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-serif transition-colors ${activeFilter === 'ALL' ? 'bg-mystic-gold text-mystic-900 font-bold shadow-md' : 'text-mystic-gold hover:bg-mystic-800'}`}
            >
                Completo
            </button>
            <button 
                onClick={() => handleFilterChange('MAJOR')}
                onTouchStart={(e) => { e.stopPropagation(); handleFilterChange('MAJOR'); }}
                className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-serif transition-colors ${activeFilter === 'MAJOR' ? 'bg-mystic-gold text-mystic-900 font-bold shadow-md' : 'text-mystic-gold hover:bg-mystic-800'}`}
            >
                Mayores
            </button>
            <button 
                onClick={() => handleFilterChange('MINOR')}
                onTouchStart={(e) => { e.stopPropagation(); handleFilterChange('MINOR'); }}
                className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-serif transition-colors ${activeFilter === 'MINOR' ? 'bg-mystic-gold text-mystic-900 font-bold shadow-md' : 'text-mystic-gold hover:bg-mystic-800'}`}
            >
                Menores
            </button>
        </div>
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
            onStart={(e) => handleStartTableCard(e, card)}
            onRotateStart={(e) => handleStartRotate(e, card)}
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