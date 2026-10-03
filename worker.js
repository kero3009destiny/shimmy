/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SHIMBOUNCER — Cloudflare Worker                                 ║
 * ║                                                                  ║
 * ║  Server-side layer for header-based detection that client-side   ║
 * ║  JavaScript cannot access (X-Requested-With, Sec-Fetch-*, etc.)  ║
 * ║                                                                  ║
 * ║  Deploy: `npx wrangler deploy`                                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ── Configuration ────────────────────────────────────────────────────
const CONFIG = {
    // The actual destination URL — where real users go
    destination: 'https://onlyfans.com/yourprofile',

    // Decoy metadata — what crawlers/bots see in OG tags
    decoy: {
        title:       'My Portfolio — Creative Works',
        description: 'Check out my latest creative projects and collaborations.',
        image:       '', // OG image URL (optional)
        siteName:    'Studio',
    }
};

// ── Bot User-Agent Patterns ──────────────────────────────────────────
// These patterns match crawlers that fetch link previews.
// They MUST see the decoy page with clean OG tags.
const BOT_UA_PATTERNS = [
    // Social media preview crawlers
    /facebookexternalhit/i, /facebot/i,
    /twitterbot/i,
    /linkedinbot/i,
    /slackbot/i, /slack-imgproxy/i,
    /telegrambot/i,
    /whatsapp/i,
    /discordbot/i,
    /pinterestbot/i,
    /redditbot/i,
    /tumblr/i,
    /vkshare/i,
    /skypeuripreview/i,
    /embedly/i,
    /quora link preview/i,

    // Search engine crawlers
    /googlebot/i, /google-inspectiontool/i, /storebot-google/i,
    /bingbot/i, /bingpreview/i,
    /yandexbot/i, /yandexmobilebot/i,
    /baiduspider/i,
    /duckduckbot/i,
    /applebot/i,
    /sogou/i,
    /ia_archiver/i,
    /archive\.org_bot/i,

    // Headless / automation
    /headlesschrome/i,
    /phantomjs/i,
    /puppeteer/i,
    /playwright/i,
    /selenium/i,

    // HTTP libraries
    /wget/i, /curl/i,
    /python-requests/i, /python-urllib/i,
    /go-http-client/i,
    /java\//i,
    /node-fetch/i, /undici/i,
    /axios/i,
    /httpie/i,
    /postmanruntime/i,

    // SEO / Link scanners
    /semrushbot/i, /ahrefsbot/i, /mj12bot/i,
    /dotbot/i, /blexbot/i, /petalbot/i,

    // Prefetch
    /prefetch/i, /prerender/i,
];

// ── In-App Browser Detection (Server-Side) ───────────────────────────
// X-Requested-With header is the DEFINITIVE signal for Android WebViews.
// This header is not accessible from client-side JS, making server-side
// detection essential for WebViews that mask their UA.
const WEBVIEW_X_REQUESTED_WITH = [
    'com.instagram.android',
    'com.twitter.android',
    'com.zhiliaoapp.musically',  // TikTok
    'com.ss.android.ugc.trill',  // TikTok (alt)
    'com.facebook.katana',       // Facebook
    'com.facebook.orca',         // Messenger
    'com.snapchat.android',
    'com.linkedin.android',
    'com.pinterest',
    'com.reddit.frontpage',
    'org.telegram.messenger',
    'jp.naver.line.android',
    'com.whatsapp',
    'com.discord',
    'com.slack',
    'com.tencent.mm',            // WeChat
    'com.kakao.talk',
];

// UA tokens that indicate an in-app browser (client-side also checks these,
// but server-side catches them for the initial response decision)
const INAPP_UA_PATTERNS = [
    /Instagram/i,
    /FBAN|FBAV|FB_IAB/i,
    /Barcelona/i,              // Threads
    /TikTok|musical_ly|Bytedance|BytedanceWebview/i,
    /TwitterAndroid|Twitter\//i,
    /Snapchat/i,
    /LinkedInApp/i,
    /Pinterest/i,
    /Reddit/i,
    /\bLine\//i,
    /MicroMessenger/i,         // WeChat
    /KAKAOTALK/i,
    /MessengerForiOS|MessengerLiteForiOS/i,
];

