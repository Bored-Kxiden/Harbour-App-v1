/** Harbour ships as an Android app, not a website.
 *
 *  Capacitor serves the built files from inside the APK, so there is no Node
 *  server at runtime and every route has to exist as a file on disk before the
 *  app is packaged. That makes `output: 'export'` the only mode that works
 *  here, and it is why nothing in this project may use a server feature
 *  (route handlers, middleware, image optimisation, headers): there is no
 *  server on a phone to run them.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Writes the whole app to `out/` as plain files. capacitor.config.ts points
     at the same folder. */
  output: 'export',
  /* No image server on a phone. */
  images: { unoptimized: true },
  /* Emit `index.html` inside each route folder, so a file server with no
     rewrite rules still finds every page. */
  trailingSlash: true,
}

export default nextConfig
