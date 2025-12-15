import React from 'react';

interface DeckProps {
  cardsRemaining: number;
  onMouseDown: (e: React.MouseEvent) => void;
  aspectRatio: number;
}

export const Deck: React.FC<DeckProps> = ({ cardsRemaining, onMouseDown, aspectRatio }) => {
  if (cardsRemaining === 0) {
    return (
      <div 
        className="w-32 sm:w-44 border-2 border-dashed border-white/20 rounded-xl flex items-center justify-center"
        style={{ aspectRatio: aspectRatio }}
      >
        <span className="text-white/30 text-sm font-sans">Empty</span>
      </div>
    );
  }

  return (
    <div 
      className="relative w-32 sm:w-44 cursor-grab group"
      style={{ aspectRatio: aspectRatio }}
      onMouseDown={onMouseDown}
    >
      {/* Stack effect */}
      {cardsRemaining > 2 && (
        <div className="absolute top-0 left-0 translate-x-1 translate-y-1 w-full h-full bg-mystic-800 rounded-xl border border-mystic-gold/30" />
      )}
      {cardsRemaining > 1 && (
        <div className="absolute top-0 left-0 translate-x-0.5 translate-y-0.5 w-full h-full bg-mystic-800 rounded-xl border border-mystic-gold/30" />
      )}
      
      {/* Top Card */}
      <div className="absolute top-0 left-0 w-full h-full bg-mystic-800 rounded-xl border border-mystic-gold/40 shadow-2xl flex items-center justify-center overflow-hidden hover:brightness-110 transition-all">
        <div className="w-full h-full bg-repeat" style={{ backgroundImage: `url(https://www.transparenttextures.com/patterns/black-scales.png)`, backgroundColor: '#1e293b' }}>
            <div className="absolute inset-0 m-1 border-4 border-double border-mystic-gold/20 rounded-lg flex flex-col items-center justify-center opacity-70">
                <div className="w-20 h-20 border border-mystic-gold rounded-full flex items-center justify-center mb-4 bg-mystic-900/40">
                    <div className="w-14 h-14 border border-mystic-gold/50 rounded-full rotate-45"></div>
                </div>
                <span className="text-mystic-gold font-serif text-sm tracking-[0.2em] uppercase">Tarot</span>
                <span className="text-white/30 text-xs mt-2 font-sans">{cardsRemaining} Cards</span>
            </div>
        </div>
      </div>
    </div>
  );
};