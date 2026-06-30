import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import { firebaseAuth } from "../lib/firebase"
import type { Person } from "../store/types"

export function usePeople() {
  return useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .order("display_name")
      if (error) throw error
      return data as Person[]
    },
  })
}

export function useCreatePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (person: Omit<Partial<Person>, "id" | "user_id" | "created_at" | "updated_at">) => {
      const user = firebaseAuth.currentUser
      if (!user) throw new Error("Nincs bejelentkezve")
      const { data, error } = await supabase
        .from("people")
        .insert({
          display_name: "Névtelen",
          role_key: "none",
          strength: 3,
          phone_numbers: [],
          emails: [],
          tags: [],
          sources: [],
          archived: false,
          ...person,
          user_id: user.uid,
        })
        .select()
        .single()
      if (error) throw error
      return data as Person
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people"] }),
  })
}

export function useUpdatePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Person> & { id: string }) => {
      const { data, error } = await supabase
        .from("people")
        .update(updates)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as Person
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people"] }),
  })
}

// Position-only writes (auto-pin / drag-end) patch the cache in place instead of
// invalidating ["people"], so they don't trigger a refetch that tears down and
// restarts the d3 force simulation on every saved position.
export function useUpdatePersonPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, pinned_x, pinned_y }: { id: string; pinned_x: number; pinned_y: number }) => {
      const { error } = await supabase
        .from("people")
        .update({ pinned_x, pinned_y })
        .eq("id", id)
      if (error) throw error
      return { id, pinned_x, pinned_y }
    },
    onSuccess: ({ id, pinned_x, pinned_y }) => {
      qc.setQueryData<Person[]>(["people"], (prev) =>
        prev ? prev.map(p => (p.id === id ? { ...p, pinned_x, pinned_y } : p)) : prev
      )
    },
  })
}

export function useDeletePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("people").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] })
      qc.invalidateQueries({ queryKey: ["connections"] })
    },
  })
}
