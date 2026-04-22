export interface CsvRow { [col: string]: string }

export interface CsvMapping {
  name: string
  email: string
  phone: string
}

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0])
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.every(v => !v)) continue
    const row: CsvRow = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? "" })
    rows.push(row)
  }

  return { headers, rows }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if ((ch === "," || ch === ";") && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
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