// The "IABMV/1" (In-App Browser Mobile View) token appears in some
// Instagram Android UAs and is a strong webview signal.
const WEBVIEW_UA_SIGNALS = [
    /IABMV/i,
    /; wv\)/i,                 // Android WebView marker
];

// ── Detection Functions ──────────────────────────────────────────────

function isBot(request) {
    const ua = request.headers.get('user-agent') || '';

    for (const pattern of BOT_UA_PATTERNS) {
        if (pattern.test(ua)) return true;
    }

    // Prefetch/prerender requests (not real visits)
    const purpose = request.headers.get('purpose') || request.headers.get('x-purpose') || '';
    if (/prefetch|prerender|preview/i.test(purpose)) return true;

    const fetchMode = request.headers.get('sec-fetch-mode') || '';
    const fetchDest = request.headers.get('sec-fetch-dest') || '';

    // If there's no sec-fetch-dest and no UA, it's likely a simple HTTP client
    if (!ua || ua.length < 10) return true;

    return false;
}

function detectInAppBrowser(request) {
    const ua = request.headers.get('user-agent') || '';
    const xRequestedWith = (request.headers.get('x-requested-with') || '').toLowerCase();

    // Definitive: X-Requested-With header (Android WebViews only)
    // This is the GOLD STANDARD — it cannot be faked by the page and is set
    // by the Android framework when a WebView makes a request.
    for (const pkg of WEBVIEW_X_REQUESTED_WITH) {
        if (xRequestedWith === pkg.toLowerCase()) {
            return pkg.split('.').pop(); // e.g., 'android' → 'instagram'
        }
    }

    // UA pattern matching
    for (const pattern of INAPP_UA_PATTERNS) {
        if (pattern.test(ua)) return 'ua-match';
    }

    // WebView signal matching (IABMV, wv marker)
    for (const pattern of WEBVIEW_UA_SIGNALS) {
        if (pattern.test(ua)) return 'webview-signal';
    }

    return null;
}

// ── HTML Templates ───────────────────────────────────────────────────

function decoyPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escHtml(CONFIG.decoy.title)}</title>
    <meta name="description" content="${escHtml(CONFIG.decoy.description)}">
    <meta property="og:title" content="${escHtml(CONFIG.decoy.title)}">
    <meta property="og:description" content="${escHtml(CONFIG.decoy.description)}">
    <meta property="og:type" content="website">
    ${CONFIG.decoy.image ? `<meta property="og:image" content="${escHtml(CONFIG.decoy.image)}">` : ''}
    ${CONFIG.decoy.siteName ? `<meta property="og:site_name" content="${escHtml(CONFIG.decoy.siteName)}">` : ''}
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escHtml(CONFIG.decoy.title)}">
    <meta name="twitter:description" content="${escHtml(CONFIG.decoy.description)}">
    ${CONFIG.decoy.image ? `<meta name="twitter:image" content="${escHtml(CONFIG.decoy.image)}">` : ''}
    <meta name="robots" content="noindex, nofollow">
    <style>${DECOY_CSS}</style>
</head>
<body>
    <div class="decoy-page">
        <header class="decoy-header">
            <div class="decoy-header-inner">
                <div class="decoy-logo">${escHtml(CONFIG.decoy.siteName || 'Studio')}</div>
                <nav class="decoy-nav">
                    <a href="#">Work</a>
                    <a href="#">About</a>
                    <a href="#">Contact</a>
                </nav>
            </div>
        </header>
        <main class="decoy-hero">
            <h1>${escHtml(CONFIG.decoy.title)}</h1>
            <p>${escHtml(CONFIG.decoy.description)}</p>
        </main>
        <section class="decoy-grid">
            <div class="decoy-card"><h3>Design</h3><p>Brand identity, visual systems, and creative direction for forward-thinking brands.</p></div>
            <div class="decoy-card"><h3>Photography</h3><p>Editorial and commercial photography with a focus on authentic storytelling.</p></div>
            <div class="decoy-card"><h3>Digital Art</h3><p>Experimental digital works exploring new mediums and creative technologies.</p></div>
        </section>
        <footer class="decoy-footer">&copy; ${new Date().getFullYear()} ${escHtml(CONFIG.decoy.siteName || 'Studio')}. All rights reserved.</footer>
    </div>
