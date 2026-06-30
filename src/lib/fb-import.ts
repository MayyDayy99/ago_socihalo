import JSZip from "jszip"

export async function parseFacebookExport(file: File) {
  const zip   = await JSZip.loadAsync(file)
  const path  = "friends_and_followers/your_friends.json"
  const entry = zip.file(path)
  if (!entry) throw new Error(`${path} nem található az archívumban`)
  const raw   = await entry.async("string")
  const json  = JSON.parse(raw)

  const now = new Date().toISOString()
  // Real Facebook exports contain nameless entries (deactivated/restricted friends);
  // coerce + filter so we never emit a contact with an undefined/empty name (which would
  // crash the review step on display_name.toLowerCase()).
  const friends: Array<{ name?: string | null }> = Array.isArray(json?.friends_v2) ? json.friends_v2 : []
  return friends
    .map((f) => ({
      display_name: (f?.name ?? "").trim(),
      sources: [{ type: "facebook" as const, imported_at: now }],
    }))
    .filter((c) => c.display_name.length > 0)
}
