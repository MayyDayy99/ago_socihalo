import type { Person } from "../store/types"

function escape(s: string): string {
  // Strip raw CR/LF first (prevents line injection), then escape vCard special chars.
  return s
    .replace(/[\r\n]+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

export function personToVCard(person: Person): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escape(person.display_name)}`,
    ...person.emails.map(e => `EMAIL;TYPE=INTERNET:${escape(e)}`),
    ...person.phone_numbers.map(p => `TEL;TYPE=CELL:${escape(p)}`),
    person.notes ? `NOTE:${escape(person.notes)}` : null,
    person.met_at ? `ORG:${escape(person.met_at)}` : null,
    `CATEGORIES:${escape(person.group_key ?? "other")}`,
    `X-NEXUS-ROLE:${person.role_key}`,
    `X-NEXUS-STRENGTH:${person.strength}`,
    "END:VCARD",
  ].filter(Boolean) as string[]

  return lines.join("\r\n")
}

export function exportAllVcf(people: Person[]): void {
  const content = people.map(personToVCard).join("\r\n\r\n")
  const blob = new Blob([content], { type: "text/vcard;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = `nexus-${new Date().toISOString().slice(0, 10)}.vcf`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAllJson(people: Person[], connections: unknown[]): void {
  const data = { people, connections, exportedAt: new Date().toISOString(), version: 1 }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = `nexus-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
