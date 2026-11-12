import type { BristolType, MoodKind } from '../types'

export function LeafMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path
        d="M6 18c8-1 12-7 13-14-7 2-14 7-13 14Z"
        fill="#f6efe4"
      />
      <path
        d="M8 17c5-2 8-7 9-12"
        stroke="#3e5a4c"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d={dir === 'left' ? 'M11 4 6 9l5 5' : 'M7 4l5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StoolArt({ type }: { type: BristolType }) {
  if (type === 1) {
    return (
      <span className="stool-art" aria-hidden="true">
        <i className="pellet" />
        <i className="pellet" />
        <i className="pellet" />
      </span>
    )
  }
  if (type === 2) return <span className="stool-art" aria-hidden="true"><i className="sausage lumpy" /></span>
  if (type === 3) return <span className="stool-art" aria-hidden="true"><i className="sausage cracked" /></span>
  if (type === 4) return <span className="stool-art" aria-hidden="true"><i className="sausage" /></span>
  if (type === 5) {
    return (
      <span className="stool-art" aria-hidden="true">
        <i className="blob" />
        <i className="blob" />
      </span>
    )
  }
  if (type === 6) return <span className="stool-art" aria-hidden="true"><i className="blob" /><i className="wave" /></span>
  return <span className="stool-art" aria-hidden="true"><i className="wave" /><i className="wave" /></span>
}

export function WaterDrop() {
  return (
    <svg className="water-drop" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.5C12 3.5 6.5 10.2 6.5 14.2a5.5 5.5 0 0 0 11 0C17.5 10.2 12 3.5 12 3.5Z"
        fill="#d7e6ee"
        stroke="#4d7388"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M10 14.5c.4 1.6 2.2 2.2 3.4 1.4"
        fill="none"
        stroke="#6e91a6"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MoodFace({ mood }: { mood: MoodKind }) {
  const faces: Record<MoodKind, string> = {
    happy: 'M8 15c1.4 2 4.6 2 6 0 M7 9.5h.01M17 9.5h.01',
    calm: 'M8 14.5c2.2 1.4 5.8 1.4 8 0 M7 9.5h.01M17 9.5h.01',
    energetic: 'M8 14.5c2 3 6 3 8 0 M7 9h.01M17 9h.01',
    fussy: 'M8 16c2.5-1.5 5.5-1.5 8 0 M7 9.5h.01M17 9.5h.01',
    irritable: 'M8 16.5h8 M6.5 8.5l2 1M17.5 8.5l-2 1',
    tired: 'M8 14.5h8 M6.5 9.5h3M14.5 9.5h3',
    tummy: 'M8 16c1.2-2 6.8-2 8 0 M7 9.5h.01M17 9.5h.01',
  }
  return (
    <svg className="mood-face" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#f4e4c8" stroke="#2b231c" strokeWidth="1.2" />
      <path d={faces[mood]} fill="none" stroke="#2b231c" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
