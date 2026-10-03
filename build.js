/**
 * build.js — Generates the obfuscated drop.html from config.
 * 
 * Usage:
 *   node build.js
 * 
 * Edit the CONFIG object below, then run. Output: drop.html
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// CONFIG — Edit these values
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
    // Where the real user ends up
    destination: 'https://fansly.com/ethyl',

    // Decoy page content (what bots and no-JS users see)
    decoy: {
        title: 'Ethyl Sine - Interaction Design',
        description: 'Something like an omnipotent.',
        siteName: 'Ethyl Sine',
        navLinks: ['Works', 'About', 'Contact', 'Impressum'],
        heroTitle: 'Interaction Design',
        heroText: 'Exploring the intersection of form, function, and emotion through tangible interfaces. Currently accepting select commissions.',
        cards: [
            { title: 'Works', text: 'My works.' },
            { title: 'About', text: 'All about me.' },
            { title: 'Contact', text: 'How to reach me.' },
            { title: 'Impressum', text: 'Legal stuff.' },
        ],
        footerYear: new Date().getFullYear(),
    }
};

// ═══════════════════════════════════════════════════════════════
// DETECTION DATA — All the UA/scheme strings that need encoding
// ═══════════════════════════════════════════════════════════════
const DETECTION = {
    // In-app browser UA patterns → platform name mapping
    // Order matters: more specific patterns first
    platforms: [
        { pattern: 'Barcelona', name: 'threads' },
        { pattern: 'MessengerForiOS|FB_IAB\\/MESSENGER', name: 'messenger' },
        { pattern: 'FBAN|FBAV|FB_IAB', name: 'facebook' },
        { pattern: 'Instagram', name: 'instagram' },
        { pattern: 'TikTok|musical_ly|Bytedance|BytedanceWebview', name: 'tiktok' },
        { pattern: 'TwitterAndroid|Twitter\\/', name: 'twitter' },
        { pattern: 'Snapchat', name: 'snapchat' },
        { pattern: 'LinkedInApp', name: 'linkedin' },
        { pattern: 'Pinterest', name: 'pinterest' },
        { pattern: 'Reddit', name: 'reddit' },
        { pattern: 'Telegram', name: 'telegram' },
        { pattern: '\\bLine\\/', name: 'line' },
        { pattern: 'WhatsApp', name: 'whatsapp' },
        { pattern: 'Discord', name: 'discord' },
        { pattern: 'MicroMessenger', name: 'wechat' },
        { pattern: 'KAKAOTALK', name: 'kakao' },
    ],

    // Generic webview signals (checked after named platforms)
    webviewSignals: [
        { pattern: '; wv\\)', guard: 'Android', exclude: 'SamsungBrowser|Firefox|OPR|Edg|Brave' },
        { pattern: 'IABMV', guard: null, exclude: null },
    ],

    // Bot UA substrings
    bots: [
        'facebookexternalhit', 'facebot', 'twitterbot', 'linkedinbot', 'slackbot',
        'telegrambot', 'whatsapp', 'discordbot', 'pinterestbot', 'redditbot',
        'googlebot', 'google-inspectiontool', 'bingbot', 'bingpreview',
        'yandexbot', 'baiduspider', 'duckduckbot', 'applebot', 'sogou',
        'headlesschrome', 'phantomjs', 'puppeteer', 'playwright', 'selenium',
        'wget', 'curl', 'python-requests', 'python-urllib', 'go-http-client',
        'node-fetch', 'undici', 'axios', 'httpie', 'postmanruntime',
        'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'petalbot', 'blexbot',
        'prefetch', 'prerender', 'ia_archiver'
    ],

    // Escape schemes
    schemes: {
        instagram: 'instagram://extbrowser/?url=',
        threads: 'barcelona://extbrowser/?url=',
    },

    // Fallback redirect base
    googleRedirect: 'https://www.google.com/url?q=',

    // OS detection patterns
    os: {
        ios: 'iPhone|iPad|iPod',
        android: 'Android',
    }
};

// ═══════════════════════════════════════════════════════════════
// ENCODER
// ═══════════════════════════════════════════════════════════════
function b64(str) {
    return Buffer.from(str, 'utf8').toString('base64');
}

// Build the runtime config blob (JSON → base64)
// Every string that could be flagged by static analysis is encoded.
function buildRuntimeConfig() {
    const rc = {
        d: b64(CONFIG.destination),
        p: DETECTION.platforms.map(p => [b64(p.pattern), b64(p.name)]),
        w: DETECTION.webviewSignals.map(s => [
            b64(s.pattern),
            s.guard ? b64(s.guard) : null,
            s.exclude ? b64(s.exclude) : null,
        ]),
        b: DETECTION.bots.map(b => b64(b)),
        s: {},
        g: b64(DETECTION.googleRedirect),
        o: {
            i: b64(DETECTION.os.ios),
            a: b64(DETECTION.os.android),
        },
        // Intent URL template parts (Android deep-link escape)
        t: {
            pre: b64('intent://'),
            mid: b64('#Intent;scheme='),
            act: b64(';action=android.intent.action.VIEW;S.browser_fallback_url='),
            end: b64(';end'),
            re: b64('^https?://'),
        },
    };
    for (const [k, v] of Object.entries(DETECTION.schemes)) {
        rc.s[b64(k)] = b64(v);
    }
    return b64(JSON.stringify(rc));
}

// ═══════════════════════════════════════════════════════════════
// HTML TEMPLATE — The output looks like a normal portfolio site
// ═══════════════════════════════════════════════════════════════
function buildHtml(encodedConfig) {
    const d = CONFIG.decoy;
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(d.title)}</title>
<meta name="description" content="${esc(d.description)}">
<meta property="og:title" content="${esc(d.title)}">
<meta property="og:description" content="${esc(d.description)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(d.title)}">
<meta name="twitter:description" content="${esc(d.description)}">
<meta name="robots" content="noindex, nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--c0:#0a0a0f;--c1:#12121a;--c2:#1a1a25;--c3:#e8e8ef;--c4:#8888a0;--c5:#6c63ff;--c6:rgba(255,255,255,.06)}
html,body{height:100%;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--c0);color:var(--c3);-webkit-font-smoothing:antialiased;overflow-x:hidden}
.v{position:fixed;inset:0;z-index:10000;background:var(--c0);display:none;flex-direction:column;align-items:center;justify-content:center;gap:20px}
.v.on{display:flex}
.v i{width:40px;height:40px;border:3px solid var(--c6);border-top-color:var(--c5);border-radius:50%;animation:r .8s linear infinite;font-style:normal}
@keyframes r{to{transform:rotate(360deg)}}
.v span{font-size:14px;color:var(--c4);letter-spacing:.02em}
.x{min-height:100vh;display:flex;flex-direction:column}
.h{padding:20px 24px;border-bottom:1px solid var(--c6);backdrop-filter:blur(20px);background:rgba(10,10,15,.8);position:sticky;top:0;z-index:100}
.hi{max-width:1000px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
.l{font-size:18px;font-weight:700;letter-spacing:-.02em;background:linear-gradient(135deg,var(--c5),#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.n{display:flex;gap:24px}.n a{color:var(--c4);text-decoration:none;font-size:14px;font-weight:500;transition:color .2s}.n a:hover{color:var(--c3)}
.m{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 24px;max-width:700px;margin:0 auto}
.m h1{font-size:clamp(28px,5vw,48px);font-weight:700;letter-spacing:-.03em;line-height:1.1;margin-bottom:16px;background:linear-gradient(135deg,var(--c3),var(--c4));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.m p{font-size:16px;line-height:1.6;color:var(--c4);max-width:480px;margin-bottom:32px}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;width:100%;max-width:700px;margin:0 auto;padding:0 24px 60px}
.k{background:var(--c2);border:1px solid var(--c6);border-radius:12px;padding:24px;transition:transform .2s,border-color .2s}
.k:hover{transform:translateY(-2px);border-color:rgba(108,99,255,.2)}
.k h3{font-size:14px;font-weight:600;margin-bottom:8px}.k p{font-size:13px;color:var(--c4);line-height:1.5}
.f{padding:24px;text-align:center;font-size:12px;color:var(--c4);border-top:1px solid var(--c6)}
@media(max-width:600px){.n{display:none}.g{grid-template-columns:1fr}}
</style>
<script>
!function(){var _=atob,J=JSON.parse,C=J(_(${JSON.stringify(encodedConfig)}));
var D=_(C.d),u=navigator.userAgent||'',ul=u.toLowerCase();
var q=C.b,m=false;for(var i=0;i<q.length;i++){if(ul.indexOf(_(q[i]).toLowerCase())!==-1){m=true;break}}
if(!m&&typeof window.innerWidth!=='undefined'&&window.innerWidth===0&&window.innerHeight===0)m=true;
if(m)return;
function dp(){for(var i=0;i<C.p.length;i++){var t=C.p[i];if(new RegExp(_(t[0]),'i').test(u))return _(t[1])}
for(var j=0;j<C.w.length;j++){var w=C.w[j];if(new RegExp(_(w[0]),'i').test(u)){if(w[1]&&!new RegExp(_(w[1]),'i').test(u))continue;if(w[2]&&new RegExp(_(w[2]),'i').test(u))continue;return'wv'}}
return null}
var p=dp(),ios=new RegExp(_(C.o.i),'i').test(u),and=new RegExp(_(C.o.a),'i').test(u);
if(!p){window.location.replace(D);return}
function go(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn()}
go(function(){var ov=document.getElementById('J');if(ov)ov.classList.add('on');
var sk={};for(var k in C.s)sk[_(k)]=C.s[k];
function ms(){var s=null;if(p===_(C.p[3][1])&&sk[_(C.p[3][1])])s=_(sk[_(C.p[3][1])]);
if(p===_(C.p[0][1])&&sk[_(C.p[0][1])])s=_(sk[_(C.p[0][1])]);
if(!s||!ios)return false;try{window.location.replace(s+encodeURIComponent(D));return true}catch(e){return false}}
function ni(){if(!and)return false;var enc=encodeURIComponent(D),iu;
try{var x=new URL(D);iu=_(C.t.pre)+x.host+x.pathname+x.search+x.hash+_(C.t.mid)+x.protocol.replace(':','')
+_(C.t.act)+enc+_(C.t.end)}
catch(e){iu=_(C.t.pre)+D.replace(new RegExp(_(C.t.re)),'')+_(C.t.mid)+'https'+_(C.t.act)+enc+_(C.t.end)}
var a=document.createElement('a');a.href=iu;a.style.cssText='position:fixed;inset:0;opacity:0;z-index:99999';
document.body.appendChild(a);a.click();setTimeout(function(){try{window.location.href=iu}catch(e){}},200);return true}
function gr(){window.location.href=_(C.g)+encodeURIComponent(D)+'&sa=D&source=web&usg=r'}
var ok=false;
if((p===_(C.p[3][1])||p===_(C.p[0][1]))&&ios){ok=ms();if(ok){setTimeout(function(){if(!document.hidden)gr()},2500);return}}
if(and){ok=ni();if(ok){setTimeout(function(){if(!document.hidden)gr()},3000);return}}
if(p===_(C.p[5][1])&&ios){window.location.replace(D);return}
gr();
setTimeout(function(){if(!document.hidden){var o=document.getElementById('J');if(o)o.style.display='none'}},8000)})}();
</script>
</head>
<body>
<div class="v" id="J"><i></i><span>Loading\u2026</span></div>
<div class="x">
<header class="h"><div class="hi"><div class="l">${esc(d.siteName)}</div><nav class="n">${d.navLinks.map(l => `<a href="#">${esc(l)}</a>`).join('')}</nav></div></header>
<main class="m"><h1>${esc(d.heroTitle)}</h1><p>${esc(d.heroText)}</p></main>
<section class="g">${d.cards.map(c => `<div class="k"><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`).join('')}</section>
<footer class="f">&copy; ${d.footerYear} ${esc(d.siteName)}. All rights reserved.</footer>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// BUILD
// ═══════════════════════════════════════════════════════════════
const encoded = buildRuntimeConfig();
const html = buildHtml(encoded);
const outPath = path.join(__dirname, 'drop.html');
fs.writeFileSync(outPath, html, 'utf8');

const stats = fs.statSync(outPath);
console.log(`\n  Shimbouncer built successfully!`);
console.log(`  Output: ${outPath}`);
console.log(`  Size:   ${(stats.size / 1024).toFixed(1)} KB`);
console.log(`  Config: ${encoded.length} chars (base64)\n`);

// Sanity check: verify no suspicious strings leak in raw HTML
// Uses word-boundary regex to avoid false positives (e.g. "cam" in "clamp")
// twitter:card/twitter:title meta tags are standard OG — excluded from scan
const raw = html.toLowerCase();
const destHost = new URL(CONFIG.destination).hostname.toLowerCase();
const SCAN_WORDS = [
    destHost,
    'onlyfans', 'fansly', 'fanvue', 'manyvids', 'chaturbate',
    'bounce', 'bouncer', 'redirect', 'escape',
    'webview', 'crawler',
    'instagram', 'tiktok', 'facebook',
    'extbrowser', 'intent://',
];
// "twitter" appears in standard twitter:card/twitter:title meta tags,
// so we scan for it separately and exclude those known-safe contexts
const TWITTER_SAFE = /twitter:(card|title|description|image|site|creator)/gi;
const rawNoTwitterMeta = raw.replace(TWITTER_SAFE, '');

const leaks = SCAN_WORDS.filter(w => raw.includes(w.toLowerCase()));
const twitterLeak = rawNoTwitterMeta.includes('twitter');
if (twitterLeak) leaks.push('twitter');

if (leaks.length > 0) {
    console.warn(`  ⚠  WARNING: Suspicious strings found in output:`);
    leaks.forEach(w => console.warn(`     - "${w}"`));
    console.warn('');
} else {
    console.log(`  ✓  Clean output — no suspicious strings detected.`);
    console.log(`     Scanned ${SCAN_WORDS.length + 1} keywords, 0 leaks.\n`);
}
