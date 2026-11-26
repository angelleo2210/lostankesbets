#!/usr/bin/env python3
"""Generate the bundled avatar SVGs (public/img/avatars/gen) and public/avatar-catalog.js.
Brand paths come from simple-icons (CC0-1.0, v16.38.1) saved in tools/simple-icons-brands.json;
trademarks belong to their owners. They are user-picked avatars only, never LosTankesBets branding."""
import json, math, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/img/avatars/gen'); os.makedirs(OUT, exist_ok=True)
CAT = []  # (group, id, label)

def tile(art, w, h, bg=('#1e293b', '#0b1220'), border='#334155'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f'<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{bg[0]}"/><stop offset="1" stop-color="{bg[1]}"/></linearGradient></defs>'
            f'<rect x="2" y="2" width="{w-4}" height="{h-4}" rx="14" fill="url(#bg)" stroke="{border}" stroke-width="3"/>{art}</svg>')

def emit(group, id_, label, art_fn, bg=('#1e293b', '#0b1220'), border='#334155'):
    """art_fn(size) -> svg markup for a square art box of `size` at origin."""
    for name, w, h in ((id_, 240, 320), (id_ + '_head', 240, 240)):
        s = 200 if h == 320 else 196
        x, y = (w - s) / 2, (h - s) / 2
        art = f'<g transform="translate({x:.1f},{y:.1f})">{art_fn(s)}</g>'
        open(os.path.join(OUT, name + '.svg'), 'w').write(tile(art, w, h, bg, border))
    CAT.append((group, id_, label))

def sc(s, inner, vb=200):
    return f'<g transform="scale({s/vb:.4f})">{inner}</g>'

# ---------- Caricaturas ----------
SK = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#5c3a1e']
def face(skin, hair, hc, shirt, acc=(), bgc='#1e3a5f'):
    p = [f'<rect x="0" y="0" width="200" height="200" rx="12" fill="{bgc}" opacity=".55"/>']
    p.append(f'<path d="M30 200 Q32 150 100 145 Q168 150 170 200Z" fill="{shirt}"/>')
    p.append(f'<rect x="86" y="120" width="28" height="32" rx="8" fill="{skin}"/>')
    if hair == 'long': p.append(f'<path d="M48 90 Q44 30 100 28 Q156 30 152 90 L158 150 Q130 140 128 110 L72 110 Q70 140 42 150Z" fill="{hc}"/>')
    p.append(f'<ellipse cx="52" cy="92" rx="9" ry="13" fill="{skin}"/><ellipse cx="148" cy="92" rx="9" ry="13" fill="{skin}"/>')
    p.append(f'<ellipse cx="100" cy="88" rx="48" ry="54" fill="{skin}"/>')
    if 'beard' in acc: p.append(f'<path d="M54 92 Q56 140 100 146 Q144 140 146 92 Q140 120 122 118 Q100 110 78 118 Q60 120 54 92Z" fill="{hc}"/>')
    hairs = {
        'short': f'<path d="M52 82 Q50 34 100 32 Q150 34 148 82 Q140 56 100 54 Q60 56 52 82Z" fill="{hc}"/>',
        'curly': ''.join(f'<circle cx="{60+i*16}" cy="{48 - 10*math.sin(i/5*math.pi)}" r="15" fill="{hc}"/>' for i in range(6)) + f'<circle cx="52" cy="70" r="11" fill="{hc}"/><circle cx="148" cy="70" r="11" fill="{hc}"/>',
        'buzz': f'<path d="M54 78 Q54 38 100 36 Q146 38 146 78 Q130 60 100 58 Q70 60 54 78Z" fill="{hc}" opacity=".75"/>',
        'long': f'<path d="M52 84 Q50 32 100 30 Q150 32 148 84 Q130 50 100 52 Q70 50 52 84Z" fill="{hc}"/>',
        'bun': f'<circle cx="100" cy="26" r="18" fill="{hc}"/><path d="M52 82 Q50 36 100 36 Q150 36 148 82 Q136 56 100 56 Q64 56 52 82Z" fill="{hc}"/>',
        'mohawk': f'<path d="M86 60 Q84 18 100 10 Q116 18 114 60Z" fill="{hc}"/><path d="M56 76 Q58 52 86 50 L86 60 Q66 62 56 76Z M144 76 Q142 52 114 50 L114 60 Q134 62 144 76Z" fill="{hc}" opacity=".45"/>',
        'bald': '',
    }
    p.append(hairs[hair])
    p.append('<ellipse cx="82" cy="92" rx="6" ry="7" fill="#1f2937"/><ellipse cx="118" cy="92" rx="6" ry="7" fill="#1f2937"/><circle cx="84" cy="90" r="2" fill="#fff"/><circle cx="120" cy="90" r="2" fill="#fff"/>')
    p.append(f'<path d="M72 78 Q82 72 92 78" stroke="{hc if hair!="bald" else "#3f3f46"}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M108 78 Q118 72 128 78" stroke="{hc if hair!="bald" else "#3f3f46"}" stroke-width="4" fill="none" stroke-linecap="round"/>')
    p.append('<path d="M98 98 Q100 108 104 104" stroke="#00000040" stroke-width="3" fill="none" stroke-linecap="round"/>')
    p.append('<path d="M82 116 Q100 132 118 116" stroke="#7f1d1d" stroke-width="4" fill="#fff" stroke-linejoin="round"/>')
    if 'glasses' in acc: p.append('<g fill="none" stroke="#111827" stroke-width="4"><rect x="66" y="80" width="30" height="24" rx="6"/><rect x="104" y="80" width="30" height="24" rx="6"/><path d="M96 90h8M66 88l-14-4M134 88l14-4"/></g>')
    if 'shades' in acc: p.append('<g fill="#0f172a" stroke="#0f172a" stroke-width="3"><path d="M62 82h34v10q-2 14-17 14t-17-14z"/><path d="M104 82h34v10q-2 14-17 14t-17-14z"/><path d="M96 86h8" /></g><path d="M68 87h10" stroke="#ffffff55" stroke-width="3"/>')
    if 'cap' in acc: p.append(f'<path d="M50 70 Q52 26 100 26 Q148 26 150 70Z" fill="{acc[-1] if acc[-1].startswith("#") else "#dc2626"}"/><path d="M100 64 Q150 62 176 74 Q150 80 100 72Z" fill="#111827" opacity=".85"/>')
    if 'earring' in acc: p.append('<circle cx="146" cy="108" r="4" fill="#e5e7eb" stroke="#94a3b8"/>')
    if 'headband' in acc: p.append('<rect x="52" y="58" width="96" height="12" rx="6" fill="#22c55e"/>')
    if 'chain' in acc: p.append('<path d="M74 150 Q100 176 126 150" stroke="#facc15" stroke-width="5" fill="none"/>')
    return ''.join(p)
