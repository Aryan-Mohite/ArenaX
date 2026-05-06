import { useEffect, useRef, useState } from "react";

const GAMES = [
  {
    name: "Valorant",
    abbr: "VAL",
    color: "#ff4655",
    orbitR: 110,
    speed: 0.006,
    angle: 0.0,
  },
  {
    name: "CS2",
    abbr: "CS2",
    color: "#f4a523",
    orbitR: 155,
    speed: 0.004,
    angle: 1.05,
  },
  {
    name: "League",
    abbr: "LoL",
    color: "#c89b3c",
    orbitR: 200,
    speed: 0.003,
    angle: 2.09,
  },
  {
    name: "Apex Legends",
    abbr: "APX",
    color: "#fc4b08",
    orbitR: 110,
    speed: 0.006,
    angle: 3.14,
  },
  {
    name: "Dota 2",
    abbr: "D2",
    color: "#e05c3a",
    orbitR: 155,
    speed: 0.004,
    angle: 4.19,
  },
  {
    name: "Overwatch 2",
    abbr: "OW2",
    color: "#f99e1a",
    orbitR: 200,
    speed: 0.003,
    angle: 5.24,
  },
];

// Evenly spread on 3 orbit rings — 2 games per ring, opposite each other
// orbitR: 110, 155, 200 px from centre

const STARS = Array.from({ length: 120 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.0 + 0.2,
  a: Math.random() * 0.5 + 0.1,
  t: Math.random() * Math.PI * 2,
  ts: 0.015 + Math.random() * 0.025,
}));

export default function GameRadar() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const tRef = useRef(0);
  const [nodes, setNodes] = useState([]);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const S = 520;

    const loop = () => {
      const t = tRef.current;
      ctx.clearRect(0, 0, S, S);
      const cx = S / 2,
        cy = S / 2;

      // Stars
      STARS.forEach((s) => {
        const tw = 0.5 + 0.5 * Math.sin(s.t + t * s.ts);
        ctx.beginPath();
        ctx.arc(s.x * S, s.y * S, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.a * tw})`;
        ctx.fill();
      });

      // Orbit rings — one per unique radius
      [110, 155, 200].forEach((r) => {
        // Soft outer glow
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,70,85,0.1)";
        ctx.lineWidth = 7;
        ctx.setLineDash([]);
        ctx.stroke();

        // Crisp inner line
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,70,85,0.55)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });

      // Compute node positions for DOM overlay
      const newNodes = GAMES.map((g) => {
        const angle = g.angle + t * g.speed;
        return {
          ...g,
          x: cx + Math.cos(angle) * g.orbitR,
          y: cy + Math.sin(angle) * g.orbitR,
        };
      });
      setNodes(newNodes);

      tRef.current += 1;
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="relative select-none" style={{ width: 520, height: 520 }}>
      {/* Stars + orbit rings */}
      <canvas
        ref={canvasRef}
        width={520}
        height={520}
        className="absolute inset-0"
      />

      {/* Centre crosshair logo */}
      <div
        className="absolute flex items-center justify-center pointer-events-none"
        style={{ inset: 0, zIndex: 10 }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: 80, height: 80 }}
        >
          {/* Ambient glow pulse */}
          <div
            style={{
              position: "absolute",
              inset: -20,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,70,85,0.2) 0%, transparent 70%)",
              animation: "corePulse 3s ease-in-out infinite",
            }}
          />
          {/* Circle border */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "1.5px solid rgba(255,70,85,0.55)",
              background:
                "radial-gradient(circle at 38% 34%, rgba(255,70,85,0.2) 0%, rgba(255,70,85,0.04) 100%)",
              boxShadow:
                "0 0 28px rgba(255,70,85,0.18), inset 0 0 16px rgba(255,70,85,0.1)",
            }}
          />
          {/* SVG crosshair */}
          <svg width="50" height="50" viewBox="0 0 64 64" fill="none">
            <path
              d="M32 6L56 19V45L32 58L8 45V19L32 6Z"
              stroke="#ff4655"
              strokeWidth="1.4"
              fill="rgba(255,70,85,0.06)"
              opacity="0.85"
            />
            <path
              d="M32 16L48 25V43L32 52L16 43V25L32 16Z"
              fill="rgba(255,70,85,0.11)"
            />
            <circle cx="32" cy="32" r="5.5" fill="#ff4655" opacity="0.95" />
            <path
              d="M32 22V13M32 42V51M22 32H13M42 32H51"
              stroke="#ff4655"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Game label nodes */}
      {nodes.map((n) => {
        const isH = hovered === n.abbr;
        return (
          <div
            key={n.abbr}
            onMouseEnter={() => setHovered(n.abbr)}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: "absolute",
              left: n.x,
              top: n.y,
              transform: "translate(-50%, -50%)",
              zIndex: 20,
              cursor: "pointer",
            }}
          >
            {/* Badge */}
            <div
              style={{
                padding: isH ? "6px 14px" : "5px 12px",
                borderRadius: 999,
                border: `1.5px solid ${n.color}${isH ? "cc" : "55"}`,
                background: isH
                  ? `rgba(${hexToRgbStr(n.color)}, 0.18)`
                  : `rgba(${hexToRgbStr(n.color)}, 0.07)`,
                color: n.color,
                fontSize: isH ? 12 : 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                whiteSpace: "nowrap",
                transition: "all 0.2s cubic-bezier(.34,1.56,.64,1)",
                boxShadow: isH
                  ? `0 0 16px ${n.color}44, 0 0 6px ${n.color}22`
                  : "none",
                backdropFilter: "blur(6px)",
                userSelect: "none",
              }}
            >
              {isH ? n.name : n.abbr}
            </div>

            {/* Hover glow dot */}
            {isH && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: n.color,
                  boxShadow: `0 0 10px 4px ${n.color}66`,
                  pointerEvents: "none",
                  zIndex: -1,
                }}
              />
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes corePulse {
          0%,100% { opacity:0.85; transform:scale(1);    }
          50%      { opacity:0.4;  transform:scale(1.15); }
        }
      `}</style>
    </div>
  );
}

function hexToRgbStr(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
