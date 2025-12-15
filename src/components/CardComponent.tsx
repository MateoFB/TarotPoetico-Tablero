import React, { useState, useEffect } from 'react';
import { PlacedCard } from '../types';

interface CardComponentProps {
  card: PlacedCard;
  style?: React.CSSProperties;
  onMouseDown?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  aspectRatio: number;
  transitionDuration?: string; // New prop for controlling animation speed
}

export const CardComponent: React.FC<CardComponentProps> = ({ 
  card, 
  style, 
  onMouseDown,
  isDragging,
  aspectRatio,
  transitionDuration = '0.2s'
}) => {
  const [imgSrc, setImgSrc] = useState(card.imageUrl);
  const [hasError, setHasError] = useState(false);

  // Update local state when the card prop changes (e.g. deck switch)
  useEffect(() => {
    setImgSrc(card.imageUrl);
    setHasError(false);
  }, [card.imageUrl]);

  const handleImageError = () => {
    if (!hasError) {
      console.warn(`Failed to load image: ${card.imageUrl}. Falling back to placeholder.`);
      setHasError(true);
      // Fallback to a generated placeholder so the card is still usable
      const encodedName = encodeURIComponent(card.name);
      setImgSrc(`https://placehold.co/300x520/f5f5dc/333333.png?text=${encodedName}&font=playfair-display`);
    }
  };

  return (
    <div
      className={`absolute w-32 sm:w-44 cursor-grab select-none ${isDragging ? 'z-50 scale-105 shadow-2xl' : ''}`}
      style={{
        left: card.x,
        top: card.y,
        aspectRatio: aspectRatio,
        zIndex: isDragging ? 9999 : card.zIndex,
        transition: isDragging ? 'none' : `transform ${transitionDuration}, left ${transitionDuration}, top ${transitionDuration}`,
        ...style
      }}
      onMouseDown={onMouseDown}
    >
      {/* Perspective Container */}
      <div className="relative w-full h-full perspective-1000 group">
        {/* Inner Card (The flipper) */}
        <div 
          className={`relative w-full h-full duration-700 transform-style-3d shadow-xl rounded-xl ${
            card.isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* FRONT (The Patterned Back of the physical card) */}
          <div className="absolute w-full h-full backface-hidden rounded-xl overflow-hidden border border-mystic-gold/30 bg-mystic-800">
             {/* Pattern / Back Image */}
             <div className="w-full h-full bg-repeat" style={{ backgroundImage: `url(${card.backImageUrl})`, backgroundColor: '#1e293b' }}>
                <div className="flex flex-col items-center justify-center h-full border-4 border-double border-mystic-gold/20 m-1 rounded-lg">
                    <div className="w-24 h-24 rounded-full border border-mystic-gold/30 flex items-center justify-center bg-mystic-900/50 backdrop-blur-sm">
                        <span className="text-mystic-gold/50 text-3xl font-serif">☾</span>
                    </div>
                </div>
             </div>
          </div>

          {/* BACK (The Actual Tarot Image) */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-xl overflow-hidden bg-[#f4e4bc] border border-stone-800">
            {/* We use a cream background #f4e4bc to simulate card stock if transparent images are used */}
            <div className="w-full h-full p-2 flex flex-col items-center justify-center">
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