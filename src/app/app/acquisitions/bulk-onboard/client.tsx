'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { parseOnboardingFilename, type ParsedLead } from '@/lib/onboarding/parse-filename'
import { normalizePhone } from '@/lib/onboarding/normalize-phone'
import { getLeadIdsByPhones } from '@/actions/lead-lookup'

type RowStatus =
  | { kind: 'parsed'; parsed: ParsedLead; selected: boolean; duplicateOfLeadId: string | null }
  | { kind: 'unparseable' }

type Row = {
  id: string
  file: File
  status: RowStatus
}

function rowId(file: File, index: number): string {
  return `${index}-${file.name}-${file.size}`
}

export function BulkOnboardClient() {
  const [rows, setRows] = useState<Row[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isCheckingDupes, startDupeCheck] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(files: File[]) {
    if (files.length === 0) return

    const newRows: Row[] = files.map((file, i) => {
      const parsed = parseOnboardingFilename(file.name)
      if (!parsed) {
        return { id: rowId(file, rows.length + i), file, status: { kind: 'unparseable' } }
      }
      return {
        id: rowId(file, rows.length + i),
        file,
        status: {
          kind: 'parsed',
          parsed,
          selected: true,
          duplicateOfLeadId: null,
        },
      }
    })

    setRows((prev) => [...prev, ...newRows])
    runDupeCheck(newRows)
  }

  function runDupeCheck(newRows: Row[]) {
    const phonesToCheck = newRows
      .filter((r): r is Row & { status: { kind: 'parsed' } & ParsedLead } => r.status.kind === 'parsed')
      .map((r) => (r.status as { parsed: ParsedLead }).parsed.phone)

    if (phonesToCheck.length === 0) return

    startDupeCheck(async () => {
      const result = await getLeadIdsByPhones(phonesToCheck)
      if (!result.success) return
      const map = result.data
      setRows((prev) =>
        prev.map((r) => {
          if (r.status.kind !== 'parsed') return r
          const n = normalizePhone(r.status.parsed.phone)
          const dupId = map[n] ?? null
          if (!dupId) return r
          return {
            ...r,
            status: {
              ...r.status,
              selected: false, // duplicates default to unchecked
              duplicateOfLeadId: dupId,
            },
          }
        }),
      )
    })
  }

  function toggleSelected(rowId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId || r.status.kind !== 'parsed') return r
        return { ...r, status: { ...r.status, selected: !r.status.selected } }
      }),
    )
  }

  function clearAll() {
    setRows([])
  }

  const counts = {
    ready: rows.filter((r) => r.status.kind === 'parsed' && !r.status.duplicateOfLeadId).length,
    duplicate: rows.filter((r) => r.status.kind === 'parsed' && r.status.duplicateOfLeadId !== null).length,
    unparseable: rows.filter((r) => r.status.kind === 'unparseable').length,
  }
  const selectedCount = rows.filter((r) => r.status.kind === 'parsed' && r.status.selected).length

  return (
    <div className="space-y-6">
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
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100'
        }`}
      >
        <p className="text-sm text-neutral-600">
          {isDragging ? 'Drop files here' : 'Drag & drop multiple audio files or click to browse'}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          Expected: M.D Name Age - Address - Phone - Campaign.ext
        </p>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <div>
              ✅ {counts.ready} ready · ⚠️ {counts.duplicate} duplicate · ❌ {counts.unparseable} unparseable
              {isCheckingDupes && <span className="ml-2 text-neutral-400">(checking duplicates...)</span>}
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="text-neutral-500 underline hover:text-neutral-800"
            >
              Clear
            </button>
          </div>

          <ul className="divide-y divide-dashed divide-neutral-200 rounded border border-dashed border-neutral-300">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                {row.status.kind === 'unparseable' ? (
                  <>
                    <span className="text-lg leading-none">❌</span>
                    <div className="flex-1">
                      <p className="font-medium text-neutral-700">{row.file.name}</p>
                      <p className="text-xs text-neutral-500">
                        Couldn&apos;t parse — expected M.D Name Age - Address - Phone - Campaign.ext
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={row.status.selected}
                      onChange={() => toggleSelected(row.id)}
                    />
                    <span className="text-lg leading-none">
                      {row.status.duplicateOfLeadId ? '⚠️' : '✅'}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-neutral-900">{row.status.parsed.name}</p>
                      <p className="text-xs text-neutral-600">
                        {row.status.parsed.address} · {row.status.parsed.phone} · {row.status.parsed.campaign} · {row.status.parsed.date}
                      </p>
                      {row.status.duplicateOfLeadId && (
                        <p className="text-xs text-amber-600">
                          Duplicate phone —{' '}
                          <Link
                            href={`/app/acquisitions/lead-record/${row.status.duplicateOfLeadId}`}
                            target="_blank"
                            className="underline hover:text-amber-800"
                          >
                            existing lead
                          </Link>
                          . Tick the box to onboard anyway.
                        </p>
                      )}
                      <p className="text-[0.65rem] text-neutral-400 truncate">{row.file.name}</p>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={selectedCount === 0}
              className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-4 py-2 text-sm font-medium hover:bg-[#dce3cb] disabled:opacity-50"
            >
              Create {selectedCount} lead{selectedCount === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
