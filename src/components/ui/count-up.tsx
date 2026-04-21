"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CountUpProps {
  value: number;
  /** Duree de l animation en ms (defaut 1200) */
  duration?: number;
  /** Nombre de decimales (defaut 0) */
  decimals?: number;
  /** Prefixe (ex. "~", "$") */
  prefix?: string;
  /** Suffixe (ex. "%", " leads") */
  suffix?: string;
  /** Formatage localise (defaut "fr-FR") */
  locale?: string;
  className?: string;
  /** Declenche l animation quand l element entre dans le viewport (defaut true) */
  whenInView?: boolean;
}

/**
 * Compteur anime (count-up) avec requestAnimationFrame et declenchement
 * optionnel via IntersectionObserver. Utilise un easing ease-out pour
 * un effet plus naturel.
 */
export function CountUp({
  value,
  duration = 1200,
  decimals = 0,
  prefix = "",
  suffix = "",
  locale = "fr-FR",
  className,
  whenInView = true,
}: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const hasAnimatedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const prevValueRef = useRef(0);

  const run = (from: number, to: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const diff = to - from;
    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + diff * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(to);
        prevValueRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!whenInView) {
      run(prevValueRef.current, value);
      hasAnimatedRef.current = true;
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    const node = ref.current;
    if (!node) return;

    // Si deja anime une fois, on met juste a jour (ex. changement live)
    if (hasAnimatedRef.current) {
      run(prevValueRef.current, value);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            hasAnimatedRef.current = true;
            run(0, value);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, whenInView]);

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(display);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default CountUp;