FACES = [
    ('Rizos', SK[2], 'curly', '#111827', '#e2e8f0', ('earring', 'chain')),
    ('Gorra', SK[0], 'short', '#3f2a1d', '#1d4ed8', ('cap', '#dc2626')),
    ('Lentes', SK[1], 'short', '#1f2937', '#0f766e', ('glasses',)),
    ('Barba', SK[3], 'buzz', '#111827', '#7c2d12', ('beard',)),
    ('Melena', SK[4], 'long', '#78350f', '#be185d', ('earring',)),
    ('Moño', SK[2], 'bun', '#111827', '#6d28d9', ()),
    ('Cresta', SK[0], 'mohawk', '#dc2626', '#111827', ('chain',)),
    ('Gafas de sol', SK[5], 'bald', '#111827', '#334155', ('shades', 'beard')),
    ('Atleta', SK[3], 'curly', '#0b0b0b', '#16a34a', ('headband',)),
    ('Rubio', SK[4], 'short', '#facc15', '#0369a1', ('shades',)),
    ('Pelirroja', SK[4], 'long', '#c2410c', '#15803d', ('glasses',)),
    ('Gorra azul', SK[1], 'buzz', '#111827', '#f59e0b', ('cap', '#1d4ed8')),
]
for i, (lab, sk, hr, hc, sh, acc) in enumerate(FACES, 1):
    emit('caricaturas', f'face-{i}', lab, lambda s, a=(sk, hr, hc, sh, acc): sc(s, face(*a)))

# ---------- Deportes ----------
def star(cx, cy, r, fill, rot=-90, inner=.382):
    pts = []
    for k in range(10):
        rr = r if k % 2 == 0 else r * inner
        a = math.radians(rot + k * 36)
        pts.append(f'{cx + rr*math.cos(a):.2f},{cy + rr*math.sin(a):.2f}')
    return f'<polygon points="{" ".join(pts)}" fill="{fill}"/>'
def soccer():
    pent = lambda cx, cy, r, rot=-90: '<polygon points="' + ' '.join(f'{cx+r*math.cos(math.radians(rot+k*72)):.1f},{cy+r*math.sin(math.radians(rot+k*72)):.1f}' for k in range(5)) + '" fill="#111827"/>'
    s = '<circle cx="100" cy="100" r="74" fill="#f8fafc" stroke="#111827" stroke-width="4"/>' + pent(100, 100, 24)
    for k in range(5):
        a = math.radians(-90 + k * 72); x, y = 100 + 58*math.cos(a), 100 + 58*math.sin(a)
        s += f'<line x1="{100+24*math.cos(a):.1f}" y1="{100+24*math.sin(a):.1f}" x2="{x:.1f}" y2="{y:.1f}" stroke="#111827" stroke-width="3"/>' + pent(x, y, 15, -90 + k*72 + 180)
    return f'<g clip-path="url(#cb)"><defs><clipPath id="cb"><circle cx="100" cy="100" r="74"/></clipPath></defs>{s}</g><circle cx="100" cy="100" r="74" fill="none" stroke="#111827" stroke-width="4"/>'