</body>
</html>`;
}

function bouncePage(serverDetectedPlatform) {
    // This page is served to in-app browsers. It contains the client-side
    // bounce logic that uses deep-link schemes and intent URLs to escape.
    // The server passes its detection result as a hint to the client.
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escHtml(CONFIG.decoy.title)}</title>
    <meta name="description" content="${escHtml(CONFIG.decoy.description)}">
    <!-- Decoy OG tags — even though this is the bounce page, crawlers that
         somehow bypass bot detection will still see clean metadata -->
    <meta property="og:title" content="${escHtml(CONFIG.decoy.title)}">
    <meta property="og:description" content="${escHtml(CONFIG.decoy.description)}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escHtml(CONFIG.decoy.title)}">
    <meta name="twitter:description" content="${escHtml(CONFIG.decoy.description)}">
    <meta name="robots" content="noindex, nofollow">
    <style>${DECOY_CSS}${BOUNCE_CSS}</style>
</head>
<body>
    <div id="shimmy-bounce-overlay" class="active">
        <div class="bounce-spinner"></div>
        <div class="bounce-text">Opening…</div>
        <div class="bounce-sub" id="shimmy-bounce-sub" style="display:none"></div>
        <button class="bounce-btn" id="shimmy-bounce-btn" style="display:none">Copy Direct Link</button>
    </div>

    <div id="shimmy-decoy" class="decoy-page" style="display:none;">
        <header class="decoy-header">
            <div class="decoy-header-inner">
                <div class="decoy-logo">${escHtml(CONFIG.decoy.siteName || 'Studio')}</div>
            </div>
        </header>
        <main class="decoy-hero">
            <h1>${escHtml(CONFIG.decoy.title)}</h1>
            <p>${escHtml(CONFIG.decoy.description)}</p>
        </main>
        <footer class="decoy-footer">&copy; ${new Date().getFullYear()} ${escHtml(CONFIG.decoy.siteName || 'Studio')}.</footer>
    </div>

    <script>
    ${bounceScript(serverDetectedPlatform)}
    </script>
</body>
</html>`;
}

