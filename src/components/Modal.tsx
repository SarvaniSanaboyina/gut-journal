import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Open sheets, newest last, so only the top sheet reacts to Escape. */
const stack: string[] = []

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const id = useId()
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    stack.push(id)
    document.body.classList.add('sheet-open')
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stack[stack.length - 1] === id) closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      stack.splice(stack.indexOf(id), 1)
      if (stack.length === 0) document.body.classList.remove('sheet-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [id])

  return createPortal(
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className={`sheet ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={`${id}-title`}>{title}</h3>
        {children}
      </div>
    </div>,
    document.body,
  )
}