SPORTS = {
    'futbol': ('Fútbol', soccer()),
    'basket': ('Básquet', '<circle cx="100" cy="100" r="74" fill="#f97316" stroke="#7c2d12" stroke-width="4"/><g fill="none" stroke="#7c2d12" stroke-width="4"><path d="M26 100h148M100 26v148"/><path d="M48 46q30 54 0 108M152 46q-30 54 0 108"/></g>'),
    'beisbol': ('Béisbol', '<circle cx="100" cy="100" r="74" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/><g fill="none" stroke="#dc2626" stroke-width="4"><path d="M56 44q34 56 0 112M144 44q-34 56 0 112"/></g><g stroke="#dc2626" stroke-width="3">' + ''.join(f'<path d="M{60+12*math.sin((y-44)/112*math.pi)-6} {y}l10 -4M{140-12*math.sin((y-44)/112*math.pi)-4} {y-4}l10 4"/>' for y in range(56, 150, 14)) + '</g>'),
    'americano': ('Fútbol americano', '<g transform="rotate(-35 100 100)"><ellipse cx="100" cy="100" rx="82" ry="48" fill="#92400e" stroke="#451a03" stroke-width="4"/><path d="M36 76q6 24 0 48M164 76q-6 24 0 48" stroke="#f8fafc" stroke-width="6" fill="none"/><path d="M72 100h56" stroke="#f8fafc" stroke-width="5"/>' + ''.join(f'<path d="M{x} 92v16" stroke="#f8fafc" stroke-width="4"/>' for x in range(78, 126, 10)) + '</g>'),
    'boxeo': ('Boxeo', '<path d="M62 150 L60 92 Q58 44 104 40 Q150 38 150 84 L150 112 Q150 134 126 140 L126 150Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="4"/><path d="M60 92 Q40 96 44 122 Q48 140 66 134" fill="#ef4444" stroke="#7f1d1d" stroke-width="4"/><rect x="56" y="148" width="76" height="26" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="3"/><path d="M90 60q30-10 44 10" stroke="#fca5a5" stroke-width="6" fill="none" stroke-linecap="round"/>'),
    'tenis': ('Tenis', '<circle cx="100" cy="100" r="70" fill="#d9f99d" stroke="#65a30d" stroke-width="4"/><g fill="none" stroke="#f8fafc" stroke-width="7"><path d="M40 62q40 38 0 76"/><path d="M160 62q-40 38 0 76"/></g>'),
    'hockey': ('Hockey', '<g stroke-linecap="round"><path d="M52 30 L100 140 L150 140" stroke="#a16207" stroke-width="12" fill="none"/><path d="M148 30 L100 140 L50 140" stroke="#f8fafc" stroke-width="12" fill="none"/></g><ellipse cx="100" cy="166" rx="30" ry="10" fill="#111827"/><rect x="70" y="156" width="60" height="10" fill="#111827"/><ellipse cx="100" cy="156" rx="30" ry="10" fill="#334155"/>'),
    'golf': ('Golf', '<rect x="96" y="128" width="8" height="46" fill="#e2e8f0"/><path d="M80 128h40l-12 10h-16z" fill="#e2e8f0"/><circle cx="100" cy="90" r="40" fill="#f8fafc" stroke="#94a3b8" stroke-width="3"/>' + ''.join(f'<circle cx="{100+dx}" cy="{90+dy}" r="3" fill="#cbd5e1"/>' for dx in (-18, 0, 18) for dy in (-18, 0, 18))),
    'carreras': ('Carreras', '<rect x="40" y="30" width="6" height="150" rx="3" fill="#cbd5e1"/>' + ''.join(f'<rect x="{46+c*22}" y="{34+r*22}" width="22" height="22" fill="{"#f8fafc" if (r+c)%2==0 else "#111827"}"/>' for r in range(5) for c in range(5)) + '<rect x="46" y="34" width="110" height="110" fill="none" stroke="#94a3b8" stroke-width="2"/>'),
    'trofeo': ('Trofeo', '<path d="M60 36h80v30q0 46-40 52q-40-6-40-52z" fill="#facc15" stroke="#a16207" stroke-width="4"/><path d="M60 46H38q0 34 26 40M140 46h22q0 34-26 40" fill="none" stroke="#a16207" stroke-width="6"/><rect x="90" y="118" width="20" height="26" fill="#eab308"/><rect x="64" y="144" width="72" height="22" rx="4" fill="#78350f"/>' + star(100, 72, 18, '#fef9c3')),
    'voleibol': ('Voleibol', '<circle cx="100" cy="100" r="74" fill="#f8fafc" stroke="#1e3a8a" stroke-width="4"/><g fill="none" stroke="#1d4ed8" stroke-width="5"><path d="M100 26q-14 50 20 74q40 24 52 2"/><path d="M100 100q-44 10-64 50"/><path d="M100 100q-40-20-60-60"/></g><path d="M100 26q30 30 30 74" stroke="#facc15" stroke-width="5" fill="none"/>'),
    'dados': ('Dados', '<rect x="34" y="62" width="78" height="78" rx="14" fill="#f8fafc" stroke="#94a3b8" stroke-width="3" transform="rotate(-12 73 101)"/><rect x="92" y="54" width="78" height="78" rx="14" fill="#dc2626" stroke="#7f1d1d" stroke-width="3" transform="rotate(14 131 93)"/>' + ''.join(f'<circle cx="{x}" cy="{y}" r="7" fill="#111827"/>' for x, y in ((58, 86), (73, 101), (88, 116))) + ''.join(f'<circle cx="{x}" cy="{y}" r="7" fill="#f8fafc"/>' for x, y in ((116, 74), (146, 82), (116, 104), (146, 112)))),
}
for k, (lab, art) in SPORTS.items():
    emit('deportes', f'sport-{k}', lab, lambda s, a=art: sc(s, a))

# ---------- Animales ----------
def eyes(y=96, dx=22, r=7, c='#111827'):
    return f'<circle cx="{100-dx}" cy="{y}" r="{r}" fill="{c}"/><circle cx="{100+dx}" cy="{y}" r="{r}" fill="{c}"/><circle cx="{102-dx}" cy="{y-2}" r="2.2" fill="#fff"/><circle cx="{102+dx}" cy="{y-2}" r="2.2" fill="#fff"/>'
