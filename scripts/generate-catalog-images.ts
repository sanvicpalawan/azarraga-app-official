import fs from "fs";
import path from "path";

const OUT_DIR = path.resolve(process.cwd(), "public/product-images");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function svgWrapper(w: number, h: number, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
  <defs>
    <linearGradient id="glass-blue" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f0f7ff"/>
      <stop offset="100%" stop-color="#bfe0f8"/>
    </linearGradient>
    <linearGradient id="glass-door" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f6f8fa"/>
      <stop offset="100%" stop-color="#dbe3ea"/>
    </linearGradient>
    <linearGradient id="frame-dark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#36393e"/>
      <stop offset="100%" stop-color="#23272a"/>
    </linearGradient>
    <pattern id="mesh" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M 0 0 L 8 8 M 8 0 L 0 8" fill="none" stroke="#60a5fa" stroke-width="0.5" stroke-opacity="0.35"/>
    </pattern>
    <pattern id="mesh-dark" width="6" height="6" patternUnits="userSpaceOnUse">
      <path d="M 0 3 L 6 3 M 3 0 L 3 6" fill="none" stroke="#3b82f6" stroke-width="0.5" stroke-opacity="0.4"/>
    </pattern>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  ${content}
</svg>`;
}

const drawings: Record<string, string> = {
  // 1. 2 Panel Sliding Window
  "2-panel-sliding-window.svg": svgWrapper(400, 260, `
    <g filter="url(#shadow)">
      <!-- Outer Frame -->
      <rect x="24" y="20" width="352" height="220" fill="#2d3748" rx="2"/>
      <rect x="34" y="30" width="332" height="200" fill="#f8fafc"/>
      <!-- Left Sash -->
      <rect x="36" y="32" width="168" height="196" fill="#1a202c" rx="1"/>
      <rect x="44" y="40" width="152" height="180" fill="url(#glass-blue)"/>
      <rect x="186" y="110" width="6" height="40" rx="3" fill="#cbd5e1"/>
      <path d="M 140 130 L 100 130 M 115 120 L 100 130 L 115 140" fill="none" stroke="#0284c7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Right Sash -->
      <rect x="196" y="32" width="168" height="196" fill="#2d3748" rx="1"/>
      <rect x="204" y="40" width="152" height="180" fill="url(#glass-blue)"/>
      <rect x="208" y="110" width="6" height="40" rx="3" fill="#cbd5e1"/>
      <path d="M 260 130 L 300 130 M 285 120 L 300 130 L 285 140" fill="none" stroke="#0284c7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Glass reflection highlights -->
      <path d="M 50 45 L 80 45 L 60 215 L 45 215 Z" fill="#ffffff" opacity="0.35"/>
      <path d="M 210 45 L 240 45 L 220 215 L 205 215 Z" fill="#ffffff" opacity="0.35"/>
    </g>
  `),

  // 2. 3 Panel Sliding Window
  "3-panel-sliding-window.svg": svgWrapper(480, 260, `
    <g filter="url(#shadow)">
      <rect x="20" y="20" width="440" height="220" fill="#2d3748" rx="2"/>
      <rect x="30" y="30" width="420" height="200" fill="#f8fafc"/>
      <!-- Left -->
      <rect x="32" y="32" width="142" height="196" fill="#1a202c"/>
      <rect x="40" y="40" width="126" height="180" fill="url(#glass-blue)"/>
      <path d="M 125 130 L 85 130 M 100 120 L 85 130 L 100 140" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Middle -->
      <rect x="169" y="32" width="142" height="196" fill="#374151"/>
      <rect x="177" y="40" width="126" height="180" fill="url(#glass-blue)"/>
      <path d="M 220 130 L 260 130 M 230 120 L 220 130 L 230 140 M 250 120 L 260 130 L 250 140" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Right -->
      <rect x="306" y="32" width="142" height="196" fill="#1a202c"/>
      <rect x="314" y="40" width="126" height="180" fill="url(#glass-blue)"/>
      <path d="M 355 130 L 395 130 M 380 120 L 395 130 L 380 140" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round"/>
    </g>
  `),

  // 3. 2 Panel Sliding + Net
  "2-panel-sliding-net.svg": svgWrapper(400, 260, `
    <g filter="url(#shadow)">
      <rect x="24" y="20" width="352" height="220" fill="#2d3748" rx="2"/>
      <rect x="36" y="32" width="168" height="196" fill="#1a202c"/>
      <rect x="44" y="40" width="152" height="180" fill="url(#glass-blue)"/>
      <rect x="44" y="40" width="152" height="180" fill="url(#mesh)"/>
      <text x="120" y="135" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0284c7" text-anchor="middle">INSECT SCREEN</text>
      <rect x="196" y="32" width="168" height="196" fill="#2d3748"/>
      <rect x="204" y="40" width="152" height="180" fill="url(#glass-blue)"/>
      <path d="M 260 130 L 300 130 M 285 120 L 300 130 L 285 140" fill="none" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
    </g>
  `),

  // 4. 3 Panel Sliding + Net
  "3-panel-sliding-net.svg": svgWrapper(480, 260, `
    <g filter="url(#shadow)">
      <rect x="20" y="20" width="440" height="220" fill="#2d3748" rx="2"/>
      <rect x="32" y="32" width="142" height="196" fill="#1a202c"/>
      <rect x="40" y="40" width="126" height="180" fill="url(#glass-blue)"/>
      <rect x="40" y="40" width="126" height="180" fill="url(#mesh)"/>
      <text x="103" y="135" font-family="sans-serif" font-size="11" font-weight="bold" fill="#0284c7" text-anchor="middle">NET SCREEN</text>
      <rect x="169" y="32" width="142" height="196" fill="#374151"/>
      <rect x="177" y="40" width="126" height="180" fill="url(#glass-blue)"/>
      <rect x="306" y="32" width="142" height="196" fill="#1a202c"/>
      <rect x="314" y="40" width="126" height="180" fill="url(#glass-blue)"/>
      <path d="M 355 130 L 395 130 M 380 120 L 395 130 L 380 140" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round"/>
    </g>
  `),

  // 5. Awning Window
  "awning-window.svg": svgWrapper(320, 300, `
    <g filter="url(#shadow)">
      <rect x="30" y="20" width="260" height="260" fill="#2d3748" rx="2"/>
      <rect x="44" y="34" width="232" height="232" fill="#1a202c"/>
      <rect x="54" y="44" width="212" height="212" fill="url(#glass-blue)"/>
      <!-- Awning opening dashed lines (hinged at top, opens outward at bottom) -->
      <path d="M 54 44 L 160 256 L 266 44" fill="none" stroke="#0284c7" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round"/>
      <circle cx="160" cy="245" r="5" fill="#e2e8f0"/>
      <rect x="156" y="240" width="8" height="14" rx="2" fill="#94a3b8"/>
    </g>
  `),

  // 6. Jalousie / Louver Window
  "jalousie-window.svg": svgWrapper(320, 320, `
    <g filter="url(#shadow)">
      <rect x="35" y="20" width="250" height="280" fill="#2d3748" rx="2"/>
      <rect x="47" y="32" width="226" height="256" fill="#f8fafc"/>
      <!-- Louver blades with tilted glass effect -->
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `
        <g transform="translate(52, ${40 + i * 35})">
          <rect x="0" y="0" width="216" height="28" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5" rx="1"/>
          <line x1="0" y1="28" x2="216" y2="28" stroke="#334155" stroke-width="2"/>
          <circle cx="10" cy="14" r="3" fill="#64748b"/>
          <circle cx="206" cy="14" r="3" fill="#64748b"/>
        </g>
      `).join("")}
      <rect x="264" y="130" width="6" height="45" rx="2" fill="#0f172a"/>
    </g>
  `),

  // 7. Fixed Window
  "fixed-window.svg": svgWrapper(360, 280, `
    <g filter="url(#shadow)">
      <rect x="30" y="20" width="300" height="240" fill="#2d3748" rx="2"/>
      <rect x="46" y="36" width="268" height="208" fill="url(#glass-blue)"/>
      <path d="M 60 45 L 110 45 L 80 235 L 50 235 Z" fill="#ffffff" opacity="0.4"/>
      <text x="180" y="145" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0284c7" opacity="0.6" text-anchor="middle">FIXED</text>
    </g>
  `),

  // 8. Folding Window
  "folding-window.svg": svgWrapper(440, 260, `
    <g filter="url(#shadow)">
      <rect x="20" y="20" width="400" height="220" fill="#2d3748" rx="2"/>
      ${[0, 1, 2, 3].map((i) => `
        <rect x="${32 + i * 95}" y="32" width="90" height="196" fill="#1a202c" rx="1"/>
        <rect x="${38 + i * 95}" y="38" width="78" height="184" fill="url(#glass-blue)"/>
        <path d="M ${38 + i * 95} 38 L ${70 + i * 95} 130 L ${38 + i * 95} 222" fill="none" stroke="#0284c7" stroke-width="2" stroke-dasharray="4 4"/>
      `).join("")}
    </g>
  `),

  // 9. Bi-Fold Door
  "bi-fold-door.svg": svgWrapper(440, 320, `
    <g filter="url(#shadow)">
      <rect x="20" y="15" width="400" height="290" fill="#2d3748" rx="2"/>
      <rect x="28" y="23" width="384" height="274" fill="#0f172a"/>
      ${[0, 1, 2, 3].map((i) => `
        <rect x="${34 + i * 94}" y="30" width="90" height="260" fill="#334155" rx="1"/>
        <rect x="${42 + i * 94}" y="38" width="74" height="244" fill="url(#glass-door)"/>
        <path d="M ${42 + i * 94} 38 L ${79 + i * 94} 160 L ${42 + i * 94} 282" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="5 5"/>
        <circle cx="${115 + i * 94}" cy="160" r="3" fill="#cbd5e1"/>
      `).join("")}
      <line x1="20" y1="300" x2="420" y2="300" stroke="#94a3b8" stroke-width="5"/>
    </g>
  `),

  // 10. Sliding Door
  "sliding-door.svg": svgWrapper(400, 320, `
    <g filter="url(#shadow)">
      <rect x="20" y="15" width="360" height="290" fill="#2d3748" rx="2"/>
      <!-- Left Door Leaf -->
      <rect x="30" y="25" width="175" height="270" fill="#1a202c" rx="1"/>
      <rect x="42" y="37" width="151" height="246" fill="url(#glass-door)"/>
      <rect x="180" y="140" width="8" height="60" rx="3" fill="#cbd5e1"/>
      <path d="M 140 170 L 90 170 M 110 155 L 90 170 L 110 185" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
      <!-- Right Door Leaf -->
      <rect x="195" y="25" width="175" height="270" fill="#334155" rx="1"/>
      <rect x="207" y="37" width="151" height="246" fill="url(#glass-door)"/>
      <rect x="212" y="140" width="8" height="60" rx="3" fill="#cbd5e1"/>
      <path d="M 255 170 L 305 170 M 285 155 L 305 170 L 285 185" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
      <!-- Bottom Track -->
      <line x1="20" y1="300" x2="380" y2="300" stroke="#64748b" stroke-width="6"/>
    </g>
  `),

  // 11. Casement / Swing Door
  "casement-swing-door.svg": svgWrapper(320, 340, `
    <g filter="url(#shadow)">
      <rect x="30" y="15" width="260" height="310" fill="#2d3748" rx="2"/>
      <rect x="44" y="29" width="232" height="286" fill="#1a202c" rx="1"/>
      <rect x="58" y="43" width="204" height="258" fill="url(#glass-door)"/>
      <!-- Lever handle -->
      <circle cx="70" cy="180" r="5" fill="#f8fafc"/>
      <rect x="66" y="177" width="28" height="6" rx="2" fill="#cbd5e1"/>
      <!-- Swing Arc -->
      <path d="M 262 43 L 58 172 L 262 301" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="6 6"/>
      <!-- Hinges -->
      <rect x="256" y="60" width="6" height="22" rx="1" fill="#94a3b8"/>
      <rect x="256" y="260" width="6" height="22" rx="1" fill="#94a3b8"/>
    </g>
  `),

  // 12. Roll-Up Door
  "roll-up-door.svg": svgWrapper(360, 320, `
    <g filter="url(#shadow)">
      <!-- Top Hood / Roll Drum Box -->
      <rect x="20" y="15" width="320" height="55" fill="#1e293b" rx="3"/>
      <line x1="30" y1="42" x2="330" y2="42" stroke="#475569" stroke-width="2"/>
      <text x="180" y="48" font-family="sans-serif" font-size="11" font-weight="bold" fill="#94a3b8" text-anchor="middle">ROLL-UP HOOD</text>
      <!-- Side Guides -->
      <rect x="20" y="70" width="24" height="235" fill="#334155"/>
      <rect x="316" y="70" width="24" height="235" fill="#334155"/>
      <!-- Curtain Slats -->
      ${Array.from({ length: 14 }).map((_, i) => `
        <rect x="44" y="${70 + i * 16}" width="272" height="14" fill="${i % 2 === 0 ? "#cbd5e1" : "#94a3b8"}" rx="1"/>
      `).join("")}
      <!-- Bottom Bar with Lock -->
      <rect x="38" y="294" width="284" height="15" fill="#0f172a" rx="2"/>
      <circle cx="180" cy="301" r="3" fill="#f8fafc"/>
    </g>
  `),

  // 13. Hanging Door
  "hanging-door.svg": svgWrapper(340, 330, `
    <g filter="url(#shadow)">
      <!-- Top Track Rail -->
      <rect x="15" y="20" width="310" height="16" fill="#0f172a" rx="2"/>
      <!-- Hangers / Rollers -->
      <circle cx="100" cy="28" r="8" fill="#64748b" stroke="#0f172a" stroke-width="2"/>
      <rect x="97" y="28" width="6" height="24" fill="#334155"/>
      <circle cx="240" cy="28" r="8" fill="#64748b" stroke="#0f172a" stroke-width="2"/>
      <rect x="237" y="28" width="6" height="24" fill="#334155"/>
      <!-- Suspended Glass Door Leaf -->
      <rect x="70" y="52" width="200" height="255" fill="#1e293b" rx="2"/>
      <rect x="80" y="62" width="180" height="235" fill="url(#glass-door)"/>
      <rect x="88" y="150" width="6" height="60" rx="3" fill="#cbd5e1"/>
      <!-- Arrow -->
      <path d="M 210 180 L 150 180 M 175 165 L 150 180 L 175 195" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
    </g>
  `),

  // 14. Double Leaf ED Door (Azarraga Signature)
  "double-leaf-ed-door.svg": svgWrapper(420, 330, `
    <g filter="url(#shadow)">
      <!-- Heavy Duty Frame -->
      <rect x="20" y="15" width="380" height="295" fill="#1a202c" rx="2"/>
      <!-- Left Leaf (10mm Frameless/Patch) -->
      <rect x="32" y="27" width="173" height="273" fill="none" stroke="#334155" stroke-width="3"/>
      <rect x="35" y="30" width="167" height="267" fill="url(#glass-door)"/>
      <!-- Top/Bottom Patch fittings -->
      <rect x="35" y="30" width="32" height="14" fill="#94a3b8" rx="2"/>
      <rect x="35" y="283" width="32" height="14" fill="#94a3b8" rx="2"/>
      <!-- Stainless Steel Push/Pull Bar -->
      <rect x="180" y="110" width="8" height="120" rx="4" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5"/>
      <circle cx="184" cy="120" r="2.5" fill="#334155"/>
      <circle cx="184" cy="220" r="2.5" fill="#334155"/>
      
      <!-- Right Leaf -->
      <rect x="215" y="27" width="173" height="273" fill="none" stroke="#334155" stroke-width="3"/>
      <rect x="218" y="30" width="167" height="267" fill="url(#glass-door)"/>
      <!-- Top/Bottom Patch fittings -->
      <rect x="356" y="30" width="32" height="14" fill="#94a3b8" rx="2"/>
      <rect x="356" y="283" width="32" height="14" fill="#94a3b8" rx="2"/>
      <!-- Stainless Steel Push/Pull Bar -->
      <rect x="232" y="110" width="8" height="120" rx="4" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5"/>
      <circle cx="236" cy="120" r="2.5" fill="#334155"/>
      <circle cx="236" cy="220" r="2.5" fill="#334155"/>

      <!-- Floor Closers -->
      <rect x="35" y="300" width="25" height="6" fill="#0f172a"/>
      <rect x="360" y="300" width="25" height="6" fill="#0f172a"/>
    </g>
  `),

  // 15. Single Leaf ED Door
  "single-leaf-ed-door.svg": svgWrapper(300, 330, `
    <g filter="url(#shadow)">
      <rect x="30" y="15" width="240" height="295" fill="#1a202c" rx="2"/>
      <rect x="44" y="27" width="212" height="273" fill="none" stroke="#334155" stroke-width="3"/>
      <rect x="47" y="30" width="206" height="267" fill="url(#glass-door)"/>
      <!-- Patch Fittings -->
      <rect x="47" y="30" width="35" height="14" fill="#94a3b8" rx="2"/>
      <rect x="47" y="283" width="35" height="14" fill="#94a3b8" rx="2"/>
      <!-- Push Bar -->
      <rect x="225" y="110" width="8" height="120" rx="4" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5"/>
      <!-- Swing Arc -->
      <path d="M 250 45 L 82 165 L 250 285" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="5 5"/>
    </g>
  `),

  // 16. Fixed-Sliding Counter Window
  "fixed-sliding-counter-window.svg": svgWrapper(380, 300, `
    <g filter="url(#shadow)">
      <rect x="25" y="20" width="330" height="260" fill="#2d3748" rx="2"/>
      <!-- Fixed Top Transom -->
      <rect x="37" y="30" width="306" height="90" fill="#1e293b"/>
      <rect x="43" y="36" width="294" height="78" fill="url(#glass-blue)"/>
      <text x="190" y="80" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0284c7" opacity="0.7" text-anchor="middle">FIXED TRANSOM</text>
      <!-- Transom Divider -->
      <rect x="25" y="122" width="330" height="10" fill="#0f172a"/>
      <!-- Bottom Sliding Panels -->
      <rect x="37" y="134" width="150" height="136" fill="#1e293b"/>
      <rect x="43" y="140" width="138" height="124" fill="url(#glass-blue)"/>
      <path d="M 130 200 L 90 200 M 105 190 L 90 200 L 105 210" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="193" y="134" width="150" height="136" fill="#334155"/>
      <rect x="199" y="140" width="138" height="124" fill="url(#glass-blue)"/>
      <path d="M 250 200 L 290 200 M 275 190 L 290 200 L 275 210" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round"/>
    </g>
  `),

  // 17. Skylight
  "skylight.svg": svgWrapper(380, 260, `
    <g filter="url(#shadow)">
      <polygon points="50,220 190,35 330,220" fill="#2d3748"/>
      <polygon points="62,215 190,48 318,215" fill="#f8fafc"/>
      <!-- Left Glazed Slope -->
      <polygon points="70,210 185,55 185,210" fill="url(#glass-blue)"/>
      <!-- Right Glazed Slope -->
      <polygon points="195,55 310,210 195,210" fill="url(#glass-blue)"/>
      <!-- Structural Mullions -->
      <line x1="125" y1="135" x2="185" y2="135" stroke="#1e293b" stroke-width="4"/>
      <line x1="195" y1="135" x2="255" y2="135" stroke="#1e293b" stroke-width="4"/>
      <line x1="190" y1="40" x2="190" y2="215" stroke="#0f172a" stroke-width="6"/>
    </g>
  `),

  // 18. Glass Railings
  "glass-railings.svg": svgWrapper(420, 260, `
    <g filter="url(#shadow)">
      <!-- Stainless Steel Top Rail -->
      <rect x="20" y="35" width="380" height="12" fill="#cbd5e1" stroke="#64748b" stroke-width="1" rx="2"/>
      <!-- Glass Panels -->
      ${[0, 1, 2].map((i) => `
        <rect x="${35 + i * 122}" y="55" width="108" height="145" fill="url(#glass-blue)" stroke="#94a3b8" stroke-width="1.5" rx="2"/>
        <!-- Stainless Standoffs / Spigots -->
        <rect x="${45 + i * 122}" y="205" width="16" height="30" fill="#64748b" rx="2"/>
        <rect x="${115 + i * 122}" y="205" width="16" height="30" fill="#64748b" rx="2"/>
      `).join("")}
      <!-- Base Slab -->
      <rect x="20" y="235" width="380" height="14" fill="#475569" rx="1"/>
    </g>
  `),

  // 19. Slide Up (Vertical Sliding / Guillotine)
  "slide-up.svg": svgWrapper(300, 320, `
    <g filter="url(#shadow)">
      <rect x="35" y="20" width="230" height="280" fill="#2d3748" rx="2"/>
      <!-- Top Fixed/Upper Sash -->
      <rect x="47" y="32" width="206" height="120" fill="#1a202c"/>
      <rect x="55" y="40" width="190" height="104" fill="url(#glass-blue)"/>
      <!-- Bottom Sliding Sash (slides UP) -->
      <rect x="47" y="158" width="206" height="130" fill="#334155"/>
      <rect x="55" y="166" width="190" height="114" fill="url(#glass-blue)"/>
      <path d="M 150 240 L 150 190 M 135 210 L 150 190 L 165 210" fill="none" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
      <rect x="135" y="265" width="30" height="6" rx="2" fill="#f8fafc"/>
    </g>
  `),

  // 20. Canopy
  "canopy.svg": svgWrapper(380, 260, `
    <g filter="url(#shadow)">
      <!-- Wall Plate -->
      <rect x="30" y="20" width="20" height="220" fill="#334155"/>
      <!-- Glass Cantilever Panel -->
      <polygon points="50,140 330,165 320,185 50,155" fill="url(#glass-blue)" stroke="#0284c7" stroke-width="2"/>
      <!-- Tension Tie Rods -->
      <line x1="50" y1="45" x2="280" y2="160" stroke="#0f172a" stroke-width="3"/>
      <circle cx="50" cy="45" r="4" fill="#64748b"/>
      <circle cx="280" cy="160" r="4" fill="#64748b"/>
    </g>
  `),

  // 21. Sunroom
  "sunroom.svg": svgWrapper(400, 280, `
    <g filter="url(#shadow)">
      <polygon points="30,240 30,120 180,60 370,100 370,240" fill="#2d3748"/>
      <!-- Roof Glass Panels -->
      <polygon points="40,115 175,68 175,120 40,135" fill="url(#glass-blue)"/>
      <polygon points="185,68 360,105 360,125 185,120" fill="url(#glass-blue)"/>
      <!-- Front Glass Windows -->
      <rect x="40" y="145" width="95" height="85" fill="url(#glass-blue)"/>
      <rect x="145" y="145" width="105" height="85" fill="url(#glass-blue)"/>
      <rect x="260" y="145" width="100" height="85" fill="url(#glass-blue)"/>
    </g>
  `),

  // 22. Stainless Steel Works
  "stainless-steel-works.svg": svgWrapper(360, 260, `
    <g filter="url(#shadow)">
      <rect x="40" y="30" width="280" height="200" fill="none" stroke="#94a3b8" stroke-width="12" rx="4"/>
      <line x1="40" y1="130" x2="320" y2="130" stroke="#94a3b8" stroke-width="10"/>
      <line x1="180" y1="30" x2="180" y2="230" stroke="#94a3b8" stroke-width="10"/>
      <rect x="65" y="55" width="90" height="50" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="205" y="55" width="90" height="50" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="65" y="155" width="90" height="50" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="205" y="155" width="90" height="50" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
    </g>
  `),

  // 23. ACP Cladding
  "acp-cladding.svg": svgWrapper(380, 260, `
    <g filter="url(#shadow)">
      <rect x="30" y="25" width="320" height="210" fill="#0f172a" rx="2"/>
      ${[0, 1].map((r) => [0, 1, 2].map((c) => `
        <rect x="${36 + c * 105}" y="${31 + r * 102}" width="100" height="97" fill="#475569" stroke="#94a3b8" stroke-width="2" rx="1"/>
        <circle cx="${45 + c * 105}" cy="${40 + r * 102}" r="2" fill="#cbd5e1"/>
        <circle cx="${127 + c * 105}" cy="${40 + r * 102}" r="2" fill="#cbd5e1"/>
        <circle cx="${45 + c * 105}" cy="${119 + r * 102}" r="2" fill="#cbd5e1"/>
        <circle cx="${127 + c * 105}" cy="${119 + r * 102}" r="2" fill="#cbd5e1"/>
      `).join("")).join("")}
    </g>
  `),

  // 24. Mullion
  "mullion.svg": svgWrapper(300, 300, `
    <g filter="url(#shadow)">
      <!-- Heavy vertical structural mullion I-beam / tubular -->
      <rect x="120" y="20" width="60" height="260" fill="#1e293b" rx="2"/>
      <rect x="135" y="20" width="30" height="260" fill="#334155"/>
      <!-- Glass held on both sides -->
      <rect x="30" y="40" width="85" height="220" fill="url(#glass-blue)"/>
      <rect x="185" y="40" width="85" height="220" fill="url(#glass-blue)"/>
      <!-- Pressure plates and caps -->
      <rect x="115" y="70" width="70" height="8" fill="#cbd5e1"/>
      <rect x="115" y="150" width="70" height="8" fill="#cbd5e1"/>
      <rect x="115" y="230" width="70" height="8" fill="#cbd5e1"/>
    </g>
  `),

  // 25. Glass Shelves
  "glass-shelves.svg": svgWrapper(360, 260, `
    <g filter="url(#shadow)">
      ${[0, 1, 2].map((i) => `
        <g transform="translate(40, ${45 + i * 65})">
          <!-- Brackets -->
          <rect x="40" y="12" width="24" height="22" fill="#475569" rx="2"/>
          <rect x="216" y="12" width="24" height="22" fill="#475569" rx="2"/>
          <!-- Thick Tempered Shelf -->
          <rect x="0" y="0" width="280" height="14" fill="url(#glass-blue)" stroke="#0284c7" stroke-width="1.5" rx="2"/>
        </g>
      `).join("")}
    </g>
  `),

  // 26. Table Top Glass
  "table-top-glass.svg": svgWrapper(360, 260, `
    <g filter="url(#shadow)">
      <!-- Oval/Rect Tabletop with beveled edge -->
      <rect x="35" y="45" width="290" height="170" rx="30" fill="none" stroke="#94a3b8" stroke-width="8"/>
      <rect x="42" y="52" width="276" height="156" rx="24" fill="url(#glass-blue)" stroke="#0284c7" stroke-width="2"/>
      <!-- Bevel Reflection -->
      <path d="M 60 70 L 140 70 L 90 190 L 50 190 Z" fill="#ffffff" opacity="0.45"/>
    </g>
  `),

  // 27. Cabinets
  "cabinets.svg": svgWrapper(360, 280, `
    <g filter="url(#shadow)">
      <rect x="30" y="25" width="300" height="230" fill="#1e293b" rx="3"/>
      <!-- Top display shelf -->
      <rect x="42" y="37" width="134" height="96" fill="url(#glass-blue)"/>
      <rect x="184" y="37" width="134" height="96" fill="url(#glass-blue)"/>
      <!-- Bottom shelf -->
      <rect x="42" y="145" width="134" height="96" fill="url(#glass-blue)"/>
      <rect x="184" y="145" width="134" height="96" fill="url(#glass-blue)"/>
      <!-- Sliding Track -->
      <line x1="30" y1="139" x2="330" y2="139" stroke="#cbd5e1" stroke-width="4"/>
    </g>
  `),

  // 28. Tara Louver Window (Owner invoice drawing)
  "tara-louver-window.svg": svgWrapper(340, 320, `
    <g filter="url(#shadow)">
      <rect x="25" y="15" width="290" height="290" fill="#2d3748" rx="2"/>
      <rect x="35" y="25" width="270" height="270" fill="#f8fafc"/>
      <!-- Center Mullion dividing two louver bays -->
      <rect x="165" y="25" width="10" height="270" fill="#334155"/>
      <!-- Bay 1 (Left) Louvers -->
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `
        <g transform="translate(42, ${35 + i * 35})">
          <rect x="0" y="0" width="118" height="26" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5" rx="1"/>
          <line x1="0" y1="26" x2="118" y2="26" stroke="#475569" stroke-width="2"/>
        </g>
      `).join("")}
      <!-- Bay 2 (Right) Louvers -->
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `
        <g transform="translate(180, ${35 + i * 35})">
          <rect x="0" y="0" width="118" height="26" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5" rx="1"/>
          <line x1="0" y1="26" x2="118" y2="26" stroke="#475569" stroke-width="2"/>
        </g>
      `).join("")}
      <!-- Louver operator lever -->
      <rect x="298" y="140" width="5" height="40" rx="2" fill="#0f172a"/>
    </g>
  `),

  // 29. Abin Sliding Window (Owner invoice drawing)
  "abin-sliding-window.svg": svgWrapper(420, 260, `
    <g filter="url(#shadow)">
      <rect x="20" y="20" width="380" height="220" fill="#2d3748" rx="2"/>
      <rect x="30" y="30" width="360" height="200" fill="#f8fafc"/>
      <!-- Heavy duty tubular frame -->
      <rect x="35" y="35" width="170" height="190" fill="#1e293b"/>
      <rect x="43" y="43" width="154" height="174" fill="url(#glass-blue)"/>
      <path d="M 140 130 L 95 130 M 110 115 L 95 130 L 110 145" fill="none" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
      <rect x="215" y="35" width="170" height="190" fill="#334155"/>
      <rect x="223" y="43" width="154" height="174" fill="url(#glass-blue)"/>
      <path d="M 270 130 L 315 130 M 300 115 L 315 130 L 300 145" fill="none" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
      <rect x="195" y="110" width="8" height="40" rx="3" fill="#cbd5e1"/>
    </g>
  `),

  // 30. Pajara ED Door (Owner invoice drawing)
  "pajara-ed-door.svg": svgWrapper(420, 340, `
    <g filter="url(#shadow)">
      <rect x="15" y="15" width="390" height="310" fill="#1a202c" rx="2"/>
      <!-- Top transom panel -->
      <rect x="25" y="25" width="370" height="60" fill="url(#glass-door)" stroke="#334155" stroke-width="2"/>
      <text x="210" y="60" font-family="sans-serif" font-size="11" font-weight="bold" fill="#64748b" text-anchor="middle">TRANSOM 10mm ANNEALED</text>
      <!-- Double Doors below -->
      <rect x="25" y="92" width="180" height="223" fill="url(#glass-door)" stroke="#334155" stroke-width="2"/>
      <rect x="215" y="92" width="180" height="223" fill="url(#glass-door)" stroke="#334155" stroke-width="2"/>
      <!-- Stainless steel push handles -->
      <rect x="185" y="160" width="8" height="90" rx="4" fill="#e2e8f0" stroke="#475569" stroke-width="1"/>
      <rect x="227" y="160" width="8" height="90" rx="4" fill="#e2e8f0" stroke="#475569" stroke-width="1"/>
    </g>
  `),

  // 31. Ranchero Bi-Fold Door (Owner invoice drawing)
  "ranchero-bifold-door.svg": svgWrapper(440, 320, `
    <g filter="url(#shadow)">
      <rect x="15" y="15" width="410" height="290" fill="#2d3748" rx="2"/>
      ${[0, 1, 2, 3].map((i) => `
        <rect x="${25 + i * 98}" y="25" width="94" height="265" fill="#1e293b" rx="1"/>
        <rect x="${32 + i * 98}" y="32" width="80" height="251" fill="url(#glass-blue)"/>
        <path d="M ${32 + i * 98} 32 L ${72 + i * 98} 157 L ${32 + i * 98} 283" fill="none" stroke="#0284c7" stroke-width="2" stroke-dasharray="5 5"/>
      `).join("")}
      <line x1="15" y1="300" x2="425" y2="300" stroke="#cbd5e1" stroke-width="6"/>
    </g>
  `),

  // 32. Joriz Awning Window (Owner invoice drawing)
  "joriz-awning-window.svg": svgWrapper(340, 320, `
    <g filter="url(#shadow)">
      <rect x="25" y="20" width="290" height="280" fill="#2d3748" rx="2"/>
      <!-- 3 Tier Awning -->
      ${[0, 1, 2].map((i) => `
        <rect x="${35}" y="${30 + i * 88}" width="270" height="80" fill="#1e293b"/>
        <rect x="${42}" y="${37 + i * 88}" width="256" height="66" fill="url(#glass-blue)"/>
        <path d="M 42 ${37 + i * 88} L 170 ${103 + i * 88} L 298 ${37 + i * 88}" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-dasharray="6 4"/>
      `).join("")}
    </g>
  `),
};

for (const [filename, content] of Object.entries(drawings)) {
  fs.writeFileSync(path.join(OUT_DIR, filename), content.trim());
  console.log("Wrote", filename);
}
console.log("Done generating all catalog SVG product diagrams.");
