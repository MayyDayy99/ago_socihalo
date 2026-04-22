export interface ParsedContact {
  display_name: string
  phone_numbers: string[]
  emails: string[]
  sources: Array<{ type: "phone"; imported_at: string }>
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
    const upper = line.toUpperCase()
    if (upper.startsWith("FN:"))    contact.display_name = decodeVCardValue(line.slice(3))
    if (upper.startsWith("FN;"))    contact.display_name = decodeVCardValue(line.split(":").slice(1).join(":"))
    if (upper.startsWith("TEL"))    contact.phone_numbers.push(line.split(":").slice(1).join(":").trim())
    if (upper.startsWith("EMAIL"))  contact.emails.push(line.split(":").slice(1).join(":").trim())
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