ANIMALS = {
    'leon': ('León', ''.join(f'<circle cx="{100+62*math.cos(a*math.pi/6):.1f}" cy="{100+62*math.sin(a*math.pi/6):.1f}" r="26" fill="#b45309"/>' for a in range(12)) + '<circle cx="100" cy="100" r="62" fill="#c2410c"/><circle cx="100" cy="104" r="48" fill="#f59e0b"/>' + eyes(94) + '<path d="M90 114h20l-10 10z" fill="#451a03"/><path d="M100 124v8M100 132q-10 8-18 2M100 132q10 8 18 2" stroke="#451a03" stroke-width="3" fill="none"/>'),
    'tigre': ('Tigre', '<circle cx="56" cy="52" r="18" fill="#ea580c"/><circle cx="144" cy="52" r="18" fill="#ea580c"/><circle cx="56" cy="52" r="8" fill="#fde68a"/><circle cx="144" cy="52" r="8" fill="#fde68a"/><circle cx="100" cy="104" r="62" fill="#f97316"/><ellipse cx="100" cy="128" rx="34" ry="26" fill="#fff7ed"/><g fill="#111827"><path d="M100 42l-8 22h16z"/><path d="M40 96l26 4-24 10zM160 96l-26 4 24 10zM44 124l22-6-18 16zM156 124l-22-6 18 16z"/><path d="M76 52l8 18-14-8zM124 52l-8 18 14-8z"/></g>' + eyes(96, 24, 7, '#166534') + '<path d="M92 116h16l-8 9z" fill="#be185d"/><path d="M100 125q-8 8-16 3M100 125q8 8 16 3" stroke="#111827" stroke-width="3" fill="none"/>'),
    'lobo': ('Lobo', '<path d="M48 30l30 40-36 16zM152 30l-30 40 36 16z" fill="#64748b"/><path d="M44 78q0-40 56-44q56 4 56 44l-8 50q-16 36-48 42q-32-6-48-42z" fill="#94a3b8"/><path d="M70 116q30-14 60 0l-6 40q-24 14-48 0z" fill="#f1f5f9"/>' + eyes(98, 24, 7, '#ca8a04') + '<ellipse cx="100" cy="136" rx="12" ry="9" fill="#111827"/>'),
    'zorro': ('Zorro', '<path d="M44 26l36 46-40 20zM156 26l-36 46 40 20z" fill="#ea580c"/><path d="M40 84q4-44 60-46q56 2 60 46q-10 50-60 86q-50-36-60-86z" fill="#f97316"/><path d="M40 84q30 10 46 50l14 36q-50-36-60-86zM160 84q-30 10-46 50l-14 36q50-36 60-86z" fill="#fff7ed"/>' + eyes(100, 26, 6) + '<circle cx="100" cy="160" r="8" fill="#111827"/>'),
    'oso': ('Oso', '<circle cx="52" cy="52" r="22" fill="#78350f"/><circle cx="148" cy="52" r="22" fill="#78350f"/><circle cx="52" cy="52" r="10" fill="#a16207"/><circle cx="148" cy="52" r="10" fill="#a16207"/><circle cx="100" cy="104" r="64" fill="#92400e"/><ellipse cx="100" cy="130" rx="30" ry="24" fill="#d6a46c"/>' + eyes(94) + '<ellipse cx="100" cy="120" rx="12" ry="8" fill="#1c1917"/><path d="M100 128v8q-8 8-14 2M100 136q8 8 14 2" stroke="#1c1917" stroke-width="3" fill="none"/>'),
    'panda': ('Panda', '<circle cx="50" cy="50" r="22" fill="#111827"/><circle cx="150" cy="50" r="22" fill="#111827"/><circle cx="100" cy="104" r="64" fill="#f8fafc"/><ellipse cx="74" cy="98" rx="16" ry="20" fill="#111827" transform="rotate(-20 74 98)"/><ellipse cx="126" cy="98" rx="16" ry="20" fill="#111827" transform="rotate(20 126 98)"/><circle cx="76" cy="96" r="5" fill="#fff"/><circle cx="124" cy="96" r="5" fill="#fff"/><ellipse cx="100" cy="128" rx="11" ry="8" fill="#111827"/><path d="M100 136q-8 8-14 2M100 136q8 8 14 2" stroke="#111827" stroke-width="3" fill="none"/>'),
    'aguila': ('Águila', '<path d="M40 150q10-90 60-110q50 10 60 70q-20-10-40-6z" fill="#f8fafc"/><path d="M40 150q20 20 70 30l50-70q-30 0-56 10z" fill="#78350f"/><path d="M118 92q40-4 56 20q-20 2-26 18q-10-20-30-20z" fill="#facc15" stroke="#a16207" stroke-width="3"/><circle cx="116" cy="80" r="8" fill="#111827"/><circle cx="118" cy="78" r="2.5" fill="#fff"/><path d="M100 70q16-8 30 2" stroke="#334155" stroke-width="5" fill="none"/>'),
    'tiburon': ('Tiburón', '<path d="M100 20l24 48h-48z" fill="#475569"/><ellipse cx="100" cy="112" rx="72" ry="58" fill="#64748b"/><path d="M38 124q62 46 124 0q-10 38-62 44q-52-6-62-44z" fill="#f1f5f9"/><path d="M62 132l8 10 8-10 8 10 8-10 8 10 8-10 8 10 8-10 8 10 8-10" stroke="#f8fafc" fill="#fff" stroke-width="2"/><path d="M58 136q42 16 84 0" stroke="#7f1d1d" stroke-width="4" fill="none"/>' + eyes(100, 34, 7)),
    'toro': ('Toro', '<path d="M54 70q-40-6-36-48q16 26 46 30zM146 70q40-6 36-48q-16 26-46 30z" fill="#f5f5f4"/><ellipse cx="100" cy="100" rx="58" ry="62" fill="#44403c"/><ellipse cx="44" cy="80" rx="18" ry="10" fill="#57534e"/><ellipse cx="156" cy="80" rx="18" ry="10" fill="#57534e"/><ellipse cx="100" cy="138" rx="38" ry="26" fill="#a8a29e"/><circle cx="86" cy="140" r="6" fill="#292524"/><circle cx="114" cy="140" r="6" fill="#292524"/><path d="M84 156q16 10 32 0" stroke="#facc15" stroke-width="5" fill="none"/>' + eyes(96, 26, 7, '#dc2626')),
    'cabra': ('Cabra (GOAT)', '<path d="M70 54q-20-40 10-46q-10 16 6 40zM130 54q20-40-10-46q10 16-6 40z" fill="#a8a29e"/><path d="M58 70q-30 0-34 16q20 8 40 0zM142 70q30 0 34 16q-20 8-40 0z" fill="#e7e5e4"/><path d="M64 60q36-18 72 0q8 50-10 80q-26 20-52 0q-18-30-10-80z" fill="#f5f5f4"/><path d="M84 150q16 40 32 0q-16 10-32 0z" fill="#d6d3d1"/>' + eyes(92, 20, 6, '#a16207') + '<ellipse cx="100" cy="132" rx="14" ry="8" fill="#fda4af"/>'),
    'buho': ('Búho', '<path d="M50 50l20 26M150 50l-20 26" stroke="#78350f" stroke-width="12" stroke-linecap="round"/><ellipse cx="100" cy="110" rx="62" ry="66" fill="#a16207"/><ellipse cx="100" cy="134" rx="40" ry="38" fill="#fde68a"/><circle cx="74" cy="92" r="24" fill="#fef3c7"/><circle cx="126" cy="92" r="24" fill="#fef3c7"/><circle cx="74" cy="92" r="11" fill="#111827"/><circle cx="126" cy="92" r="11" fill="#111827"/><circle cx="77" cy="88" r="3.5" fill="#fff"/><circle cx="129" cy="88" r="3.5" fill="#fff"/><path d="M92 106h16l-8 16z" fill="#f59e0b"/>'),
    'mono': ('Mono', '<circle cx="42" cy="100" r="22" fill="#78350f"/><circle cx="158" cy="100" r="22" fill="#78350f"/><circle cx="42" cy="100" r="12" fill="#d6a46c"/><circle cx="158" cy="100" r="12" fill="#d6a46c"/><circle cx="100" cy="96" r="62" fill="#92400e"/><path d="M60 100q0-40 40-36q40-4 40 36q0 50-40 54q-40-4-40-54z" fill="#e8c39e"/>' + eyes(94, 18) + '<path d="M80 128q20 14 40 0" stroke="#451a03" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="94" cy="112" r="3" fill="#451a03"/><circle cx="106" cy="112" r="3" fill="#451a03"/>'),
}
for k, (lab, art) in ANIMALS.items():
    emit('animales', f'animal-{k}', lab, lambda s, a=art: sc(s, a))

