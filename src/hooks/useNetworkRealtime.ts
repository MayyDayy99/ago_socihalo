import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"

export function useNetworkRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel("network-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["people"] })
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connections" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["connections"] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])
}
