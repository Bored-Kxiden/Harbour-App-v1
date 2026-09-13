/** Where the app talks to, and the key it uses.
 *
 *  Both values are public on purpose. The publishable key is designed to be
 *  shipped inside a client, and it is safe because every table has row level
 *  security on: the key gets you as far as the sign-in screen and no further,
 *  and once signed in the database decides what you may read, not the app.
 *
 *  They are committed rather than kept in an env file so a fresh clone builds
 *  and runs with no setup step. The SERVICE ROLE key is the opposite of this
 *  one -- it bypasses row level security entirely -- and must never appear in
 *  this repository, in the app, or in any build.
 *
 *  An env file still wins if one is present, which is how you point a build at
 *  a different project without editing code.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://nfhijkdownrtftdyyuxm.supabase.co'

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_bznqTyUvrJxWjTnV9nK6nw_fJyVwkZ8'