# ---------- Banderas (300x200 artboard) ----------
def stripes(cols, horiz=True, W=300, H=200):
    n = len(cols); o = ''
    for i, c in enumerate(cols):
        o += f'<rect x="0" y="{H*i/n:.3f}" width="{W}" height="{H/n+0.5:.3f}" fill="{c}"/>' if horiz else f'<rect x="{W*i/n:.3f}" y="0" width="{W/n+0.5:.3f}" height="{H}" fill="{c}"/>'
    return o
def sun(cx, cy, r, c='#f6b40e', rays=16):
    o = ''
    for k in range(rays):
        a = math.radians(k * 360 / rays)
        o += f'<line x1="{cx+r*math.cos(a):.1f}" y1="{cy+r*math.sin(a):.1f}" x2="{cx+r*1.8*math.cos(a):.1f}" y2="{cy+r*1.8*math.sin(a):.1f}" stroke="{c}" stroke-width="{2.6 if k%2 else 3.6}"/>'
    return o + f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{c}" stroke="#85340a" stroke-width=".8"/>'
def tri_flag(cols, tri, st):
    return stripes(cols) + f'<path d="M0 0L{173 if st else 150} 100L0 200Z" fill="{tri}"/>' + star(58, 100, 30, '#fff')
def emblem(cx, cy, r, ring='#f6b40e', fill='#3a7d44'):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#ffffff" stroke="{ring}" stroke-width="3"/><path d="M{cx-r*.7} {cy+r*.35} Q{cx} {cy-r*.9} {cx+r*.7} {cy+r*.35}Z" fill="{fill}"/><circle cx="{cx}" cy="{cy-r*.2}" r="{r*.22}" fill="{ring}"/>'
def us():
    o = stripes(['#B22234' if i % 2 == 0 else '#fff' for i in range(13)]) + '<rect width="120" height="107.7" fill="#3C3B6E"/>'
    for r in range(9):
        for c in range(6 if r % 2 == 0 else 5):
            o += star(10 + c*20 + (10 if r % 2 else 0), 6 + r*11.7, 4.6, '#fff')
    return o
def gb():
    return ('<rect width="300" height="200" fill="#012169"/><path d="M0 0L300 200M300 0L0 200" stroke="#fff" stroke-width="40"/>'
            '<path d="M0 0L300 200M300 0L0 200" stroke="#C8102E" stroke-width="13" clip-path="url(#gbc)"/><defs><clipPath id="gbc"><path d="M150 100L300 100L300 200ZM150 100L150 200L0 200ZM150 100L0 100L0 0ZM150 100L150 0L300 0Z" transform="rotate(0)"/></clipPath></defs>'
            '<path d="M150 0v200M0 100h300" stroke="#fff" stroke-width="66"/><path d="M150 0v200M0 100h300" stroke="#C8102E" stroke-width="40"/>')
