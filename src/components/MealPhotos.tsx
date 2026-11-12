import { useEffect, useRef, useState } from 'react'
import { useMealPhoto, type PhotoSlot } from '../photos'

export function MealPhotoStrip({
  mealId,
  before,
  after,
}: {
  mealId: string
  before: boolean
  after: boolean
}) {
  const beforeUrl = useMealPhoto(mealId, 'before', before)
  const afterUrl = useMealPhoto(mealId, 'after', after)
  const [open, setOpen] = useState<{ src: string; label: string } | null>(null)

  if (!before && !after) return null

  return (
    <>
      <div className="photo-strip">
        {before && (
          <button
            type="button"
            className="photo-thumb"
            disabled={!beforeUrl}
            onClick={(event) => {
              event.stopPropagation()
              if (beforeUrl) setOpen({ src: beforeUrl, label: 'Before' })
            }}
          >
            {beforeUrl ? <img src={beforeUrl} alt="Meal before" /> : <span className="photo-loading">Loading</span>}
            <span>Before</span>
          </button>
        )}
        {after && (
          <button
            type="button"
            className="photo-thumb"
            disabled={!afterUrl}
            onClick={(event) => {
              event.stopPropagation()
              if (afterUrl) setOpen({ src: afterUrl, label: 'After' })
            }}
          >
            {afterUrl ? <img src={afterUrl} alt="Meal after" /> : <span className="photo-loading">Loading</span>}
            <span>After</span>
          </button>
        )}
      </div>
      {open && (
        <div className="lightbox" onClick={() => setOpen(null)} role="presentation">
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={open.src} alt={open.label} />
            <figcaption>{open.label}</figcaption>
            <button type="button" className="ghost" onClick={() => setOpen(null)}>
              Close
            </button>
          </figure>
        </div>
      )}
    </>
  )
}

export function PhotoSlot({
  label,
  slot,
  mealId,
  hasExisting,
  onChange,
}: {
  label: string
  slot: PhotoSlot
  mealId?: string
  hasExisting: boolean
  onChange: (file: File | 'remove' | 'keep') => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const existing = useMealPhoto(mealId ?? '', slot, Boolean(mealId) && hasExisting)
  const [picked, setPicked] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    return () => {
      if (picked) URL.revokeObjectURL(picked)
    }
  }, [picked])

  const preview = removed ? null : picked ?? existing

  return (
    <div className="photo-slot">
      <span className="field-label">{label}</span>
      {preview ? (
        <div className="photo-preview">
          <img src={preview} alt={label} />
          <button
            type="button"
            className="photo-remove"
            onClick={() => {
              if (picked) URL.revokeObjectURL(picked)
              setPicked(null)
              setRemoved(true)
              onChange('remove')
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <button type="button" className="photo-upload" onClick={() => inputRef.current?.click()}>
          Upload {label.toLowerCase()} photo
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          if (picked) URL.revokeObjectURL(picked)
          setPicked(URL.createObjectURL(file))
          setRemoved(false)
          onChange(file)
          event.target.value = ''
        }}
      />
    </div>
  )
}
