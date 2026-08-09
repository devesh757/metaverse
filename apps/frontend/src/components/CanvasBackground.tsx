"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  phase: number;
  speed: number;
}

interface Nebula {
  x: number;
  y: number;
  r: number;
  hue: number;
  vx: number;
  vy: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export default function CanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const stars: Star[] = Array.from({ length: 140 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.4 + 0.3,
      baseAlpha: Math.random() * 0.5 + 0.15,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.005,
    }));

    const nebulae: Nebula[] = [
      { x: w * 0.25, y: h * 0.3, r: 420, hue: 258, vx: 0.12, vy: 0.08 },
      { x: w * 0.8, y: h * 0.7, r: 380, hue: 188, vx: -0.1, vy: -0.06 },
      { x: w * 0.55, y: h * 0.12, r: 300, hue: 155, vx: 0.06, vy: 0.12 },
    ];

    let shooting: ShootingStar | null = null;
    let nextShoot = performance.now() + 2600;

    let t = 0;
    const draw = (now: number) => {
      t += 0.008;
      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createRadialGradient(
        w / 2,
        h / 2,
        0,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.75
      );
      grad.addColorStop(0, "#0b0d1f");
      grad.addColorStop(1, "#04050c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (const n of nebulae) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -n.r) n.x = w + n.r;
        if (n.x > w + n.r) n.x = -n.r;
        if (n.y < -n.r) n.y = h + n.r;
        if (n.y > h + n.r) n.y = -n.r;

        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, `hsla(${n.hue}, 90%, 60%, 0.10)`);
        g.addColorStop(0.5, `hsla(${n.hue}, 90%, 50%, 0.045)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
      }

      for (const s of stars) {
        const alpha =
          s.baseAlpha *
          (0.55 + 0.45 * Math.sin(s.phase + now * 0.001 * s.speed * 60));
        ctx.beginPath();
        ctx.fillStyle = `rgba(220, 230, 255, ${alpha})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (now > nextShoot && !shooting) {
        const fromLeft = Math.random() > 0.5;
        shooting = {
          x: fromLeft ? -40 : w + 40,
          y: Math.random() * h * 0.4,
          vx: (fromLeft ? 1 : -1) * (9 + Math.random() * 4),
          vy: 3 + Math.random() * 2,
          life: 0,
          maxLife: 70,
        };
        nextShoot = now + 2400 + Math.random() * 3200;
      }

      if (shooting) {
        shooting.life += 1;
        shooting.x += shooting.vx;
        shooting.y += shooting.vy;
        const fade = 1 - shooting.life / shooting.maxLife;
        if (fade <= 0) {
          shooting = null;
        } else {
          const tail = 14;
          const g = ctx.createLinearGradient(
            shooting.x,
            shooting.y,
            shooting.x - shooting.vx * 2,
            shooting.y - shooting.vy * 2
          );
          g.addColorStop(0, `rgba(190, 200, 255, ${0.85 * fade})`);
          g.addColorStop(1, "transparent");
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(shooting.x, shooting.y);
          ctx.lineTo(
            shooting.x - shooting.vx * (tail / 3),
            shooting.y - shooting.vy * (tail / 3)
          );
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden
    />
  );
}
