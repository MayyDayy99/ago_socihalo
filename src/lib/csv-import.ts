export interface CsvRow { [col: string]: string }

export interface CsvMapping {
  name: string
  email: string
  phone: string
}

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  // Strip a leading UTF-8 BOM (Excel exports include one) so the first header is clean.
  text = text.replace(/^﻿/, "")
  // Normalise line endings; the tokenizer only deals with "\n".
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  if (!text.trim()) return { headers: [], rows: [] }

  // Detect the delimiter once from the header line: default to comma, switch to
  // semicolon only when the header clearly uses more of them (European/Excel CSVs).
  const nl = text.indexOf("\n")
  const firstLine = nl === -1 ? text : text.slice(0, nl)
  const delimiter = countUnquoted(firstLine, ";") > countUnquoted(firstLine, ",") ? ";" : ","

  // Tokenize the whole text in one pass, tracking quote state across line breaks so a
  // quoted field containing a newline (RFC 4180) stays a single field.
  const records = tokenize(text, delimiter).filter(r => r.some(v => v.trim() !== ""))
  if (records.length < 2) return { headers: [], rows: [] }

  const headers = records[0].map(h => h.trim())
  const rows: CsvRow[] = []
  for (let i = 1; i < records.length; i++) {
    const values = records[i]
    const row: CsvRow = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim() })
    rows.push(row)
  }
  return { headers, rows }
}

function tokenize(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }  // escaped quote
        else inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      record.push(field); field = ""
    } else if (ch === "\n") {
      record.push(field); field = ""
      records.push(record); record = []
    } else {
      field += ch
    }
  }
  record.push(field)
  records.push(record)
  return records
}

function countUnquoted(line: string, target: string): number {
  let n = 0, inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') inQuotes = !inQuotes
    else if (c === target && !inQuotes) n++
  }
  return n
}

export function autoDetectMapping(headers: string[]): Partial<CsvMapping> {
  const lower = headers.map(h => h.toLowerCase())
  const find = (...candidates: string[]) =>
    headers[lower.findIndex(h => candidates.some(c => h.includes(c)))] ?? ""

  return {
    name:  find("name", "név", "full", "teljes", "contact"),
    email: find("email", "e-mail", "mail"),
    phone: find("phone", "tel", "telefon", "mobile", "mobil", "number"),
  }
}

export function applyMapping(
  rows: CsvRow[],
  mapping: CsvMapping
): Array<{ display_name: string; emails: string[]; phone_numbers: string[]; sources: Array<{ type: "manual"; imported_at: string }> }> {
  const now = new Date().toISOString()
  return rows
    .map(row => ({
      display_name:  row[mapping.name]?.trim() ?? "",
      emails:        row[mapping.email]?.trim() ? [row[mapping.email].trim()] : [],
      phone_numbers: row[mapping.phone]?.trim() ? [row[mapping.phone].trim()] : [],
      sources: [{ type: "manual" as const, imported_at: now }],
    }))
    .filter(c => c.display_name.length > 0)
}