def maple(cx, cy, s, c='#D80621'):
    pts = [(0,-50),(8,-34),(20,-38),(16,-12),(34,-28),(38,-20),(52,-24),(46,-6),(54,0),(28,18),(32,30),(4,26),(4,50),(-4,50),(-4,26),(-32,30),(-28,18),(-54,0),(-46,-6),(-52,-24),(-38,-20),(-34,-28),(-16,-12),(-20,-38),(-8,-34)]
    return '<polygon points="' + ' '.join(f'{cx+x*s:.1f},{cy+y*s:.1f}' for x, y in pts) + f'" fill="{c}"/>'
def kr():
    o = '<rect width="300" height="200" fill="#fff"/><circle cx="150" cy="100" r="50" fill="#0047A0"/><path d="M100 100a50 50 0 0 1 100 0a25 25 0 0 1-50 0a25 25 0 0 0-50 0" fill="#CD2E3A" transform="rotate(33.7 150 100)"/>'
    def tri(x, y, rot, pattern):
        g = ''
        for i, br in enumerate(pattern):
            yy = -12 + i*12
            g += f'<rect x="-16" y="{yy-4}" width="32" height="8" fill="#000"/>' if not br else f'<rect x="-16" y="{yy-4}" width="14" height="8" fill="#000"/><rect x="2" y="{yy-4}" width="14" height="8" fill="#000"/>'
        return f'<g transform="translate({x},{y}) rotate({rot})">{g}</g>'
    return o + tri(72, 48, -56.3, (0,0,0)) + tri(228, 152, -56.3, (1,1,1)) + tri(228, 48, 56.3, (1,0,1)) + tri(72, 152, 56.3, (0,1,0))
def sa():
    script = ''.join(f'<path d="M{70+i*34} 92 q8 -26 16 0 q8 18 16 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>' for i in range(5))
    return ('<rect width="300" height="200" fill="#006C35"/>' + script + '<path d="M84 70 v28 M150 66 v32 M214 70 v28" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'
            '<path d="M70 132 H222" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M222 132 l14 -6 v12z" fill="#fff"/><path d="M84 124 v16" stroke="#fff" stroke-width="6" stroke-linecap="round"/>')
