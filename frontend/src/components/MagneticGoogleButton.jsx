import React, { useState, useRef } from 'react';

export default function MagneticGoogleButton({ children, className = "" }) {
  const cardRef = useRef(null);
  const [mouseState, setMouseState] = useState({
    x: 0,
    y: 0,
    rotateX: 0,
    rotateY: 0,
    isHovered: false
  });

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // 3D Magnetic tilt physics
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;

    setMouseState({
      x,
      y,
      rotateX,
      rotateY,
      isHovered: true
    });
  };

  const handleMouseLeave = () => {
    setMouseState({
      x: 0,
      y: 0,
      rotateX: 0,
      rotateY: 0,
      isHovered: false
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: mouseState.isHovered
          ? `perspective(800px) rotateX(${mouseState.rotateX}deg) rotateY(${mouseState.rotateY}deg) scale3d(1.015, 1.015, 1.015)`
          : 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        transition: 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
      }}
      className={`relative group rounded-2xl p-[1.5px] transition-all duration-300 ${className}`}
    >
      {/* Dynamic Border Sheen & Spotlight Gradient */}
      <div
        className="absolute inset-0 rounded-2xl transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: mouseState.isHovered ? 1 : 0.45,
          background: mouseState.isHovered
            ? `radial-gradient(180px circle at ${mouseState.x}px ${mouseState.y}px, rgba(99, 102, 241, 0.9), rgba(56, 189, 248, 0.6) 40%, rgba(255, 255, 255, 0.08) 80%)`
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(255, 255, 255, 0.06), rgba(56, 189, 248, 0.2))'
        }}
      />

      {/* Ambient Outer Glow */}
      <div
        className="absolute -inset-1 rounded-2xl blur-md transition-opacity duration-300 pointer-events-none -z-10"
        style={{
          opacity: mouseState.isHovered ? 0.75 : 0,
          background: `radial-gradient(200px circle at ${mouseState.x}px ${mouseState.y}px, rgba(99, 102, 241, 0.5), rgba(56, 189, 248, 0.3))`
        }}
      />

      {/* Inner Card Container */}
      <div className="relative rounded-[15px] bg-[#121624]/90 backdrop-blur-md px-3 py-2 flex flex-col items-center justify-center border border-white/[0.04]">
        {/* Subtle interior spotlight */}
        {mouseState.isHovered && (
          <div
            className="absolute inset-0 rounded-[15px] pointer-events-none"
            style={{
              background: `radial-gradient(160px circle at ${mouseState.x}px ${mouseState.y}px, rgba(255, 255, 255, 0.06), transparent 70%)`
            }}
          />
        )}
        <div className="w-full relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
