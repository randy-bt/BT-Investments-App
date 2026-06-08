'use client'

import { useRef, useState } from 'react'

export function BulkOnboardClient() {
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(files: File[]) {
    if (files.length === 0) return
    setPendingFiles((prev) => [...prev, ...files])
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            addFiles(Array.from(e.target.files))
            e.target.value = ''
          }
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          addFiles(Array.from(e.dataTransfer.files))
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-12 cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100'
        }`}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-neutral-400 mb-2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-sm text-neutral-600">
          {isDragging ? 'Drop files here' : 'Drag & drop multiple audio files or click to browse'}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          Expected filename: M.D Name Age - Address - Phone - Campaign.ext
        </p>
      </div>

      {pendingFiles.length > 0 && (
        <p className="text-xs text-neutral-500">
          {pendingFiles.length} file{pendingFiles.length === 1 ? '' : 's'} queued — preview table coming next.
        </p>
      )}
    </div>
  )
}
