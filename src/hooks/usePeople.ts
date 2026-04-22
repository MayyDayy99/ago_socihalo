import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
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
      const { data: { user } } = await supabase.auth.getUser()
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
          user_id: user!.id,
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
