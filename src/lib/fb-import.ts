import JSZip from "jszip"

export async function parseFacebookExport(file: File) {
  const zip   = await JSZip.loadAsync(file)
  const path  = "friends_and_followers/your_friends.json"
  const entry = zip.file(path)
  if (!entry) throw new Error(`${path} nem található az archívumban`)
  const raw   = await entry.async("string")
  const json  = JSON.parse(raw)

  return (json.friends_v2 ?? []).map((f: { name: string; timestamp: number }) => ({
    display_name: f.name,
    sources: [{ type: "facebook" as const, imported_at: new Date().toISOString() }],
  }))
}
