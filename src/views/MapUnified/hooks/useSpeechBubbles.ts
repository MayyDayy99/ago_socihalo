import { useState, useEffect, useRef } from "react"
import type { Person, Connection } from "../../../store/types"

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Bubble {
  id: string
  personId: string
  toPersonId: string | null   // null = thought bubble
  emoji: string
  createdAt: number
  duration: number
  offsetX: number             // slight horizontal scatter so bubbles don't stack
}

/** personId → ID of who they're currently talking to (or null = thinking) */
export type TalkingMap = Map<string, string | null>

// ── Emoji pools ───────────────────────────────────────────────────────────────
const SOCIAL  = ["😊","😄","🤗","😁","😂","🥰","😍","🤩","😆","🙂","🫠","😃"]
const HYPE    = ["👍","🙌","💪","✌️","🤝","👋","🫶","👏","🤜","💯","🫡","🎯"]
const CHAT    = ["💬","🗣️","🤔","💭","😮","🤯","🫢","🧐","👀","💡","🤌","😶"]
const LOVE    = ["❤️","💛","💙","💚","🧡","💜","🤍","💕","💖","💗","🫀","💝"]
const PARTY   = ["🎉","🎊","🥳","🎈","🚀","⭐","🌟","✨","🔥","💥","🎆","🎇"]
const CHILL   = ["☕","🎵","🌙","🌿","🍃","😌","🧘","🌈","🦋","🎶","🎸","📚"]
const THINK   = ["🤔","💭","😶","🧐","🌀","💫","❓","🔍","📝","💡","🧩","😑"]

const CONV_POOLS = [SOCIAL, HYPE, CHAT, LOVE, PARTY, CHILL]

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

let _seq = 0
const nextId = () => `bbl${_seq++}`

const BUBBLE_MS    = 2400
const MIN_INTERVAL = 1500
const MAX_INTERVAL = 4600

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useSpeechBubbles(people: Person[], connections: Connection[]) {
  const [bubbles, setBubbles]       = useState<Bubble[]>([])
  const [talkingMap, setTalkingMap] = useState<TalkingMap>(new Map())

  // Stable refs so setTimeout callbacks always see the latest values
  const peopleRef     = useRef(people)
  const connsRef      = useRef(connections)
  const busyRef       = useRef<Set<string>>(new Set())
  const talkingIntRef = useRef<Map<string, string | null>>(new Map())

  peopleRef.current = people
  connsRef.current  = connections

  // ── State helpers ──────────────────────────────────────────────────────────
  function commitTalking(id: string, toId: string | null) {
    talkingIntRef.current.set(id, toId)
    setTalkingMap(new Map(talkingIntRef.current))
  }
  function commitClearTalking(id: string) {
    talkingIntRef.current.delete(id)
    setTalkingMap(new Map(talkingIntRef.current))
  }

  // ── Spawn a single bubble ──────────────────────────────────────────────────
  function spawnBubble(personId: string, toPersonId: string | null, emoji: string) {
    if (busyRef.current.has(personId)) return
    const id = nextId()
    const bubble: Bubble = {
      id, personId, toPersonId, emoji,
      createdAt: Date.now(),
      duration: BUBBLE_MS,
      offsetX: (Math.random() - 0.5) * 0.55,
    }
    busyRef.current.add(personId)
    setBubbles(prev => [...prev, bubble])
    commitTalking(personId, toPersonId)

    setTimeout(() => {
      setBubbles(prev => prev.filter(b => b.id !== id))
      busyRef.current.delete(personId)
      commitClearTalking(personId)
    }, BUBBLE_MS + 200)
  }

  // ── Start a back-and-forth conversation (1–3 rounds) ──────────────────────
  function startConversation(fromId: string, toId: string) {
    const rounds = Math.random() < 0.28 ? 3 : Math.random() < 0.52 ? 2 : 1
    const pool   = rand(CONV_POOLS)
    let delay    = 0
    for (let i = 0; i < rounds; i++) {
      const speaker  = i % 2 === 0 ? fromId : toId
      const listener = i % 2 === 0 ? toId   : fromId
      const capturedDelay = delay
      setTimeout(() => spawnBubble(speaker, listener, rand(pool)), capturedDelay)
      delay += 950 + Math.random() * 750
    }
  }

  // ── Fire event (called on schedule) ───────────────────────────────────────
  // Stored in a ref so the scheduler always calls the freshest version.
  const fireRef = useRef(() => {})
  fireRef.current = () => {
    const pp = peopleRef.current
    const cc = connsRef.current
    if (pp.length === 0) return

    // Primary event: conversation 78% of time if connections exist, else thought
    const doConv = cc.length > 0 && Math.random() > 0.22
    if (doConv) {
      const conn   = cc[Math.floor(Math.random() * cc.length)]
      const fromId = Math.random() > 0.5 ? conn.from_id : conn.to_id
      const toId   = fromId === conn.from_id ? conn.to_id : conn.from_id
      if (!busyRef.current.has(fromId)) startConversation(fromId, toId)
    } else {
      const p = pp[Math.floor(Math.random() * pp.length)]
      spawnBubble(p.id, null, rand(THINK))
    }

    // Secondary concurrent event (38% chance) – adds liveliness
    if (Math.random() < 0.38 && cc.length > 1) {
      const delay = 280 + Math.random() * 520
      setTimeout(() => {
        const conn = cc[Math.floor(Math.random() * cc.length)]
        if (!busyRef.current.has(conn.from_id) && !busyRef.current.has(conn.to_id)) {
          spawnBubble(conn.from_id, conn.to_id, rand(rand(CONV_POOLS)))
        }
      }, delay)
    }

    // Occasional group "reaction wave" – up to 3 people react simultaneously (12% chance)
    if (Math.random() < 0.12 && pp.length >= 3) {
      const count = 2 + Math.floor(Math.random() * 2)
      const pool  = rand(CONV_POOLS)
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const p = pp[Math.floor(Math.random() * pp.length)]
          if (!busyRef.current.has(p.id)) spawnBubble(p.id, null, rand(pool))
        }, i * (200 + Math.random() * 300))
      }
    }
  }

  // ── Schedule loop (runs once, uses refs for fresh data) ───────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const delay = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL)
      timer = setTimeout(() => { fireRef.current(); schedule() }, delay)
    }
    // Short initial delay so the scene has time to populate
    const init = setTimeout(() => { fireRef.current(); schedule() }, 2200)
    return () => { clearTimeout(timer); clearTimeout(init) }
  }, []) // intentionally once – uses refs for current people/connections

  return { bubbles, talkingMap }
}
