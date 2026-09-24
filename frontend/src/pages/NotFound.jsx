import { Link } from "react-router-dom";
import dragonBg from "../assets/notfound-dragon.jpg";

// Fixed set of falling petal/ember particles — varied size, position, speed, delay.
const PARTICLES = [
  { left: "4%",  size: 10, duration: 14, delay: 0 },
  { left: "11%", size: 7,  duration: 18, delay: 2 },
  { left: "19%", size: 9,  duration: 16, delay: 5 },
  { left: "27%", size: 6,  duration: 20, delay: 1 },
  { left: "35%", size: 8,  duration: 15, delay: 4 },
  { left: "47%", size: 5,  duration: 19, delay: 3 },
  { left: "58%", size: 9,  duration: 17, delay: 6 },
  { left: "67%", size: 7,  duration: 14, delay: 2.5 },
  { left: "75%", size: 10, duration: 21, delay: 0.5 },
  { left: "83%", size: 6,  duration: 16, delay: 4.5 },
  { left: "90%", size: 8,  duration: 18, delay: 1.5 },
  { left: "96%", size: 7,  duration: 15, delay: 3.5 },
];

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full bg-black flex flex-col items-center justify-center overflow-hidden py-8">
      {/* Falling red petals / embers — full viewport, behind content text but above bg */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="nf-petal"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Image block — never cropped, never upscaled past its native size */}
      <div className="relative z-10 w-full nf-kenburns" style={{ maxWidth: "1300px" }}>
        <img
          loading="lazy"
          src={dragonBg}
          alt="Page not found"
          className="w-full h-auto block"
        />
        {/* Fades the hard image rectangle into the black page background */}
        <div className="nf-edge-fade" />
      </div>

      {/* Return button — sits below the artwork, never overlapping it */}
      <Link
        to="/"
        className="relative z-10 mt-6 sm:mt-8 inline-flex items-center gap-2 px-8 py-3 bg-black/60 border border-red/70 text-white font-display font-semibold tracking-wide uppercase rounded-sm hover:bg-red hover:border-red transition-all duration-300 shadow-red-glow"
      >
        Return to Arena
        <span aria-hidden="true">›</span>
      </Link>

      <style>{`
        .nf-kenburns img {
          animation: nfZoom 22s ease-in-out infinite alternate;
          transform-origin: 50% 35%;
        }
        @keyframes nfZoom {
          0%   { transform: scale(1); }
          100% { transform: scale(1.05); }
        }

        .nf-edge-fade {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(to right,  #000 0%, transparent 6%, transparent 94%, #000 100%),
            linear-gradient(to bottom, #000 0%, transparent 6%, transparent 94%, #000 100%);
        }

        .nf-petal {
          position: absolute;
          top: -5%;
          background: linear-gradient(135deg, #ff4655, #cc2233);
          border-radius: 60% 0 60% 0;
          opacity: 0.85;
          animation-name: nfFall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes nfFall {
          0%   { transform: translateY(0) rotate(0deg);    opacity: 0; }
          8%   { opacity: 0.85; }
          92%  { opacity: 0.85; }
          100% { transform: translateY(110vh) rotate(280deg); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nf-kenburns img, .nf-petal {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}