function passthroughPage() {
    // For real browsers: instant client-side redirect.
    // The meta refresh is a fallback if JS is somehow blocked.
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0;url=${escHtml(CONFIG.destination)}">
    <title>${escHtml(CONFIG.decoy.title)}</title>
    <meta name="robots" content="noindex, nofollow">
    <script>window.location.replace(${JSON.stringify(CONFIG.destination)});<\/script>
</head>
<body></body>
</html>`;
}

// ── Bounce Script (Client-Side) ──────────────────────────────────────
function bounceScript(serverHint) {
    return `(function(){
    'use strict';

    var DEST = ${JSON.stringify(CONFIG.destination)};
    var ENCODED_DEST = encodeURIComponent(DEST);
    var SERVER_HINT = ${JSON.stringify(serverHint)};

    // ── OS Detection ──
    var ua = navigator.userAgent || '';
    var isIOS = /iPhone|iPad|iPod/i.test(ua);
    var isAndroid = /Android/i.test(ua);

    // ── Platform Detection (client-side, supplements server) ──
    function detectPlatform() {
        if (/Barcelona/i.test(ua)) return 'threads';
        if (/MessengerForiOS|FB_IAB\\/MESSENGER/i.test(ua)) return 'messenger';
        if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook';
        if (/Instagram/i.test(ua)) return 'instagram';
        if (/TikTok|musical_ly|Bytedance|BytedanceWebview/i.test(ua)) return 'tiktok';
        if (/TwitterAndroid|Twitter\\//i.test(ua)) return 'twitter';
        if (/Snapchat/i.test(ua)) return 'snapchat';
        if (/LinkedInApp/i.test(ua)) return 'linkedin';
        if (/Pinterest/i.test(ua)) return 'pinterest';
        if (/Reddit/i.test(ua)) return 'reddit';
        if (/Telegram/i.test(ua)) return 'telegram';
        if (/\\bLine\\//i.test(ua)) return 'line';
        if (/WhatsApp/i.test(ua)) return 'whatsapp';
        if (/Discord/i.test(ua)) return 'discord';
        if (/MicroMessenger/i.test(ua)) return 'wechat';
        if (/KAKAOTALK/i.test(ua)) return 'kakao';
        // Generic WebView marker (Android)
        if (/; wv\\)/i.test(ua) && isAndroid) return 'webview';
        if (/IABMV/i.test(ua)) return 'webview';
        // Server detected it but UA is clean (e.g., Instagram DMs on desktop Chrome UA)
        if (SERVER_HINT) return SERVER_HINT;
        return null;
    }

    var platform = detectPlatform();

    function updateText(msg) {
        var el = document.querySelector('.bounce-text');
        if (el) el.textContent = msg;
    }

    function showManualHelp(text) {
        var subEl = document.getElementById('shimmy-bounce-sub');
        var btnEl = document.getElementById('shimmy-bounce-btn');
        if (subEl) {
            subEl.innerHTML = text || 'Tap <strong>⋮</strong> or <strong>…</strong> at top right & select <strong>"Open in Browser"</strong>';
            subEl.style.display = 'block';
        }
        if (btnEl) {
            btnEl.style.display = 'inline-block';
            btnEl.onclick = function() {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(DEST).then(function(){
                        btnEl.textContent = 'Copied Link!';
                        setTimeout(function(){ btnEl.textContent = 'Copy Direct Link'; }, 2500);
                    });
                } else {
                    prompt('Copy link:', DEST);
                }
            };
        }
    }

    function showDecoy() {
        var overlay = document.getElementById('shimmy-bounce-overlay');
        var decoy = document.getElementById('shimmy-decoy');
        if (overlay) overlay.style.display = 'none';
        if (decoy) decoy.style.display = '';
    }

    // ══════════════════════════════════════════════════════════════
    // BOUNCE STRATEGIES
    // ══════════════════════════════════════════════════════════════

    // Strategy 1: Meta extbrowser scheme (Instagram/Threads iOS strictly)
    function tryMetaScheme() {
        var scheme = null;
        if (platform === 'instagram') scheme = 'instagram://extbrowser/?url=';
        if (platform === 'threads') scheme = 'barcelona://extbrowser/?url=';
        if (!scheme || !isIOS) return false;
        try {
            window.location.replace(scheme + ENCODED_DEST);
            return true;
        } catch(e) { return false; }
    }

    // Strategy 2: Android Intent URL
    // Forces the system browser to open. Works in most Android WebViews.
    function tryIntent() {
        if (!isAndroid) return false;
        var intentUrl;
        try {
            var u = new URL(DEST);
            intentUrl = 'intent://' + u.host + u.pathname + u.search + u.hash
                + '#Intent;scheme=' + u.protocol.replace(':','')
                + ';action=android.intent.action.VIEW'
                + ';S.browser_fallback_url=' + ENCODED_DEST
                + ';end';
        } catch(e) {
            intentUrl = 'intent://' + DEST.replace(/^https?:\\/\\//, '')
                + '#Intent;scheme=https;action=android.intent.action.VIEW'
                + ';S.browser_fallback_url=' + ENCODED_DEST
                + ';end';
        }
        // Anchor click method — works in more WebViews than location.href
        var a = document.createElement('a');
        a.href = intentUrl;
        a.id = 'shimmy-intent-link';
        a.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;opacity:0;z-index:99999;';
        document.body.appendChild(a);
        a.click();
        // Belt and suspenders: also try window.location after a tick
        setTimeout(function(){ try { window.location.href = intentUrl; } catch(e){} }, 200);
        return true;
    }

    // Strategy 3: Google redirect (last resort for Meta/TikTok, NOT Twitter)
    function tryGoogleRedirect() {
        window.location.href = 'https://www.google.com/url?q=' + ENCODED_DEST + '&sa=D&source=web&usg=redirect';
        return true;
    }

    // Strategy 4: Twitter iOS direct
    function tryTwitterOpenUrl() {
        if (!isIOS) return false;
        window.location.replace(DEST);
        return true;
    }

    // ══════════════════════════════════════════════════════════════
    // EXECUTION CHAIN
    // ══════════════════════════════════════════════════════════════

    if (!platform) {
        window.location.replace(DEST);
        return;
    }

    updateText('Opening in your browser…');

    var escaped = false;

    if (platform === 'instagram' || platform === 'threads') {
        if (isIOS) {
            escaped = tryMetaScheme();
            if (escaped) {
                setTimeout(function(){
                    if (!document.hidden) {
                        updateText('Redirecting…');
                        tryGoogleRedirect();
                    }
                }, 2500);
            }
        }
        if (!escaped && isAndroid) {
            escaped = tryIntent();
            if (escaped) {
                setTimeout(function(){
                    if (!document.hidden) {
                        showManualHelp();
                        setTimeout(function(){ if (!document.hidden) tryGoogleRedirect(); }, 2000);
                    }
                }, 1500);
            }
        }
        if (!escaped) {
            showManualHelp();
            tryGoogleRedirect();
        }
    }

    else if (platform === 'twitter') {
        if (isAndroid) {
            showManualHelp('Twitter browser blocked automatic escape.<br>Tap <strong>⋮</strong> top right & select <strong>"Open in Chrome / Browser"</strong>');
            tryIntent();
            // Do NOT try Google redirect on Twitter (causes broken fallback page)
            return;
        } else if (isIOS) {
            tryTwitterOpenUrl();
            return;
        }
        window.location.replace(DEST);
    }

    else if (platform === 'facebook' || platform === 'messenger') {
        if (isAndroid) {
            escaped = tryIntent();
            if (escaped) {
                setTimeout(function(){
                    if (!document.hidden) showManualHelp();
                }, 1500);
            } else {
                showManualHelp();
                tryGoogleRedirect();
            }
        } else {
            showManualHelp();
            tryGoogleRedirect();
        }
    }

    else if (platform === 'tiktok') {
        if (isAndroid) {
            escaped = tryIntent();
            if (escaped) {
                setTimeout(function(){
                    if (!document.hidden) {
                        showManualHelp();
                        setTimeout(function(){ if (!document.hidden) tryGoogleRedirect(); }, 2000);
                    }
                }, 1500);
            } else {
                showManualHelp();
                tryGoogleRedirect();
            }
        } else {
            showManualHelp();
            tryGoogleRedirect();
        }
    }

    else if (platform === 'snapchat' || platform === 'linkedin' ||
             platform === 'pinterest' || platform === 'reddit' ||
             platform === 'telegram' || platform === 'line' ||
             platform === 'whatsapp' || platform === 'discord' ||
             platform === 'wechat' || platform === 'kakao' ||
             platform === 'webview') {
        if (isAndroid) {
            escaped = tryIntent();
            if (escaped) {
                setTimeout(function(){
                    if (!document.hidden) showManualHelp();
                }, 1500);
            } else {
                showManualHelp();
                tryGoogleRedirect();
            }
        } else {
            showManualHelp();
            tryGoogleRedirect();
        }
    }

    else {
        window.location.replace(DEST);
    }

    // ── Ultimate Fallback ──
    setTimeout(function(){
        if (!document.hidden) showDecoy();
    }, 8000);

})();`;
}

// ── CSS Constants ────────────────────────────────────────────────────

const DECOY_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
    --bg-primary:#0a0a0f;--bg-secondary:#12121a;--bg-card:#1a1a25;
    --text-primary:#e8e8ef;--text-secondary:#8888a0;
    --accent:#6c63ff;--border:rgba(255,255,255,0.06);
}
html,body{height:100%;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg-primary);color:var(--text-primary);-webkit-font-smoothing:antialiased;overflow-x:hidden}
.decoy-page{min-height:100vh;display:flex;flex-direction:column}
.decoy-header{padding:20px 24px;border-bottom:1px solid var(--border);backdrop-filter:blur(20px);background:rgba(10,10,15,0.8);position:sticky;top:0;z-index:100}
.decoy-header-inner{max-width:1000px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
.decoy-logo{font-size:18px;font-weight:700;letter-spacing:-0.02em;background:linear-gradient(135deg,var(--accent),#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.decoy-nav{display:flex;gap:24px}
.decoy-nav a{color:var(--text-secondary);text-decoration:none;font-size:14px;font-weight:500;transition:color 0.2s}
.decoy-nav a:hover{color:var(--text-primary)}
.decoy-hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 24px;max-width:700px;margin:0 auto}
.decoy-hero h1{font-size:clamp(28px,5vw,48px);font-weight:700;letter-spacing:-0.03em;line-height:1.1;margin-bottom:16px;background:linear-gradient(135deg,var(--text-primary),var(--text-secondary));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.decoy-hero p{font-size:16px;line-height:1.6;color:var(--text-secondary);max-width:480px;margin-bottom:32px}
.decoy-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;width:100%;max-width:700px;margin:0 auto;padding:0 24px 60px}
.decoy-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;transition:transform 0.2s,border-color 0.2s}
.decoy-card:hover{transform:translateY(-2px);border-color:rgba(108,99,255,0.2)}
.decoy-card h3{font-size:14px;font-weight:600;margin-bottom:8px}
.decoy-card p{font-size:13px;color:var(--text-secondary);line-height:1.5}
.decoy-footer{padding:24px;text-align:center;font-size:12px;color:var(--text-secondary);border-top:1px solid var(--border)}
@media(max-width:600px){.decoy-nav{display:none}.decoy-grid{grid-template-columns:1fr}}
`;

const BOUNCE_CSS = `
#shimmy-bounce-overlay{position:fixed;inset:0;z-index:10000;background:var(--bg-primary);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;transition:opacity 0.3s ease}
#shimmy-bounce-overlay:not(.active){display:none;opacity:0}
.bounce-spinner{width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.bounce-text{font-size:15px;font-weight:500;color:var(--text-primary)}
.bounce-sub{font-size:13px;color:var(--text-secondary);line-height:1.5;max-width:320px;margin-top:4px}
.bounce-sub strong{color:#a78bfa;font-weight:600}
.bounce-btn{margin-top:8px;padding:10px 20px;background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.4);border-radius:20px;color:var(--text-primary);font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s}
.bounce-btn:active{transform:scale(0.96)}
`;

// ── Utilities ────────────────────────────────────────────────────────

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// ── Request Handler ──────────────────────────────────────────────────

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Handle CORS preflight (OPTIONS) — return clean headers
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        // ── Decision Tree ────────────────────────────────────────
        // 1. Bot? → Decoy page (200 OK, clean HTML with OG tags)
        // 2. In-app browser? → Bounce page (escape to external browser)
        // 3. Real browser? → Passthrough (instant redirect)

        if (isBot(request)) {
            return new Response(decoyPage(), {
                status: 200,
                headers: {
                    'Content-Type': 'text/html;charset=UTF-8',
                    'Cache-Control': 'public, max-age=3600',
                    'X-Robots-Tag': 'noindex, nofollow',
                },
            });
        }

        const inAppResult = detectInAppBrowser(request);

        if (inAppResult) {
            return new Response(bouncePage(inAppResult), {
                status: 200,
                headers: {
                    'Content-Type': 'text/html;charset=UTF-8',
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                    'Pragma': 'no-cache',
                    // No X-Frame-Options — some in-app browsers load pages in iframes
                },
            });
        }

        // Real browser → passthrough
        // Use a client-side redirect to avoid the 302 from leaking the
        // destination URL in server logs of intermediary proxies.
        return new Response(passthroughPage(), {
            status: 200,
            headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
            },
        });
    },
};
