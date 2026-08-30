"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A three-second balloon rise, fired when a winner is revealed.
 *
 * Written by hand rather than pulled from a package: it is forty lines of CSS
 * transforms, it must respect `prefers-reduced-motion`, and it must be rationed.
 * A celebration that plays on every navigation stops being a celebration, so
 * `once` records the moment in `sessionStorage` — pass a key that changes when
 * the champion changes and the balloons return only for a genuinely new winner.
 */

interface Balloon {
  id: number;
  left: number;
  delay: number;
  duration: number;
  hue: number;
  tilt: number;
  size: number;
}

const PALETTE = [45, 262, 188, 152, 45, 262];

export function Celebrate({
  once,
  count = 14,
}: {
  /** Stable id for this celebration. Replays only when the id changes. */
  once: string;
  count?: number;
}) {
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const fired = useRef(false);

  const launch = useCallback(() => {
    if (fired.current) return;
    fired.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const storageKey = `lasalle-celebrated:${once}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Private browsing can throw on sessionStorage; a replayed animation is
      // a better outcome than a crashed page.
    }

    setBalloons(
      Array.from({ length: count }, (_, index) => ({
        id: index,
        left: 4 + (index / count) * 92 + (Math.random() * 6 - 3),
        delay: Math.random() * 900,
        duration: 3200 + Math.random() * 1600,
        hue: PALETTE[index % PALETTE.length] as number,
        tilt: Math.random() * 24 - 12,
        size: 22 + Math.random() * 16,
      })),
    );

    // Remove the nodes once the animation is over so nothing keeps compositing.
    window.setTimeout(() => setBalloons([]), 5200);
  }, [count, once]);

  useEffect(() => {
    const timer = window.setTimeout(launch, 350);
    return () => window.clearTimeout(timer);
  }, [launch]);

  if (balloons.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {balloons.map((balloon) => (
        <span
          key={balloon.id}
          className="absolute bottom-[-12vh] block rounded-[50%_50%_48%_48%/58%_58%_42%_42%]"
          style={{
            left: `${balloon.left}%`,
            width: balloon.size,
            height: balloon.size * 1.22,
            background: `radial-gradient(circle at 32% 28%, hsl(${balloon.hue} 92% 78%), hsl(${balloon.hue} 78% 48%) 62%, hsl(${balloon.hue} 70% 34%))`,
            boxShadow: `0 0 22px hsl(${balloon.hue} 80% 50% / 0.35)`,
            ["--tilt" as string]: `${balloon.tilt}deg`,
            animation: `balloon-float ${balloon.duration}ms cubic-bezier(0.3, 0.1, 0.5, 1) ${balloon.delay}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}
