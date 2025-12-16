import React, { useState, useEffect } from 'react';
import { PlacedCard } from '../types';
import { RotateCw } from 'lucide-react';

interface CardComponentProps {
  card: PlacedCard;
  style?: React.CSSProperties;
  onStart?: (e: React.MouseEvent | React.TouchEvent) => void;
  onRotateStart?: (e: React.MouseEvent | React.TouchEvent) => void; 
  isDragging?: boolean;
  isRotating?: boolean; // New prop
  aspectRatio: number;
  transitionDuration?: string;
}

export const CardComponent: React.FC<CardComponentProps> = ({ 
  card, 
  style, 
  onStart,
  onRotateStart,
  isDragging,
  isRotating,
  aspectRatio,
  transitionDuration = '0.2s'
}) => {
  const [imgSrc, setImgSrc] = useState(card.imageUrl);
  const [hasError, setHasError] = useState(false);

  // Update local state when the card prop changes
  useEffect(() => {
    setImgSrc(card.imageUrl);
    setHasError(false);
  }, [card.imageUrl]);

  const handleImageError = () => {
    if (!hasError) {
      console.warn(`Failed to load image: ${card.imageUrl}. Falling back to placeholder.`);
      setHasError(true);
      const encodedName = encodeURIComponent(card.name);
      setImgSrc(`https://placehold.co/300x520/f5f5dc/333333.png?text=${encodedName}&font=playfair-display`);
    }
  };

  // Disable transition if dragging OR rotating to prevent "fighting" the mouse movement
  const shouldDisableTransition = isDragging || isRotating;

  return (
    <div
      className={`absolute w-24 sm:w-44 cursor-grab select-none group ${isDragging ? 'z-50 shadow-2xl' : ''}`}
      style={{
        left: card.x,
        top: card.y,
        aspectRatio: aspectRatio,
        zIndex: isDragging || isRotating ? 9999 : card.zIndex,
        // Combine rotation and scale
        transform: `rotate(${card.rotation}deg) scale(${isDragging ? 1.05 : 1})`,
        transition: shouldDisableTransition ? 'none' : `transform ${transitionDuration}, left ${transitionDuration}, top ${transitionDuration}`,
        ...style
      }}
      onMouseDown={onStart}
      onTouchStart={onStart}
    >
      {/* Rotation Control - Visible on Hover or Touch */}
      {!isDragging && (
        <button
          onMouseDown={(e) => {
            e.stopPropagation(); 
            e.preventDefault(); 
            onRotateStart && onRotateStart(e);
          }}
          onTouchStart={(e) => {
            e.stopPropagation(); 
            // e.preventDefault(); // Do not prevent default here on touch to allow event propagation if needed
            onRotateStart && onRotateStart(e);
          }}
          // Made larger and always barely visible on mobile for accessibility, full opacity on hover
          className="absolute -top-4 -right-4 sm:-top-3 sm:-right-3 z-[100] bg-mystic-800 text-mystic-gold border border-mystic-gold rounded-full p-2 sm:p-1.5 opacity-50 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg hover:bg-mystic-700 hover:scale-110 cursor-crosshair touch-manipulation"
          title="Hold & Drag to Rotate"
        >
          <RotateCw size={16} className="sm:w-3.5 sm:h-3.5" />
        </button>
      )}

      {/* Perspective Container */}
      <div className="relative w-full h-full perspective-1000 pointer-events-none">
        {/* Inner Card */}
        <div 
          className={`relative w-full h-full duration-700 transform-style-3d shadow-xl rounded-xl pointer-events-auto ${
            card.isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* FRONT */}
          <div className="absolute w-full h-full backface-hidden rounded-xl overflow-hidden border border-mystic-gold/30 bg-mystic-800">
             <div className="w-full h-full bg-repeat" style={{ backgroundImage: `url(${card.backImageUrl})`, backgroundColor: '#1e293b' }}>
                <div className="flex flex-col items-center justify-center h-full border-4 border-double border-mystic-gold/20 m-1 rounded-lg">
                    <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full border border-mystic-gold/30 flex items-center justify-center bg-mystic-900/50 backdrop-blur-sm">
                        <span className="text-mystic-gold/50 text-2xl sm:text-3xl font-serif">☾</span>
                    </div>
                </div>
             </div>
          </div>

          {/* BACK */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-xl overflow-hidden bg-[#f4e4bc] border border-stone-800">
            <div className="w-full h-full p-1 sm:p-2 flex flex-col items-center justify-center">
               <img 
                src={imgSrc} 
                alt={card.name} 
                onError={handleImageError}
                className="w-full h-full object-contain filter contrast-[1.05] sepia-[0.1]" 
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};