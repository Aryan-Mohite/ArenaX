import { useEffect, useRef, useState } from 'react'

export default function CustomCursor() {
  const ringRef = useRef(null)
  const dotRef = useRef(null)
  const mousePos = useRef({ x: -100, y: -100 })
  const dotPos = useRef({ x: -100, y: -100 })
  const rafRef = useRef(null)
  const [isPointer, setIsPointer] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(true)

  // Detect touch / coarse-pointer devices (phones, tablets) up front so we
  // never attach mouse listeners or render the custom cursor on them — on
  // touch devices there's no real mouse, so the cursor just gets "stuck"
  // wherever the last touch happened instead of following anything.
  useEffect(() => {
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const noHover = window.matchMedia('(hover: none)').matches
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    setIsTouchDevice(coarsePointer || noHover || hasTouch)
  }, [])

  useEffect(() => {
    if (isTouchDevice) return

    const onMouseMove = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY }

      const target = e.target
      const cursor = window.getComputedStyle(target).cursor
      setIsPointer(cursor === 'pointer')
    }

    const onMouseLeave = () => setIsHidden(true)
    const onMouseEnter = () => setIsHidden(false)

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)
    document.addEventListener('mouseenter', onMouseEnter)

    const animate = () => {
      // Ring follows mouse directly
      if (ringRef.current) {
        ringRef.current.style.left = mousePos.current.x + 'px'
        ringRef.current.style.top = mousePos.current.y + 'px'
      }

      // Dot lags slightly behind for smooth feel
      dotPos.current.x += (mousePos.current.x - dotPos.current.x) * 0.15
      dotPos.current.y += (mousePos.current.y - dotPos.current.y) * 0.15
      if (dotRef.current) {
        dotRef.current.style.left = dotPos.current.x + 'px'
        dotRef.current.style.top = dotPos.current.y + 'px'
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('mouseenter', onMouseEnter)
      cancelAnimationFrame(rafRef.current)
    }
  }, [isTouchDevice])

  if (isTouchDevice) return null

  return (
    <>
      {/* Spinning ring */}
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          width: isPointer ? '44px' : '36px',
          height: isPointer ? '44px' : '36px',
          borderRadius: '50%',
          border: '2.5px solid transparent',
          borderTopColor: '#ff4655',
          borderRightColor: '#ff6b77',
          borderBottomColor: '#cc2233',
          borderLeftColor: '#ff4655',
          boxShadow: '0 0 8px rgba(255, 70, 85, 0.5)',
          pointerEvents: 'none',
          zIndex: 99999,
          transform: 'translate(-50%, -50%)',
          animation: 'cursorSpin 1s linear infinite',
          opacity: isHidden ? 0 : 1,
          transition: 'width 0.2s ease, height 0.2s ease, opacity 0.2s ease',
        }}
      />

      {/* Center dot */}
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          width: isPointer ? '8px' : '5px',
          height: isPointer ? '8px' : '5px',
          borderRadius: '50%',
          background: '#ff4655',
          boxShadow: '0 0 6px rgba(255, 70, 85, 0.8)',
          pointerEvents: 'none',
          zIndex: 100000,
          transform: 'translate(-50%, -50%)',
          opacity: isHidden ? 0 : 1,
          transition: 'width 0.2s ease, height 0.2s ease, opacity 0.2s ease',
        }}
      />
    </>
  )
}
