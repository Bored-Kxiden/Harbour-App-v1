'use client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'

/** One client for the whole app.
 *
 *  It is created lazily and only in the browser: this app is exported as static
 *  files, so every module here is also evaluated once at build time in Node,
 *  where there is no localStorage to persist a session into.
 *
 *  The session is kept in localStorage, which inside the Android shell is the
 *  app's own private storage -- so somebody stays signed in across launches
 *  without Harbour storing a password anywhere.
 */
let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('Harbour talks to Supabase only from the app, never during the build.')
  }
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      /* There is no URL bar in the app, so there is never a token in one. */
      detectSessionInUrl: false,
    },
  })
  return client
}

/** True when the app has a signed-in user. Cheap enough to call on render. */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase().auth.getUser()
  return data.user?.id ?? null
}
