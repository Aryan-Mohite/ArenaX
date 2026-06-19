import { useEffect, useState } from 'react'

export default function Loader() {
  const [count, setCount] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const duration = 1200
    const endCount = 100
    let current = 0

    const counter = setInterval(() => {
      current++
      setCount(current)

      if (current >= endCount) {
        clearInterval(counter)
        setTimeout(() => setHidden(true), 200)
      }
    }, duration / endCount)

    return () => clearInterval(counter)
  }, [])

  if (hidden) return null

  return (
    <div
      className={`app-loader fixed inset-0 z-[9999] flex items-center justify-center bg-[#050505] transition-all duration-500 ${
        count === 100 ? 'opacity-0 invisible' : 'opacity-100 visible'
      }`}
    >
      <div className="relative w-[100px] h-[100px] flex items-center justify-center">

        {/* Top-left bracket */}
        <div
          className="absolute w-full h-full"
          style={{
            clipPath: 'polygon(0 0, 35% 0, 0 35%)',
            borderTop: '3px solid #ff0000',
            borderLeft: '3px solid #ff0000',
            animation: 'bracketPulse 1.5s infinite alternate',
          }}
        />

        {/* Bottom-right bracket */}
        <div
          className="absolute w-full h-full"
          style={{
            clipPath: 'polygon(100% 100%, 65% 100%, 100% 65%)',
            borderBottom: '3px solid #ff0000',
            borderRight: '3px solid #ff0000',
            animation: 'bracketPulse 1.5s infinite alternate-reverse',
          }}
        />

        {/* Spinning diamond shard */}
        <div style={{ animation: 'shardSpin 3s cubic-bezier(0.68,-0.55,0.27,1.55) infinite' }}>
          <div
            className="w-10 h-10"
            style={{
              backgroundColor: '#ff0000',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              boxShadow: '0 0 20px #ff0000',
              filter: 'drop-shadow(0 0 10px #ff0000)',
            }}
          />
        </div>

        {/* Scan line */}
        <div
          className="absolute w-[150%] h-[2px] opacity-50"
          style={{
            background: 'linear-gradient(90deg, transparent, #ff0000, transparent)',
            animation: 'scanLine 2s linear infinite',
          }}
        />

        {/* Status text */}
        <div
          className="absolute top-[130px] text-white text-[12px] tracking-[3px] uppercase border-l-[3px] border-red-600 pl-2"
          style={{ fontFamily: "'Oxanium', 'Orbitron', sans-serif" }}
        >
          CRITICAL_LOAD: <span>{count}</span>%
        </div>
      </div>
    </div>
  )
}