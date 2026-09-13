# Harbour

An Android app for staying close to the people at home. The interface is the
one built and tested in [harvest-pulse](https://github.com/Bored-Kxiden/harvest-pulse),
running inside a native Android shell, with Supabase behind it.

## Opening it in Android Studio

You need [Android Studio](https://developer.android.com/studio) and
[Node.js](https://nodejs.org) (version 20 or newer).

**Run these two commands before you open Android Studio**, in a terminal in this
folder -- the one with `package.json` in it:

```bash
npm install
npm run sync
```

`npm install` fetches the dependencies, including the Android halves of the
Capacitor plugins, which Gradle expects to find in `node_modules`. `npm run
sync` builds the interface and copies it into the Android project. You only
need `npm install` the first time; `npm run sync` again every time you change
the interface and want to see it on a phone.

Then open **the `android` folder** in Android Studio -- not this folder --
and press Run.

> Open `android/`, not the repository root. Android Studio looks for a Gradle
> project, and that is what lives in `android/`.

The first Run downloads the Android SDK pieces Gradle asks for, which takes a
while. After that it is quick.

If you open `android/` before running those two commands, Gradle will stop and
tell you so in as many words. That is deliberate: the two things it needs are
built by npm rather than kept in git, and Android Studio starts syncing Gradle
the moment the folder opens, whether or not you have got to the terminal yet.

### Working on the interface without an emulator

```bash
npm run dev
```

Opens the app at http://localhost:3000 in a normal browser, which is much
faster to iterate in. Narrow the window to phone width; it is the same code the
app runs. When it looks right, `npm run sync` and Run.

## What is in here

```
app/ components/ lib/    the interface: React, exactly as built in harvest-pulse
lib/harbour/            the Supabase client and the code that syncs to it
android/                the native Android project. Open THIS in Android Studio
supabase/migrations/    the database, as numbered SQL files
docs/                   decisions worth writing down
```

### Why the interface is web code inside a native app

The app is a normal installed Android app: its own icon, its own window, no
browser chrome, no address bar, works offline. Inside that window it runs the
interface as-is rather than a second implementation of it, so what you approved
in testing is what ships, to the pixel. The parts a web page genuinely cannot
do live in `lib/harbour/native.ts`, and every one of them is a no-op in a
browser so `npm run dev` behaves exactly as it always did:

- **The back gesture.** Closes whatever overlay is open, then returns to home,
  then puts the app in the background rather than closing it. Overlays already
  close on Escape, so the gesture is translated into the key they all answer.
- **The status bar.** Painted to match the top of the sky the meadow is
  drawing, and its icons flip when that sky goes to dusk.
- **The splash screen.** Held open until the first real screen has painted,
  rather than hidden on a timer that guesses how long that takes.
- **The dialer.** Somebody with a number on your list can be rung from the call
  screen: Harbour hands the number to the phone's own dialer and you press the
  green button. Deliberately `ACTION_DIAL` and not `ACTION_CALL` -- dialling for
  somebody needs no permission at all, and asking for the phone and call-log
  permission is the worst place to spend a new user's trust. It also means the
  app cannot know how the call went, so it asks you when you come back.
- **Haptics**, for a cue arriving and a call going out.

**Not built yet:** notifications that arrive when the app is closed. Slack Tide
only rings while Harbour is open. Doing it properly means a scheduled local
notification and, for the walk detection, a foreground service -- a real piece
of Android work rather than a plugin call, and worth its own pass.

## One thing to do once, in the Supabase dashboard

New Supabase projects require every account to confirm its email address before
it can sign in. For testing with a handful of people that is friction you do not
want yet:

**Authentication > Sign In / Providers > Email > turn OFF "Confirm email"**, then
Save. Accounts work the moment they are made.

If you leave it on, the app handles it properly -- it says "Check your email"
rather than appearing to hang -- but nobody gets in until they click the link.

## The database

Supabase project **Harbour App** (`nfhijkdownrtftdyyuxm`). There is no
application server: the app talks to Postgres directly and row level security
decides what each person may read.

Two rules are enforced by the database itself rather than by the interface,
because an interface promise that the database does not keep is not a promise:

- **"They see the gaps, never what is in them."** Your busy blocks are
  owner-only. A linked person reads `shared_busy`, a view with no `label`
  column, and only while you have sharing turned on.
- **A seed is invisible until it opens.** Its recipient cannot read the row --
  not the message, not the flower, not that it exists -- until `bloom_at` has
  passed.

Both were verified by querying the live database as each user in turn, not by
reading the policies. The first of those tests is what found that the sharing
check could never be true: a policy expression runs as the calling user, so
reading another person's settings row from inside one always failed silently.

### What has and has not been checked

The **shape** of what the app reads and writes has been walked end to end, in a
real browser against a stubbed Supabase: opening past the sign-in gate, the
people list, adding somebody, giving them a number, and the exact request that
goes back to `contacts` for a linked person versus an unlinked one.

What has **not** run is the network itself. This project was assembled in a
sandbox whose policy refuses connections to supabase.co, so real sign-in, a real
`pull()` and a real `push()` against the live project are written, type-checked
and shape-verified but never actually sent. They are the first thing to exercise
on a device.

Three things worth knowing, each found while wiring the native pieces up:

- `push()` reported every write as a success. A failed Supabase query resolves
  with an `{ error }` rather than rejecting, so the check for failures could
  never see one and the offline outbox stayed empty forever. Every write now
  goes through `throwOnError`.
- `load()` asked the server who the signed-in user was, which threw on a phone
  with no signal -- before the cached copy that exists for exactly that case was
  ever reached. It now reads the session already on the device.
- Somebody added by name lived only in that phone's memory: the next pull
  rebuilt the list from `contacts` and they were gone. Adding, renaming and
  removing people now write back.

### Changing the schema

Never edit a migration that has been applied. Add the next numbered file, and
apply it from the Supabase dashboard's SQL editor (or the Supabase CLI).

## Keys

`lib/harbour/config.ts` holds the project URL and the publishable key. Both are
public by design: the key is meant to ship in a client, and it is safe because
row level security is on for every table.

The **service role key bypasses row level security** and must never appear in
this repository, in the app, or in a build. If you ever need it, it goes in an
environment variable on a machine, and nowhere near here.
