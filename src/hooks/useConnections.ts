import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import type { Connection } from "../store/types"

export function useConnections() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connections")
        .select("*")
        .order("created_at")
      if (error) throw error
      return data as Connection[]
    },
  })
}

export function useCreateConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (conn: { from_id: string; to_id: string; type?: string; strength?: number; context?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from("connections")
        .insert({
          ...conn,
          user_id: user!.id,
          directed: false,
          confidence: "confirmed",
        })
        .select()
        .single()
      if (error) throw error
      return data as Connection
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  })
}

export function useDeleteConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("connections").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  })
}

export function useUpdateConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Connection> & { id: string }) => {
      const { data, error } = await supabase
        .from("connections")
        .update(updates)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as Connection
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  })
}
