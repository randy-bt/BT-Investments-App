'use client'

import { useState } from 'react'
import { PhotoComingSoon } from './PhotoComingSoon'

/**
 * A listing-page photo that degrades to the branded placeholder.
 *
 * The template's photo paths are stored strings, and `getPublicUrl` happily
 * builds a URL for an object that was never uploaded or has since been
 * deleted - the server cannot tell the difference without a storage round
 * trip per image. So the check happens where the answer actually arrives: the
 * browser's load error. Until then the frame shows the placeholder underneath,
 * which also covers the gap while a large photo is still downloading.
 */
export function PhotoFrame({
  src,
  alt,
  style,
  loading,
}: {
  src: string
  alt: string
  style: React.CSSProperties
  loading?: 'lazy' | 'eager'
}) {
  const [failed, setFailed] = useState(false)
  return (
    <>
      {failed ? <PhotoComingSoon /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={failed ? { ...style, visibility: 'hidden' } : style}
        loading={loading}
        onError={() => setFailed(true)}
      />
    </>
  )
}
