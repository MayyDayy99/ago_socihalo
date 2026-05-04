import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import { firebaseAuth } from "../lib/firebase"
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
      const user = firebaseAuth.currentUser
      if (!user) throw new Error("Nincs bejelentkezett felhasználó")
      if (conn.from_id === conn.to_id) throw new Error("Egy személy nem kapcsolható önmagához")

      const [from_id, to_id] = [conn.from_id, conn.to_id].sort()
      const { data, error } = await supabase
        .from("connections")
        .insert({
          ...conn,
          from_id,
          to_id,
          user_id: user.uid,
          directed: false,
          confidence: "confirmed",
        })
        .select()
        .single()
      if (error?.code === "23505") throw new Error("Ez a kapcsolat már létezik")
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
