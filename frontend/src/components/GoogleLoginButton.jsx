import React, { useEffect, useRef, useState, useCallback } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '208360710553-s8ccnmol8g9klrljcumtoda23gqsokl3.apps.googleusercontent.com';

export const GoogleLoginButton = ({ 
  onCredentialReceived, 
  buttonText = 'Continue with Google', 
  textType = 'signin_with', // 'signin_with' | 'signup_with' | 'continue_with'
  className = '' 
}) => {
  const buttonRef = useRef(null);
  const containerRef = useRef(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // -- Cursor Spotlight & 3D Tilt State --
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    // 3D tilt angles (±5 degrees max)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;
    setTilt({ rotateX, rotateY });
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setSdkLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!sdkLoaded || !GOOGLE_CLIENT_ID || !buttonRef.current || !window.google?.accounts?.id) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response?.credential && onCredentialReceived) {
            onCredentialReceived(response.credential);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: 'popup',
        itp_support: true,
      });

      // Clear container before re-rendering
      buttonRef.current.innerHTML = '';

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: textType, // Dynamically 'signup_with' or 'signin_with'
        width: 320,
        logo_alignment: 'left',
      });
    } catch (err) {
      console.warn('Google GSI initialization notice:', err);
    }
  }, [sdkLoaded, onCredentialReceived, textType]);

  const handleCustomClick = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  return (
    <div className={`w-full flex flex-col items-center gap-3 ${className}`}>
      {/* -- Interactive Cursor Effect Container -- */}
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative w-full max-w-[340px] group/gbutton"
        style={{
          perspective: '1000px',
        }}
      >
        {/* Cursor-Following Ambient Radial Aura (Multi-Color Google Spectrum) */}
        <div
          className={`absolute -inset-1 rounded-full blur-xl pointer-events-none transition-opacity duration-300 ${
            isHovered ? 'opacity-80' : 'opacity-0'
          }`}
          style={{
            background: `radial-gradient(140px circle at ${mousePos.x}px ${mousePos.y}px, rgba(66, 133, 244, 0.4), rgba(234, 67, 53, 0.3), rgba(251, 188, 5, 0.25), rgba(52, 168, 83, 0.35), transparent 70%)`,
          }}
        />

        {/* Dynamic Border Sheen that illuminates right under the cursor */}
        <div
          className={`absolute inset-0 rounded-full pointer-events-none transition-opacity duration-300 z-20 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            padding: '1.5px',
            background: `radial-gradient(120px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.9), rgba(66, 133, 244, 0.7), rgba(234, 67, 53, 0.6), transparent 70%)`,
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />

        {/* Main Card with 3D Spring Tilt & Cursor Spotlight */}
        <div
          style={{
            transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`,
            transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
          className="relative w-full rounded-full overflow-hidden shadow-lg transition-shadow duration-300 group-hover/gbutton:shadow-[0_0_30px_rgba(66,133,244,0.28)]"
        >
          {GOOGLE_CLIENT_ID ? (
            /* Google GSI Native Render Box */
            <div className="relative w-full flex justify-center min-h-[44px] bg-[#131316] rounded-full p-0.5">
              {isHovered && (
                <div
                  className="absolute inset-0 pointer-events-none rounded-full"
                  style={{
                    background: `radial-gradient(130px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.12), rgba(66, 133, 244, 0.15), transparent 70%)`,
                  }}
                />
              )}
              <div ref={buttonRef} className="w-full flex justify-center" />
            </div>
          ) : (
            /* Custom Styled Google Pill Button */
            <button
              type="button"
              onClick={handleCustomClick}
              className="relative w-full flex items-center justify-between px-2 py-1.5 h-12 bg-[#17171a] hover:bg-[#1e1e22] text-zinc-100 border border-zinc-700/80 rounded-full font-medium text-sm transition-colors duration-200 cursor-pointer overflow-hidden select-none"
            >
              {isHovered && (
                <div
                  className="absolute inset-0 pointer-events-none rounded-full"
                  style={{
                    background: `radial-gradient(140px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.14), rgba(66, 133, 244, 0.18), transparent 70%)`,
                  }}
                />
              )}

              <div className="flex items-center gap-3 pl-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="font-semibold tracking-tight text-xs text-zinc-100">
                  {buttonText}
                </span>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleLoginButton;
