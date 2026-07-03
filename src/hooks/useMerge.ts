import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import { firebaseAuth } from "../lib/firebase"
import type { MergeSession, MergeCandidate, MergeView, ShareLevel } from "../lib/merge-types"

/** The current Firebase identity (uid + email), used to classify sessions client-side. */
export function useMyIdentity() {
  const u = firebaseAuth.currentUser
  return { uid: u?.uid ?? null, email: (u?.email ?? "").toLowerCase() }
}

// ── Sessions (RLS returns only ones I'm party to, incl. invites to my email) ──
export function useMergeSessions() {
  return useQuery({
    queryKey: ["merge_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merge_sessions")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as MergeSession[]
    },
    staleTime: 10_000,
  })
}

export function useCreateMergeInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, level }: { email: string; level: ShareLevel }) => {
      const { data, error } = await supabase.rpc("create_merge_invite", {
        p_partner_email: email.trim().toLowerCase(),
        p_share_level: level,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merge_sessions"] }),
  })
}

export function useRespondToMerge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, accept, level }: { sessionId: string; accept: boolean; level: ShareLevel }) => {
      const { error } = await supabase.rpc("respond_to_merge_invite", {
        p_session_id: sessionId,
        p_accept: accept,
        p_share_level: level,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merge_sessions"] }),
  })
}

export function useSetMergeShareLevel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, level }: { sessionId: string; level: ShareLevel }) => {
      const { error } = await supabase.rpc("set_merge_share_level", { p_session_id: sessionId, p_level: level })
      if (error) throw error
    },
    onSuccess: (_d, { sessionId }) => {
      qc.invalidateQueries({ queryKey: ["merge_sessions"] })
      qc.invalidateQueries({ queryKey: ["merge_view", sessionId] })
    },
  })
}

export function useRevokeMerge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc("revoke_merge", { p_session_id: sessionId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merge_sessions"] }),
  })
}

// ── Identity matching ──
export function useComputeMatches() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.rpc("compute_match_candidates", { p_session_id: sessionId })
      if (error) throw error
      return data as number
    },
    onSuccess: (_d, sessionId) => qc.invalidateQueries({ queryKey: ["merge_candidates", sessionId] }),
  })
}

export function useMergeCandidates(sessionId: string | null) {
  return useQuery({
    queryKey: ["merge_candidates", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merge_identity_map")
        .select("*")
        .eq("session_id", sessionId!)
      if (error) throw error
      return data as MergeCandidate[]
    },
  })
}

export function useConfirmMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ mapId, confirm }: { mapId: string; confirm: boolean; sessionId: string }) => {
      const { error } = await supabase.rpc("confirm_identity_match", { p_map_id: mapId, p_confirm: confirm })
      if (error) throw error
    },
    onSuccess: (_d, { sessionId }) => {
      qc.invalidateQueries({ queryKey: ["merge_candidates", sessionId] })
      qc.invalidateQueries({ queryKey: ["merge_view", sessionId] })
    },
  })
}

// ── The merge view ──
export function useMergeView(sessionId: string | null) {
  return useQuery({
    queryKey: ["merge_view", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_merge_view", { p_session_id: sessionId! })
      if (error) throw error
      return data as MergeView
    },
    staleTime: 15_000,
  })
}

// ── Realtime: session lifecycle + match confirmations ──
export function useMergeRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel("merge-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "merge_sessions" }, () => {
        qc.invalidateQueries({ queryKey: ["merge_sessions"] })
        qc.invalidateQueries({ queryKey: ["merge_view"] })
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "merge_identity_map" }, () => {
        qc.invalidateQueries({ queryKey: ["merge_candidates"] })
        qc.invalidateQueries({ queryKey: ["merge_view"] })
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [qc])
}
