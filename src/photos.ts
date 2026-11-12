import { useEffect, useState } from 'react'
import { deletePhoto as deleteStoredPhoto, fetchPhoto, putPhoto as storePhoto } from './api'

export type PhotoSlot = 'before' | 'after'

let epoch = 0
const listeners = new Set<() => void>()

export function notifyPhotosChanged() {
  epoch += 1
  for (const listener of listeners) listener()
}

function usePhotoEpoch() {
  const [value, setValue] = useState(epoch)
  useEffect(() => {
    const listener = () => setValue(epoch)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return value
}

export async function putPhoto(mealId: string, slot: PhotoSlot, blob: Blob) {
  await storePhoto(mealId, slot, blob)
  notifyPhotosChanged()
}

export async function getPhoto(mealId: string, slot: PhotoSlot): Promise<Blob | null> {
  return fetchPhoto(mealId, slot)
}

export async function deletePhoto(mealId: string, slot: PhotoSlot) {
  await deleteStoredPhoto(mealId, slot)
  notifyPhotosChanged()
}

export async function compressImage(file: Blob, maxSize = 1200, quality = 0.72): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality)
  })
  return blob ?? file
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function useMealPhoto(mealId: string, slot: PhotoSlot, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null)
  const revision = usePhotoEpoch()

  useEffect(() => {
    if (!enabled) {
      setUrl(null)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    void getPhoto(mealId, slot).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mealId, slot, enabled, revision])

  return url
}
