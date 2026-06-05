
/**
 * SabotageOverlay renders glowing, glassmorphic neon-magenta ink splatters
 * directly over the Sudoku board. Players must hover/drag on desktop or
 * swipe on mobile to wipe away the ink and reveal the numbers underneath.
 */
export default function SabotageOverlay({ splashes = [], onWipe }) {
  if (splashes.length === 0) return null;

  const handleTouchMove = (e, splashId) => {
    // Prevent default scroll behavior while clearing ink splatters
    e.preventDefault();
    onWipe(splashId);
  };

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl select-none">
      {splashes.map((splash) => {
        return (
          <div
            key={splash.id}
            onMouseMove={() => onWipe(splash.id)}
            onTouchMove={(e) => handleTouchMove(e, splash.id)}
            className="absolute pointer-events-auto cursor-crosshair transition-all duration-300 ease-out flex items-center justify-center animate-scale-in"
            style={{
              top: `${splash.top}%`,
              left: `${splash.left}%`,
              width: `${splash.size}px`,
              height: `${splash.size}px`,
              transform: 'translate(-50%, -50%)',
              opacity: splash.opacity,
            }}
            title="Wipe away the ink!"
          >
            {/* Organic, pulsing glassmorphic splat */}
            <div 
              className="w-full h-full rounded-full bg-pink-500/35 border-2 border-pink-400/50 backdrop-blur-lg flex items-center justify-center relative animate-pulse-slow shadow-lg shadow-pink-500/20"
            >
              {/* Inner dark nucleous drop */}
              <div className="w-[45%] h-[45%] rounded-full bg-pink-600/60 border border-pink-300/40 animate-pulse-subtle flex items-center justify-center">
                <span className="text-[9px] font-sans font-extrabold text-pink-100 uppercase tracking-widest leading-none drop-shadow-md select-none">
                  Wipe!
                </span>
              </div>

              {/* Smaller decorative splash orbits */}
              <div className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-pink-500/40 border border-pink-400/30" />
              <div className="absolute -bottom-2 -left-1 w-3 h-3 rounded-full bg-pink-500/45 border border-pink-400/30" />
              <div className="absolute top-1/2 -right-3 w-2.5 h-2.5 rounded-full bg-pink-500/40" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
