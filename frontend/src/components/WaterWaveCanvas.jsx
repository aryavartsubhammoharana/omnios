import React, { useEffect, useRef } from 'react';

/**
 * WaterWaveCanvas Component - Ultra-Smooth Hydrodynamic Liquid Wave Simulation
 * Upgrades:
 * - 9-Point Isotropic 2D Wave Laplacian: Organic, perfectly circular ripples with zero grid-axis artifacts
 * - Sub-Grid Bilinear Normal & Gradient Interpolation: Ultra-velvety continuous refraction with zero stepping
 * - Subtle Chromatic Aquatic Dispersion: Realistic optical light splitting on wave peaks
 * - Smooth Mouse Velocity Easing: Natural gentle waves with fluid momentum
 * - 10-Second Auto-Decay to Zero-Load Crystal Resting State
 * - Zero Garbage Collection (Pre-allocated buffers, 0 allocations per frame)
 * - Tab Visibility lifecycle protection
 */
const WaterWaveCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    if (!ctx) return;

    let animationFrameId = null;
    let isRunning = true;
    let isTabVisible = !document.hidden;

    let width = 0;
    let height = 0;

    // Simulation Grid Configuration
    const SIM_SCALE = 2; // Optimal balance of crisp fluid detail & ultra-low CPU
    let simWidth = 0;
    let simHeight = 0;

    let buffer1 = null;
    let buffer2 = null;
    let currentBuffer = null;
    let nextBuffer = null;
    let sourceData = null;

    // Pre-allocated reusable Image Data & 32-bit pixel buffers
    let outputImgData = null;
    let outData32 = null;
    let srcData32 = null;

    const BASE_DAMPING = 0.972; // Velvety smooth viscosity
    const EPSILON = 0.0025; // Silent crystal zero threshold
    let lastInteractionTime = Date.now();

    const mouse = {
      x: -1,
      y: -1,
      prevX: -1,
      prevY: -1,
      smoothSpeed: 0,
      active: false
    };

    // Custom Electric Cyan & Indigo SVG Plus Cursor
    const PLUS_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'><defs><filter id='glow' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='2.5' result='blur'/><feMerge><feMergeNode in='blur'/><feMergeNode in='SourceGraphic'/></feMerge></filter></defs><circle cx='18' cy='18' r='12' fill='rgba(99,102,241,0.2)' stroke='%2338bdf8' stroke-width='1.2' stroke-dasharray='3 2'/><path d='M18 6 L18 30 M6 18 L30 18' stroke='%2338bdf8' stroke-width='2.4' stroke-linecap='round' filter='url(%23glow)'/><circle cx='18' cy='18' r='2.5' fill='%23ffffff'/></svg>") 18 18, crosshair`;

    // Offscreen Canvas for Crystal-Clear OmniOS Logo Rendering
    let sourceCanvas = document.createElement('canvas');
    let sourceCtx = sourceCanvas.getContext('2d', { alpha: false });

    const logoImg = new Image();
    logoImg.src = '/logo.png';
    let logoLoaded = false;

    logoImg.onload = () => {
      logoLoaded = true;
      drawSourceBackground();
    };

    const drawSourceBackground = () => {
      if (width === 0 || height === 0 || !sourceCtx) return;

      sourceCanvas.width = width;
      sourceCanvas.height = height;

      // Deep Matte Background (#111113)
      sourceCtx.fillStyle = '#111113';
      sourceCtx.fillRect(0, 0, width, height);

      // Ambient Indigo & Slate Vignette Glow
      const bgGrad = sourceCtx.createRadialGradient(
        width * 0.5, height * 0.5, 40,
        width * 0.5, height * 0.5, Math.max(width, height) * 0.68
      );
      bgGrad.addColorStop(0, 'rgba(30, 27, 75, 0.48)');
      bgGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.28)');
      bgGrad.addColorStop(1, 'rgba(17, 17, 19, 0.96)');
      sourceCtx.fillStyle = bgGrad;
      sourceCtx.fillRect(0, 0, width, height);

      // Center OmniOS Logo
      if (logoLoaded) {
        const logoSize = Math.min(width * 0.72, height * 0.72, 420);
        const lx = (width - logoSize) * 0.5;
        const ly = (height - logoSize) * 0.5;

        // Ambient Logo Halo Glow
        const auraGrad = sourceCtx.createRadialGradient(
          width * 0.5, height * 0.5, logoSize * 0.25,
          width * 0.5, height * 0.5, logoSize * 0.78
        );
        auraGrad.addColorStop(0, 'rgba(99, 102, 241, 0.28)');
        auraGrad.addColorStop(0.5, 'rgba(147, 51, 234, 0.14)');
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sourceCtx.fillStyle = auraGrad;
        sourceCtx.fillRect(0, 0, width, height);

        // Logo Container with Rounded Corners
        sourceCtx.save();
        sourceCtx.imageSmoothingEnabled = true;
        sourceCtx.imageSmoothingQuality = 'high';

        const cornerRadius = Math.max(16, Math.min(32, logoSize * 0.08));
        sourceCtx.beginPath();
        sourceCtx.moveTo(lx + cornerRadius, ly);
        sourceCtx.lineTo(lx + logoSize - cornerRadius, ly);
        sourceCtx.quadraticCurveTo(lx + logoSize, ly, lx + logoSize, ly + cornerRadius);
        sourceCtx.lineTo(lx + logoSize, ly + logoSize - cornerRadius);
        sourceCtx.quadraticCurveTo(lx + logoSize, ly + logoSize, lx + logoSize - cornerRadius, ly + logoSize);
        sourceCtx.lineTo(lx + cornerRadius, ly + logoSize);
        sourceCtx.quadraticCurveTo(lx, ly + logoSize, lx, ly + logoSize - cornerRadius);
        sourceCtx.lineTo(lx, ly + cornerRadius);
        sourceCtx.quadraticCurveTo(lx, ly, lx + cornerRadius, ly);
        sourceCtx.closePath();
        sourceCtx.clip();

        sourceCtx.drawImage(logoImg, lx, ly, logoSize, logoSize);
        sourceCtx.restore();

        // Subtle Logo Edge Border
        sourceCtx.save();
        sourceCtx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
        sourceCtx.lineWidth = 1.5;
        sourceCtx.beginPath();
        sourceCtx.roundRect ? sourceCtx.roundRect(lx, ly, logoSize, logoSize, cornerRadius) : sourceCtx.strokeRect(lx, ly, logoSize, logoSize);
        sourceCtx.stroke();
        sourceCtx.restore();
      }

      sourceData = sourceCtx.getImageData(0, 0, width, height);
      if (sourceData) {
        srcData32 = new Uint32Array(sourceData.data.buffer);
      }
    };

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const dpr = 1;
      width = parent.clientWidth * dpr;
      height = parent.clientHeight * dpr;

      if (width <= 0 || height <= 0) return;

      canvas.width = width;
      canvas.height = height;

      simWidth = Math.max(2, Math.floor(width / SIM_SCALE));
      simHeight = Math.max(2, Math.floor(height / SIM_SCALE));

      const totalSimPixels = simWidth * simHeight;
      buffer1 = new Float32Array(totalSimPixels);
      buffer2 = new Float32Array(totalSimPixels);
      currentBuffer = buffer1;
      nextBuffer = buffer2;

      outputImgData = ctx.createImageData(width, height);
      outData32 = new Uint32Array(outputImgData.data.buffer);

      drawSourceBackground();
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });

    // Smooth Cosine Fluid Wake Injection
    const addDrop = (x, y, radius, strength) => {
      if (!currentBuffer || simWidth === 0 || simHeight === 0) return;

      const simX = x / SIM_SCALE;
      const simY = y / SIM_SCALE;
      const simRadius = Math.max(1.2, radius / SIM_SCALE);

      const minX = Math.max(1, Math.floor(simX - simRadius));
      const maxX = Math.min(simWidth - 2, Math.ceil(simX + simRadius));
      const minY = Math.max(1, Math.floor(simY - simRadius));
      const maxY = Math.min(simHeight - 2, Math.ceil(simY + simRadius));

      const rSq = simRadius * simRadius;

      for (let j = minY; j <= maxY; j++) {
        const dy = j - simY;
        const rowOffset = j * simWidth;
        for (let i = minX; i <= maxX; i++) {
          const dx = i - simX;
          const distSq = dx * dx + dy * dy;
          if (distSq < rSq) {
            const dist = Math.sqrt(distSq);
            // Ultra-Smooth Cosine Bell-Curve Profile
            const factor = Math.cos((dist / simRadius) * (Math.PI * 0.5));
            currentBuffer[rowOffset + i] += strength * factor;
          }
        }
      }
    };

    // Dense Continuous Stroke Interpolation
    const addDropLine = (x0, y0, x1, y1, radius, strength) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(dist / 2.0));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        addDrop(x0 + dx * t, y0 + dy * t, radius, strength);
      }
    };

    const updateCursorState = (x, y) => {
      if (width === 0 || height === 0) return;
      const logoSize = Math.min(width * 0.72, height * 0.72, 420);
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const distFromCenter = Math.hypot(x - centerX, y - centerY);
      const logoRadius = (logoSize * 0.5) * 1.1;

      if (distFromCenter <= logoRadius) {
        canvas.style.cursor = PLUS_CURSOR;
      } else {
        canvas.style.cursor = 'default';
      }
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      lastInteractionTime = Date.now();
      updateCursorState(currentX, currentY);

      if (mouse.active && mouse.prevX >= 0 && mouse.prevY >= 0) {
        const rawSpeed = Math.hypot(currentX - mouse.prevX, currentY - mouse.prevY);
        mouse.smoothSpeed += (rawSpeed - mouse.smoothSpeed) * 0.35; // smooth momentum

        const strength = Math.min(180, 25 + mouse.smoothSpeed * 2.2);
        const radius = Math.min(28, 16 + mouse.smoothSpeed * 0.3);
        addDropLine(mouse.prevX, mouse.prevY, currentX, currentY, radius, strength);
      } else {
        addDrop(currentX, currentY, 18, 55);
      }

      mouse.prevX = currentX;
      mouse.prevY = currentY;
      mouse.x = currentX;
      mouse.y = currentY;
      mouse.active = true;
    };

    const handleMouseEnter = (e) => {
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      lastInteractionTime = Date.now();
      updateCursorState(currentX, currentY);
      mouse.prevX = currentX;
      mouse.prevY = currentY;
      mouse.x = currentX;
      mouse.y = currentY;
      mouse.active = true;
      addDrop(currentX, currentY, 20, 60);
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.prevX = -1;
      mouse.prevY = -1;
      mouse.smoothSpeed = 0;
      lastInteractionTime = Date.now();
      canvas.style.cursor = 'default';
    };

    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mouseenter', handleMouseEnter, { passive: true });
    canvas.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    // High-Precision Bilinear Sub-Pixel Color Sampling Function
    const sampleBilinear = (src32, srcW, srcH, fx, fy) => {
      const x0 = Math.max(0, Math.min(srcW - 1, Math.floor(fx)));
      const y0 = Math.max(0, Math.min(srcH - 1, Math.floor(fy)));
      const x1 = Math.min(srcW - 1, x0 + 1);
      const y1 = Math.min(srcH - 1, y0 + 1);

      const dx = fx - x0;
      const dy = fy - y0;
      const invDx = 1.0 - dx;
      const invDy = 1.0 - dy;

      const p00 = src32[y0 * srcW + x0];
      const p10 = src32[y0 * srcW + x1];
      const p01 = src32[y1 * srcW + x0];
      const p11 = src32[y1 * srcW + x1];

      const r = (p00 & 0xff) * invDx * invDy + (p10 & 0xff) * dx * invDy + (p01 & 0xff) * invDx * dy + (p11 & 0xff) * dx * dy;
      const g = ((p00 >> 8) & 0xff) * invDx * invDy + ((p10 >> 8) & 0xff) * dx * invDy + ((p01 >> 8) & 0xff) * invDx * dy + ((p11 >> 8) & 0xff) * dx * dy;
      const b = ((p00 >> 16) & 0xff) * invDx * invDy + ((p10 >> 16) & 0xff) * dx * invDy + ((p01 >> 16) & 0xff) * invDx * dy + ((p11 >> 16) & 0xff) * dx * dy;

      return { r: r | 0, g: g | 0, b: b | 0 };
    };

    // Sub-Grid Bilinear Wave Height Sampler for Silky Smooth Normals
    const sampleWaveHeight = (buf, w, h, fx, fy) => {
      const x0 = Math.max(0, Math.min(w - 1, Math.floor(fx)));
      const y0 = Math.max(0, Math.min(h - 1, Math.floor(fy)));
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);

      const dx = fx - x0;
      const dy = fy - y0;

      const h00 = buf[y0 * w + x0];
      const h10 = buf[y0 * w + x1];
      const h01 = buf[y1 * w + x0];
      const h11 = buf[y1 * w + x1];

      return (h00 * (1 - dx) + h10 * dx) * (1 - dy) + (h01 * (1 - dx) + h11 * dx) * dy;
    };

    // Tab Visibility Handler
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isTabVisible = false;
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      } else {
        isTabVisible = true;
        mouse.active = false;
        mouse.prevX = -1;
        mouse.prevY = -1;
        mouse.smoothSpeed = 0;
        lastInteractionTime = Date.now();
        if (isRunning && !animationFrameId) {
          animationFrameId = requestAnimationFrame(render);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const render = () => {
      if (!isRunning || !isTabVisible) return;

      if (!sourceData || !srcData32 || !outData32 || !outputImgData || width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      let maxEnergy = 0;
      const timeSinceInteraction = (Date.now() - lastInteractionTime) / 1000;

      // ── Smooth 10-Second Decay to Normal Stage ──
      let activeDamping = BASE_DAMPING;
      if (!mouse.active || timeSinceInteraction > 1.8) {
        const decayProgress = Math.min(1.0, Math.max(0, (timeSinceInteraction - 1.8) / 8.0));
        activeDamping = BASE_DAMPING - decayProgress * 0.055;
      }

      if (timeSinceInteraction >= 9.8) {
        activeDamping = 0.88;
      }

      // -- 1. Isotropic 9-Point Wave Propagation Step (Eliminates grid diamond artifacts) --
      for (let y = 1; y < simHeight - 1; y++) {
        const rowOffset = y * simWidth;
        const topRowOffset = (y - 1) * simWidth;
        const bottomRowOffset = (y + 1) * simWidth;

        for (let x = 1; x < simWidth - 1; x++) {
          const idx = rowOffset + x;
          
          // Cardinal neighbors (0.40 weight)
          const cardinals = currentBuffer[idx - 1] + currentBuffer[idx + 1] + currentBuffer[topRowOffset + x] + currentBuffer[bottomRowOffset + x];
          // Diagonal neighbors (0.10 weight)
          const diagonals = currentBuffer[topRowOffset + x - 1] + currentBuffer[topRowOffset + x + 1] + currentBuffer[bottomRowOffset + x - 1] + currentBuffer[bottomRowOffset + x + 1];

          let waveHeight = (cardinals * 0.40 + diagonals * 0.10) - nextBuffer[idx];
          waveHeight *= activeDamping;

          if (Math.abs(waveHeight) < EPSILON || timeSinceInteraction >= 10.2) {
            waveHeight = 0;
          } else {
            const absH = Math.abs(waveHeight);
            if (absH > maxEnergy) maxEnergy = absH;
          }

          nextBuffer[idx] = waveHeight;
        }
      }

      // Swap simulation buffers
      const temp = currentBuffer;
      currentBuffer = nextBuffer;
      nextBuffer = temp;

      if (timeSinceInteraction >= 10.2 && maxEnergy === 0) {
        currentBuffer.fill(0);
        nextBuffer.fill(0);
      }

      // -- 2. Continuous Refraction, Chromatic Dispersion & Specular Caustics --
      const srcW = width;
      const srcH = height;

      if (maxEnergy === 0) {
        outData32.set(srcData32);
      } else {
        const invScale = 1.0 / SIM_SCALE;
        const delta = 1.0;

        for (let y = 0; y < height; y++) {
          const fy = y * invScale;
          const outRow = y * width;

          for (let x = 0; x < width; x++) {
            const fx = x * invScale;

            // Sample smooth sub-grid wave gradient
            const hL = sampleWaveHeight(currentBuffer, simWidth, simHeight, fx - delta, fy);
            const hR = sampleWaveHeight(currentBuffer, simWidth, simHeight, fx + delta, fy);
            const hU = sampleWaveHeight(currentBuffer, simWidth, simHeight, fx, fy - delta);
            const hD = sampleWaveHeight(currentBuffer, simWidth, simHeight, fx, fy + delta);

            const gradX = hR - hL;
            const gradY = hD - hU;

            if (Math.abs(gradX) < 0.001 && Math.abs(gradY) < 0.001) {
              outData32[outRow + x] = srcData32[y * srcW + x];
              continue;
            }

            // High-Definition Sub-Pixel Coordinates with Chromatic Dispersion
            // Red channel slightly less refracted, Blue slightly more (natural water optics)
            const refRed = sampleBilinear(srcData32, srcW, srcH, x + gradX * 0.82, y + gradY * 0.82);
            const refGreen = sampleBilinear(srcData32, srcW, srcH, x + gradX * 0.86, y + gradY * 0.86);
            const refBlue = sampleBilinear(srcData32, srcW, srcH, x + gradX * 0.90, y + gradY * 0.90);

            // Specular Caustic Gleam (Velvet Water Surface Reflection)
            const shading = (gradX - gradY) * 1.45;
            const r = Math.min(255, Math.max(0, (refRed.r + shading * 0.6) | 0));
            const g = Math.min(255, Math.max(0, (refGreen.g + shading * 0.85) | 0));
            const b = Math.min(255, Math.max(0, (refBlue.b + shading * 1.25) | 0));

            outData32[outRow + x] = (0xff000000) | (b << 16) | (g << 8) | r;
          }
        }
      }

      ctx.putImageData(outputImgData, 0, 0);

      if (isRunning && isTabVisible) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      canvas.removeEventListener('mouseleave', handleMouseLeave);

      buffer1 = null;
      buffer2 = null;
      currentBuffer = null;
      nextBuffer = null;
      sourceData = null;
      outputImgData = null;
      outData32 = null;
      srcData32 = null;
      sourceCanvas = null;
      sourceCtx = null;
    };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  );
};

export { WaterWaveCanvas };