FLAGS = [
    ('us', 'Estados Unidos', us()),
    ('cu', 'Cuba', tri_flag(['#002A8F', '#fff', '#002A8F', '#fff', '#002A8F'], '#CF142B', True)),
    ('pr', 'Puerto Rico', tri_flag(['#ED0000', '#fff', '#ED0000', '#fff', '#ED0000'], '#0050F0', True)),
    ('mx', 'México', stripes(['#006847', '#fff', '#CE1126'], False) + '<path d="M128 116 Q150 140 172 116" stroke="#3a7d44" stroke-width="5" fill="none"/><path d="M136 112 q-4-30 14-38 q16-6 22 8 q-10-2-12 8 q8 10 0 22z" fill="#8a5a2b"/><path d="M148 100l-12 12M150 96 q10 2 16 14" stroke="#5b3a1a" stroke-width="3" fill="none"/><path d="M140 118h22" stroke="#2f855a" stroke-width="4"/><circle cx="160" cy="78" r="2" fill="#000"/>'),
    ('do', 'República Dominicana', '<rect width="300" height="200" fill="#fff"/><rect width="125" height="80" fill="#002D62"/><rect x="175" width="125" height="80" fill="#CE1126"/><rect y="120" width="125" height="80" fill="#CE1126"/><rect x="175" y="120" width="125" height="80" fill="#002D62"/><path d="M138 84h24v24q0 10-12 14q-12-4-12-14z" fill="#002D62" stroke="#0a7a3e" stroke-width="2.5"/><path d="M150 86v34M140 98h20" stroke="#fff" stroke-width="3"/><path d="M144 104h6v14h-6zM150 104h6v14h-6z" fill="#CE1126" opacity=".85"/>'),
    ('ve', 'Venezuela', stripes(['#FFCC00', '#00247D', '#CF142B']) + ''.join(star(150 + 52*math.cos(math.radians(a)), 128 + 52*math.sin(math.radians(a)), 7, '#fff') for a in range(-160, -10, 21))),
    ('co', 'Colombia', '<rect width="300" height="100" fill="#FCD116"/><rect y="100" width="300" height="50" fill="#003893"/><rect y="150" width="300" height="50" fill="#CE1126"/>'),
    ('es', 'España', '<rect width="300" height="200" fill="#AA151B"/><rect y="50" width="300" height="100" fill="#F1BF00"/><rect x="68" y="72" width="32" height="8" rx="2" fill="#AD1519"/><path d="M68 82h32v26q0 14-16 16q-16-2-16-16z" fill="#fff" stroke="#AD1519" stroke-width="2"/><path d="M68 82h16v20h-16zM84 102h16v6q0 14-16 16z" fill="#AD1519"/><rect x="60" y="80" width="5" height="40" fill="#ccc"/><rect x="103" y="80" width="5" height="40" fill="#ccc"/>'),
    ('ar', 'Argentina', stripes(['#74ACDF', '#fff', '#74ACDF']) + sun(150, 100, 13)),
    ('br', 'Brasil', '<rect width="300" height="200" fill="#009C3B"/><path d="M150 20L280 100L150 180L20 100Z" fill="#FFDF00"/><circle cx="150" cy="100" r="44" fill="#002776"/><path d="M108 88 Q150 76 193 106 L191 114 Q150 86 107 96Z" fill="#fff"/>' + ''.join(star(x, y, 3, '#fff') for x, y in ((130, 118), (150, 124), (168, 116), (140, 132), (160, 136), (150, 110)))),
    ('pt', 'Portugal', '<rect width="300" height="200" fill="#FF0000"/><rect width="120" height="200" fill="#006600"/><circle cx="120" cy="100" r="40" fill="none" stroke="#FFE900" stroke-width="7"/><path d="M98 74h44v34q0 22-22 26q-22-4-22-26z" fill="#fff" stroke="#FF0000" stroke-width="7"/>' + ''.join(f'<rect x="{x-4}" y="{y-5}" width="8" height="10" rx="2" fill="#003399"/>' for x, y in ((120, 88), (108, 100), (132, 100), (120, 100), (120, 112)))),
    ('sa', 'Arabia Saudita', sa()),
    ('ca', 'Canadá', '<rect width="300" height="200" fill="#fff"/><rect width="75" height="200" fill="#D80621"/><rect x="225" width="75" height="200" fill="#D80621"/>' + maple(150, 96, 1.2)),
    ('gb', 'Reino Unido', gb()),
    ('fr', 'Francia', stripes(['#002395', '#fff', '#ED2939'], False)),
    ('it', 'Italia', stripes(['#009246', '#fff', '#CE2B37'], False)),
    ('de', 'Alemania', stripes(['#000', '#DD0000', '#FFCE00'])),
    ('pe', 'Perú', stripes(['#D91023', '#fff', '#D91023'], False)),
    ('cl', 'Chile', '<rect width="300" height="200" fill="#fff"/><rect y="100" width="300" height="100" fill="#D52B1E"/><rect width="100" height="100" fill="#0039A6"/>' + star(50, 50, 22, '#fff')),
    ('ec', 'Ecuador', '<rect width="300" height="100" fill="#FFDD00"/><rect y="100" width="300" height="50" fill="#034EA2"/><rect y="150" width="300" height="50" fill="#ED1C24"/>' + emblem(150, 100, 24, '#a16207', '#2e7d32')),
    ('hn', 'Honduras', stripes(['#0073CF', '#fff', '#0073CF']) + ''.join(star(x, y, 8, '#0073CF') for x, y in ((150, 100), (120, 86), (180, 86), (120, 114), (180, 114)))),
    ('gt', 'Guatemala', stripes(['#4997D0', '#fff', '#4997D0'], False) + '<path d="M128 112 Q150 140 172 112" stroke="#3a7d44" stroke-width="5" fill="none"/><rect x="132" y="80" width="36" height="24" rx="3" fill="#f5e6b8" stroke="#a16207" stroke-width="2"/><circle cx="150" cy="78" r="7" fill="#2e8b57"/>'),
    ('sv', 'El Salvador', stripes(['#0F47AF', '#fff', '#0F47AF']) + '<circle cx="150" cy="100" r="22" fill="none" stroke="#c9a227" stroke-width="3"/><path d="M134 108 L150 84 L166 108Z" fill="#2e7d32" stroke="#c9a227" stroke-width="2"/>'),
    ('ni', 'Nicaragua', stripes(['#0067C6', '#fff', '#0067C6']) + '<circle cx="150" cy="100" r="22" fill="none" stroke="#c9a227" stroke-width="3"/><path d="M134 110 L150 82 L166 110Z" fill="#4aa3df" stroke="#c9a227" stroke-width="2"/><path d="M138 106h24" stroke="#2e7d32" stroke-width="4"/>'),
    ('cr', 'Costa Rica', '<rect width="300" height="200" fill="#002B7F"/><rect y="33" width="300" height="134" fill="#fff"/><rect y="67" width="300" height="66" fill="#CE1126"/>'),
    ('pa', 'Panamá', '<rect width="300" height="200" fill="#fff"/><rect x="150" width="150" height="100" fill="#DA121A"/><rect y="100" width="150" height="100" fill="#072357"/>' + star(75, 50, 22, '#072357') + star(225, 150, 22, '#DA121A')),
    ('uy', 'Uruguay', stripes(['#fff' if i % 2 == 0 else '#0038A8' for i in range(9)]) + '<rect width="111" height="111" fill="#fff"/>' + sun(55, 55, 15, '#FCD116')),
    ('py', 'Paraguay', stripes(['#D52B1E', '#fff', '#0038A8']) + '<circle cx="150" cy="100" r="20" fill="#fff" stroke="#0038A8" stroke-width="3"/><path d="M136 104 Q150 122 164 104" stroke="#2e7d32" stroke-width="3" fill="none"/>' + star(150, 97, 8, '#FCD116')),
    ('bo', 'Bolivia', stripes(['#D52B1E', '#F9E300', '#007934'])),
    ('jm', 'Jamaica', '<rect width="300" height="200" fill="#009B3A"/><path d="M0 0L150 100L0 200ZM300 0L150 100L300 200Z" fill="#000"/><path d="M0 0L300 200M300 0L0 200" stroke="#FED100" stroke-width="28"/>'),
    ('ht', 'Haití', '<rect width="300" height="100" fill="#00209F"/><rect y="100" width="300" height="100" fill="#D21034"/><rect x="115" y="70" width="70" height="60" fill="#fff"/><path d="M130 118 h40 M150 80 v34" stroke="#2e7d32" stroke-width="5"/><path d="M134 116 l-6 -16 M166 116 l6 -16" stroke="#00209F" stroke-width="4"/>'),
    ('nl', 'Países Bajos', stripes(['#AE1C28', '#fff', '#21468B'])),
    ('ie', 'Irlanda', stripes(['#169B62', '#fff', '#FF883E'], False)),
    ('jp', 'Japón', '<rect width="300" height="200" fill="#fff"/><circle cx="150" cy="100" r="60" fill="#BC002D"/>'),
    ('kr', 'Corea del Sur', kr()),
]
def flag_art(svg):
    return lambda s: (f'<g transform="translate(0,{s*0.17:.1f})"><svg width="{s}" height="{s*2/3:.1f}" viewBox="0 0 300 200" preserveAspectRatio="none">'
                      f'<defs><clipPath id="fc"><rect width="300" height="200" rx="10"/></clipPath></defs><g clip-path="url(#fc)">{svg}</g>'
                      f'<rect x="1.5" y="1.5" width="297" height="197" rx="10" fill="none" stroke="#ffffff40" stroke-width="3"/></svg></g>')
