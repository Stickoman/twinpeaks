"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  REALTIME_LISTEN_TYPES,
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
} from "@supabase/realtime-js";
import type {
  RealtimePostgresChangesFilter,
  RealtimePostgresChangesPayload,
} from "@supabase/realtime-js";

let _supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

function getSupabaseClient() {
  if (!_supabaseClient) {
    _supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    );
  }
  return _supabaseClient;
}

type PostgresChangeEvent = "INSERT" | "UPDATE" | "DELETE";

const EVENT_MAP: Record<PostgresChangeEvent, `${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT}`> = {
  INSERT: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT,
  UPDATE: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE,
  DELETE: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE,
};

function useRealtimeChannel<T>(
  table: string,
  event: PostgresChangeEvent,
  callback: (payload: T) => void,
  filter?: string,
) {
  useEffect(() => {
    const supabase = getSupabaseClient();

    const channelName = `${table}-${event.toLowerCase()}`;

    const pgConfig: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT}`> = {
      event: EVENT_MAP[event],
      schema: "public",
      table,
      ...(filter ? { filter } : {}),
    };

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
        pgConfig,
        (payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>) => {
          if (payload.new && Object.keys(payload.new).length > 0) {
            callback(payload.new as T);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, callback, filter]);
}

export function useRealtimeInserts<T>(
  table: string,
  callback: (payload: T) => void,
  filter?: string,
) {
  useRealtimeChannel(table, "INSERT", callback, filter);
}

export function useRealtimeUpdates<T>(
  table: string,
  callback: (payload: T) => void,
  filter?: string,
) {
  useRealtimeChannel(table, "UPDATE", callback, filter);
}
