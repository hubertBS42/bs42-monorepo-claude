"use client"

import { Download } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

export type CsvCell = string | number

// Quoted when it holds a comma, quote or line break. A cell starting with = + - @ is prefixed with ' so a spreadsheet
// doesn't run it as a formula (product names are typed by staff); amounts are plain numbers, so negatives stay numbers.
function csvCell(cell: CsvCell) {
  if (typeof cell === "number") return String(cell)
  const text = /^[=+\-@\t\r]/.test(cell) && !/^-?\d+(\.\d+)?$/.test(cell) ? `'${cell}` : cell
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

interface DownloadCsvButtonProps {
  filename: string
  headers: string[]
  rows: CsvCell[][]
}

// Builds the file from the rows the page already shows, so it matches what's on screen
export default function DownloadCsvButton({ filename, headers, rows }: DownloadCsvButtonProps) {
  const download = () => {
    // The byte order mark tells Excel it's UTF-8, so names with accents or symbols survive
    const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
      <Download />
      CSV
    </Button>
  )
}
