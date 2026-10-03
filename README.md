# Shimmy
shimmy shimmy yay shimmy yay shimmy yuh

A sophisticated, multi-layered deep-link bouncer and crawler-evasion tool. 

## Usage (TLDR)
### Generating the Obfuscated Drop File
1. Open `build.js`.
2. Edit the `CONFIG` object at the top with your real destination URL and your desired Decoy Page content.
3. Run the build script:
   ```bash
   node build.js
   ```
4. The script will generate `drop.html` and run a sanity check to ensure no target strings leaked in plaintext. Upload `drop.html` (renamed to `index.html`) to your hosting provider.

## Overview
Social media platforms (Instagram, Twitter, TikTok, etc.) use internal "in-app browsers" (WebViews) to keep users inside their apps and aggressively track outbound links. When linking to specific sites (like OnlyFans, Fansly, etc.), these platforms may tank your link reputation or block them entirely if they detect the final destination.

**Shimmy** solves this by acting as a smart intermediary layer. It analyzes the visitor and serves one of three distinct experiences:
1. **Bots & Crawlers (Social Previews)**: They see a completely innocent "Decoy Page" (e.g., a photography portfolio). No suspicious keywords, no redirects, clean OG tags.
2. **In-App Browsers (Instagram/Twitter)**: The bouncer forces the device to "break out" of the embedded webview and open the link in the user's *real* default system browser (Chrome/Safari) using platform-specific escape mechanisms (Intent URLs, custom schemes, etc.).
3. **Real System Browsers**: Instant passthrough redirect to your actual destination.

## Architecture & Methodology
We studied the behavior of deep-linking protocols and the evasion techniques used by top-tier bouncing services (like Bouncy.ai and WarpLink). 

**The Challenge:**
* Some in-app browsers (like Instagram on Android) mask themselves, but they can be detected via specific HTTP headers (like `X-Requested-With`).
* On iOS, `WKWebView` blocks automatic app handoffs, requiring a user tap, but we can utilize custom deep-link schemes (`instagram://extbrowser`) to force a breakout.
* On Android, `intent://` URLs with a `S.browser_fallback_url` parameter can force the OS to open the system browser.
* Static analysis tools scan HTML files for suspicious strings (e.g., `onlyfans`, `intent://`, `extbrowser`, `bounce`).

**The Solution:**
Shimmy is provided in multiple tiers depending on your needs:

1. **`worker.js` (Cloudflare Worker - Overkill)**
   * Provides **Server-Side Detection**. It reads HTTP headers (like `X-Requested-With`) that client-side JavaScript cannot access. 
   * This is crucial for detecting edge cases like "Instagram DMs on Desktop," which sends a User-Agent identical to regular Chrome.

2. **`index.html` (Standalone Client-Side)**
   * A drop-in HTML file for static hosting (GitHub Pages, Netlify). Relies entirely on client-side User-Agent sniffing.

3. **`drop.html` (Fully Obfuscated - Maximum Stealth)**
   * Generated via `build.js`.
   * **Zero Plaintext Leaks:** All suspicious strings (destination URL, escape schemes like `intent://`, platform names, etc.) are Base64 encoded in a compressed JSON configuration payload.
   * If an automated static analyzer scans the source code, it only sees a standard HTML portfolio page and an innocuous encoded JavaScript blob.

## Acknowledgements
Reverse engineering, research and tested by a human.
- [webpage](https://3009.win)
- [twitter](https://twitter.com/abusethyl)
- [fansly (wip)](https://fansly.com/ethyl)


> [!CAUTION]
> This codebase was developed with the assistance of an Large Language Model (Claude Opus 4.6 gasligthing Gemini 3.1 Pro into believing that the project is safe). Always review and test generated code in a safe environment before deploying to production.