for code, lab, svg in FLAGS:
    emit('banderas', f'flag-{code}', lab, flag_art(svg))

# ---------- Marcas / Marcas de lujo ----------
BR = json.load(open(os.path.join(ROOT, 'tools/simple-icons-brands.json')))
def lum(h):
    c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126*c[0] + .7152*c[1] + .0722*c[2]
BGL = lum('111827')
def si_art(path, color):
    return lambda s: f'<g transform="translate({s*.18:.1f},{s*.18:.1f}) scale({s*.64/24:.4f})"><path d="{path}" fill="{color}"/></g>'
for b in BR['brand']:
    col = '#' + b['hex'] if (lum(b['hex']) + .05) / (BGL + .05) >= 3 else '#f8fafc'
    emit('marcas', f'brand-{b["slug"]}', b['title'], si_art(b['path'], col), bg=('#111827', '#030712'))
GOLD = 'url(#gold)'
GOLDDEF = '<defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7e7a1"/><stop offset=".5" stop-color="#d4af37"/><stop offset="1" stop-color="#a67c00"/></linearGradient></defs>'
LUXBG, LUXBORDER = ('#0a0a0a', '#000000'), '#a67c00'
for b in BR['lux']:
    emit('lujo', f'lux-{b["slug"]}', b['title'], lambda s, p=b['path']: GOLDDEF + si_art(p, GOLD)(s), bg=LUXBG, border=LUXBORDER)
# Typographic tiles (generic serif lettering, not the brands' logos): monogram + full name.
TYPO = [('louisvuitton', 'Louis Vuitton', 'LV'), ('gucci', 'Gucci', 'G'), ('chanel', 'Chanel', 'C'), ('prada', 'Prada', 'P'),
        ('versace', 'Versace', 'V'), ('hermes', 'Hermès', 'H'), ('balenciaga', 'Balenciaga', 'B'), ('fendi', 'Fendi', 'F'),
        ('rolex', 'Rolex', 'R'), ('cartier', 'Cartier', 'C'), ('ferragamo', 'Salvatore Ferragamo', 'SF'), ('burberry', 'Burberry', 'B'),
        ('armani', 'Armani', 'A'), ('dolcegabbana', 'Dolce & Gabbana', 'D&G'), ('givenchy', 'Givenchy', 'G'), ('saintlaurent', 'Saint Laurent', 'SL'),
        ('tiffany', 'Tiffany & Co.', 'T&Co'), ('omega', 'Omega', 'Ω'), ('patekphilippe', 'Patek Philippe', 'PP'), ('moncler', 'Moncler', 'M')]
def typo_art(name, mono):
    def f(s):
        fs = 96 if len(mono) <= 2 else 62
        nfs = 17 if len(name) <= 12 else 13
        nm = name.upper().replace('&', '&amp;'); mono_ = mono.replace('&', '&amp;')
        return (GOLDDEF + sc(s, f'<rect x="22" y="22" width="156" height="156" fill="none" stroke="{GOLD}" stroke-width="2"/><rect x="30" y="30" width="140" height="140" fill="none" stroke="{GOLD}" stroke-width="1" opacity=".6"/>'
                f'<text x="100" y="{112 if fs > 70 else 106}" text-anchor="middle" font-family="Didot, Bodoni 72, Georgia, \'Times New Roman\', serif" font-size="{fs}" fill="{GOLD}" letter-spacing="2">{mono_}</text>'
                f'<text x="100" y="152" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif" font-size="{nfs}" fill="#e7d9a6" letter-spacing="3">{nm}</text>'))
    return f
for slug, name, mono in TYPO:
    emit('lujo', f'lux-{slug}', name, typo_art(name, mono), bg=LUXBG, border=LUXBORDER)

# ---------- catalog ----------
INI = [('azul', '#2563eb'), ('rojo', '#dc2626'), ('verde', '#16a34a'), ('morado', '#7c3aed'), ('naranja', '#ea580c'),
       ('rosa', '#db2777'), ('turquesa', '#0d9488'), ('dorado', '#ca8a04'), ('gris', '#475569'), ('negro', '#111827')]
groups = {}
for g, i, l in CAT: groups.setdefault(g, []).append([i, l])
groups['iniciales'] = [[f'ini-{k}', k.capitalize(), c] for k, c in INI]
js = ('// Generated by tools/gen_avatars.py. Bundled avatar catalog (ids are stored in users.avatar_cfg as {pick:"<id>"}).\n'
      '(function (root) {\n  const C = ' + json.dumps(groups, ensure_ascii=False) + ';\n'
      '  if (typeof module !== "undefined") module.exports = C;\n  root.AvatarCatalog = C;\n'
      '})(typeof window !== "undefined" ? window : globalThis);\n')
open(os.path.join(ROOT, 'public/avatar-catalog.js'), 'w').write(js)
print({g: len(v) for g, v in groups.items()})
