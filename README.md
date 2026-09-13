# Harbour

An Android app for staying close to the people at home. The interface is the
one built and tested in [harvest-pulse](https://github.com/Bored-Kxiden/harvest-pulse),
running inside a native Android shell, with Supabase behind it.

## Opening it in Android Studio

You need [Android Studio](https://developer.android.com/studio) and
[Node.js](https://nodejs.org) (version 20 or newer). Then, once:

```bash
npm install
```

And every time you want to see your changes on a phone or emulator:

```bash
npm run sync
```

That builds the interface and copies it into the Android project. Then open
**the `android` folder** in Android Studio (not this folder -- `android` is the
Gradle project) and press Run.

> Open `android/`, not the repository root. Android Studio looks for a Gradle
> project, and that is what lives in `android/`.

The first Run downloads the Android SDK pieces Gradle asks for, which takes a
while. After that it is quick.

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
do -- placing a call, ringing a cue, sensing that a walk has ended -- are
Android code that the interface calls into.

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

Both are covered by the tests in `supabase/migrations/` comments and were
verified against the live database.

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
