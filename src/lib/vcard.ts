export interface ParsedContact {
  display_name: string
  phone_numbers: string[]
  emails: string[]
  sources: Array<{ type: "phone"; imported_at: string }>
}

// Returns the property name (e.g. "TEL") for a vCard line, stripping any leading
// "group." prefix (Apple/iCloud emit "item1.TEL;type=CELL:+1..."). null if not a property line.
function propName(line: string): string | null {
  const head = line.split(/[;:]/, 1)[0]          // text before first ';' or ':'
  if (!head) return null
  const name = head.includes(".") ? head.slice(head.indexOf(".") + 1) : head
  return name.toUpperCase()
}

function valueOf(line: string): string {
  const idx = line.indexOf(":")
  return idx === -1 ? "" : line.slice(idx + 1).trim()
}

export function parseVCard(vcf: string): ParsedContact {
  const unfolded = vcf.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n")
  const lines = unfolded.split("\n")
  const contact: ParsedContact = {
    display_name: "",
    phone_numbers: [],
    emails: [],
    sources: [{ type: "phone", imported_at: new Date().toISOString() }],
  }
  for (const line of lines) {
    const prop = propName(line)
    if (!prop) continue
    if (prop === "FN") {
      contact.display_name = decodeVCardValue(valueOf(line))
    } else if (prop === "TEL") {
      const v = valueOf(line)
      if (v) contact.phone_numbers.push(v)
    } else if (prop === "EMAIL") {
      const v = valueOf(line)
      if (v) contact.emails.push(v)
    }
  }
  return contact
}

export function parseVCardFile(content: string): ParsedContact[] {
  const now = new Date().toISOString()
  // Split into individual vCard blocks
  const blocks = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/(?=BEGIN:VCARD)/i)
    .filter(b => /BEGIN:VCARD/i.test(b))

  return blocks
    .map(block => {
      const contact = parseVCard(block)
      contact.sources = [{ type: "phone", imported_at: now }]
      return contact
    })
    .filter(c => c.display_name.length > 0)
}

function decodeVCardValue(raw: string): string {
  return raw
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .trim()
}
