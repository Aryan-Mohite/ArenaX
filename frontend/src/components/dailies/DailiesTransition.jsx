import { createContext, useContext, useRef, useState, useCallback } from "react";
import gsap from "gsap";

const DailiesTransitionContext = createContext(null);

/**
 * Wraps the app so any component can call `triggerTransition(navigate)` to
 * play the "Trigger -> Overlay -> Target Entry" glitch/wipe sequence from
 * the Dailies spec before the route actually changes underneath it.
 */
export function DailiesTransitionProvider({ children }) {
  const [active, setActive] = useState(false);
  const overlayRef = useRef(null);
  const barsRef = useRef([]);

  const triggerTransition = useCallback((onMidpoint) => {
    setActive(true);

    // Wait one tick for the overlay to mount before animating it.
    requestAnimationFrame(() => {
      const overlay = overlayRef.current;
      const bars = barsRef.current.filter(Boolean);
      if (!overlay) {
        onMidpoint?.();
        setActive(false);
        return;
      }

      gsap.set(bars, { force3D: true, willChange: "transform, opacity" });
      gsap.set(overlay, { willChange: "opacity" });

      const tl = gsap.timeline({
        onComplete: () => setActive(false),
      });

      // Trigger + overlay phase: angled slash bars sweep in from alternating
      // sides with a red glow, staggered slightly for a "slicing" feel. A
      // slightly longer duration + gentler stagger keeps the sweep reading
      // as one continuous motion instead of bars "popping" in individually.
      tl.to(overlay, { opacity: 1, duration: 0.18, ease: "power1.out" }, 0);
      tl.fromTo(
        bars,
        { xPercent: (i) => (i % 2 === 0 ? -130 : 130), opacity: 0, skewX: -12 },
        { xPercent: 0, opacity: 1, skewX: -12, duration: 0.36, ease: "power3.out", stagger: 0.045 },
        0,
      );
      // Beat before the actual route swap — bars fully in, screen held.
      tl.call(() => onMidpoint?.(), null, "+=0.08");
      // Target entry phase: hold briefly so the new route can mount behind
      // the overlay, then wipe the bars back out and fade in tandem so the
      // overlay never lingers as a flat block after the bars have cleared.
      tl.to({}, { duration: 0.14 });
      tl.to(
        bars,
        { xPercent: (i) => (i % 2 === 0 ? 130 : -130), opacity: 0, duration: 0.42, ease: "power2.inOut", stagger: 0.035 },
        ">",
      );
      tl.to(overlay, { opacity: 0, duration: 0.3, ease: "power2.out" }, "<+0.08");
    });
  }, []);

  return (
    <DailiesTransitionContext.Provider value={{ triggerTransition }}>
      {children}
      {active && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
          style={{ opacity: 0, background: "rgba(0,0,0,0.55)" }}
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              ref={(el) => (barsRef.current[i] = el)}
              className="absolute top-0 h-full"
              style={{
                left: `${i * 22}%`,
                width: "18%",
                transform: "skewX(-12deg)",
                background:
                  "linear-gradient(180deg, rgba(255,70,85,0.05) 0%, rgba(255,70,85,0.35) 50%, rgba(255,70,85,0.05) 100%)",
                boxShadow: "0 0 40px 6px rgba(255,70,85,0.45)",
                borderLeft: "1px solid rgba(255,90,95,0.6)",
                borderRight: "1px solid rgba(255,90,95,0.6)",
              }}
            />
          ))}
        </div>
      )}
    </DailiesTransitionContext.Provider>
  );
}

export const useDailiesTransition = () => useContext(DailiesTransitionContext);
