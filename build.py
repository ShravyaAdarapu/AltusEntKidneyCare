"""Build the Altus ENT & Kidney Care static site.

Pages live in src/pages/*.html with a small header block:
    <!--
    title: Page title
    description: Meta description
    nav: home
    -->
Tokens inside pages and partials:
    {{icon:name}}     inline SVG icon
    {{part:name}}     shared HTML chunk from PARTS
    {{site:key}}      clinic details from SITE
Run: python build.py  ->  writes dist/
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
DIST = ROOT / "dist"

SITE = {
    "name": "Altus ENT & Kidney Care",
    "phone": "99668 81811",
    "phone_raw": "+919966881811",
    "wa": "919966881811",
    "email": "altusentkidneycare@gmail.com",
    "addr1": "3rd Floor, AV Complex, Beside Aparna One",
    "addr2": "Dwaraka Nagar Colony, Shaikpet",
    "city": "Hyderabad, Telangana 500104",
    "map_q": "AV+Complex+Beside+Aparna+One+Shaikpet+Hyderabad+500104",
    "year": "2026",
}

I = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
ICONS = {
    "phone": f'<svg {I}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    "whatsapp": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>',
    "mail": f'<svg {I}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    "pin": f'<svg {I}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    "clock": f'<svg {I}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    "calendar": f'<svg {I}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    "chev": f'<svg {I} stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg>',
    "menu": f'<svg {I}><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    "arrow": f'<svg {I}><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    "kidney": f'<svg {I}><path d="M15 3c4 0 6 4 5 8-1 4-4 8-8 6-2-1-1-3-2-5s-3-2-3-5c0-3 4-4 8-4Z"/><path d="M11 12c-2 2-3 5-5 9"/></svg>',
    "ear": f'<svg {I}><path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0"/><path d="M10 9a2 2 0 0 1 4 0c0 1.5-2 2-2 3.5"/></svg>',
    "nose": f'<svg {I}><path d="M12 3c-1 4-4 9-4 12a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3"/><path d="M9 18c-2 0-3 1-3 2M15 18c2 0 3 1 3 2"/></svg>',
    "throat": f'<svg {I}><path d="M8 3c0 5 1 7 1 10s-1 5-1 8M16 3c0 5-1 7-1 10s1 5 1 8"/><path d="M10 9h4M10 13h4"/></svg>',
    "drop": f'<svg {I}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/></svg>',
    "dialysis": f'<svg {I}><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 7h6M9 11h6"/><circle cx="12" cy="16" r="2"/></svg>',
    "transplant": f'<svg {I}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/><path d="M9 12h6M12 9v6"/></svg>',
    "gauge": f'<svg {I}><path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 16 4-5"/><circle cx="12" cy="16" r="1.2"/></svg>',
    "stone": f'<svg {I}><path d="M7 8 11 5l6 2 2 6-4 5-7-1-3-5 2-4Z"/><path d="m11 5 1 6 7 2M12 11l-4 6"/></svg>',
    "needle": f'<svg {I}><path d="m18 3 3 3M14 7l3 3M4 20l3-3M7 17l10-10-3-3L4 14l3 3Z"/></svg>',
    "flask": f'<svg {I}><path d="M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4A1.5 1.5 0 0 0 19 19l-5-10V3"/><path d="M7.5 15h9"/></svg>',
    "baby": f'<svg {I}><circle cx="12" cy="8" r="4"/><path d="M6 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M10.5 8h.01M13.5 8h.01"/></svg>',
    "pregnant": f'<svg {I}><circle cx="11" cy="4.5" r="2"/><path d="M10 8c-2 1-2 4-2 6h3v7M12 9c3 1 4 3 4 5 0 1.5-1.5 2-3 2v5"/></svg>',
    "hearing": f'<svg {I}><path d="M6 9a6 6 0 0 1 12 0c0 4-4 5-4 9a3 3 0 0 1-5 2"/><path d="M9 9a3 3 0 0 1 6 0"/><path d="M20 4c1 1.5 1.5 3 1.5 5M22 2"/></svg>',
    "sinus": f'<svg {I}><path d="M12 4v9"/><path d="M12 13c-1 2-4 3-6 2s-2-5 0-7 6 0 6 5Zm0 0c1 2 4 3 6 2s2-5 0-7-6 0-6 5Z"/></svg>',
    "voice": f'<svg {I}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    "thyroid": f'<svg {I}><path d="M12 8c-1 0-2 1-2 3 0 3-1 6-3 6-3 0-4-4-3-8s3-5 5-4c1 .5 2 1.5 3 3Zm0 0c1 0 2 1 2 3 0 3 1 6 3 6 3 0 4-4 3-8s-3-5-5-4c-1 .5-2 1.5-3 3Z"/></svg>',
    "moon": f'<svg {I}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
    "flower": f'<svg {I}><circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C12 6 10 4 12 3s2 3 0 6.5Zm0 5c0 3.5 2 5.5 0 6.5s-2-3 0-6.5ZM9.5 12C6 12 4 14 3 12s3-2 6.5 0Zm5 0c3.5 0 5.5-2 6.5 0s-3 2-6.5 0Z"/></svg>',
    "scope": f'<svg {I}><path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/></svg>',
    "shield": f'<svg {I}><path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    "users": f'<svg {I}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .7 3.5 3 3.5 6"/></svg>',
    "award": f'<svg {I}><circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/></svg>',
    "book": f'<svg {I}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13v4H6a2 2 0 0 1-2-2Z"/></svg>',
    "home": f'<svg {I}><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
    "file": f'<svg {I}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    "card": f'<svg {I}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>',
    "image": f'<svg {I}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
    "lab": f'<svg {I}><path d="M8 3h8M9 3v5l-4 8a3 3 0 0 0 2.7 4.5h8.6A3 3 0 0 0 19 16l-4-8V3"/></svg>',
    "instagram": f'<svg {I}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>',
    "youtube": f'<svg {I}><rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor"/></svg>',
    "facebook": f'<svg {I}><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z"/></svg>',
    "star": '★',
}

LOGO = """<svg class="mark" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
<path d="M66 8C40 4 22 22 24 46c0 4-4 8-8 14-1 2 1 3 4 3l1 7c-1 2 1 3 2 4-2 2-1 4 1 5 0 5 3 8 9 8l7-1c2 6 0 14-4 22"/>
<path d="M48 36c0-12 18-12 18 2 0 10-10 12-10 20 0 8-8 8-8 2"/><path d="M54 38c0-5 7-5 7 0"/>
</g>
<path d="M80 38c12 0 16 14 14 22-2 10-10 16-18 12-4-2-2-8-4-12s-6-4-6-10c0-8 6-12 14-12Z" fill="#b0906f"/>
<path d="M72 62c-8 8-10 28-16 48" fill="none" stroke="#b0906f" stroke-width="3" stroke-linecap="round"/>
</svg>"""

BRAND = f"""<a href="index.html" class="brand" aria-label="Altus ENT &amp; Kidney Care home">{LOGO}
<span class="brand-text"><strong>ALTUS</strong><small>ENT &amp; Kidney Care</small></span></a>"""

# Opening hours are placeholders until the doctors confirm OPD timings.
TIMINGS = """<table class="timings">
<tr><td>Monday – Saturday</td><td>5:00 PM – 9:00 PM</td></tr>
<tr><td>Sunday</td><td>10:00 AM – 1:00 PM</td></tr>
<tr><td>Kidney Care OPD · Dr. Chetan</td><td>Mon, Wed, Fri</td></tr>
<tr><td>ENT Care OPD · Dr. Mounika</td><td>Tue, Thu, Sat</td></tr>
</table>"""

PARTS = {
    "timings": TIMINGS,
    "brand": BRAND,
    "logo": LOGO,
    "cta": """<section class="section tight"><div class="wrap"><div class="cta-band reveal">
<div class="art">{{part:logo}}</div>
<div><span class="eyebrow">Appointments</span><h2>Two specialists. One calm, unhurried clinic.</h2>
<p>Call, WhatsApp or book online. Our front desk will confirm your slot and tell you what to bring.</p></div>
<div><small style="letter-spacing:.2em;text-transform:uppercase;opacity:.8">For appointments</small>
<a class="phone" href="tel:{{site:phone_raw}}">{{site:phone}}</a>
<div class="btn-row"><a class="btn btn-light" href="book-appointment.html">{{icon:calendar}} Book online</a>
<a class="btn btn-ghost-light" href="https://wa.me/{{site:wa}}?text=Hello%20Altus%2C%20I%27d%20like%20to%20book%20an%20appointment." target="_blank" rel="noopener">{{icon:whatsapp}} WhatsApp</a></div></div>
</div></div></section>""",
}

NAV = [
    ("home", "index.html", "Home"),
    ("about", "about.html", "About"),
    ("doctors", None, "Our Doctors", [
        ("dr-chetan-veeramaneni.html", "Dr. Chetan Veeramaneni", "Nephrologist & Renal Transplant Physician"),
        ("dr-t-mounika.html", "Dr. T. Mounika", "ENT, Head & Neck Surgeon"),
    ]),
    ("services", None, "Specialities", [
        ("kidney-care.html", "Kidney Care", "Nephrology, dialysis &amp; transplant"),
        ("ent-care.html", "ENT Care", "Ear, nose, throat, head &amp; neck"),
    ]),
    ("patients", "patient-info.html", "Patient Info"),
    ("gallery", "gallery.html", "Gallery"),
    ("blog", "health-library.html", "Blogs"),
    ("contact", "contact.html", "Contact"),
]


def nav_html(active):
    out = []
    for item in NAV:
        key, href, label = item[0], item[1], item[2]
        if href:
            cls = ' class="active"' if key == active else ""
            out.append(f'<a href="{href}"{cls}>{label}</a>')
        else:
            cls = " active" if key == active else ""
            links = "".join(f'<a href="{h}">{t}<small>{s}</small></a>' for h, t, s in item[3])
            out.append(f'<div class="dd{cls}"><button type="button" aria-haspopup="true">{label} {{{{icon:chev}}}}</button><div class="dd-menu">{links}</div></div>')
    return "\n".join(out)


LAYOUT = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#5c3d26">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:type" content="website">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400..700&family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
<script type="application/ld+json">{schema}</script>
</head>
<body>
<header class="site-header editorial-header">
<div class="wrap masthead">
{{{{part:brand}}}}
<a class="masthead-book" href="book-appointment.html">Book<span> appointment</span></a>
</div>
<nav class="nav" id="nav" aria-label="Main">{nav}</nav>
</header>
<main>
{body}
</main>
<footer class="site-footer"><div class="wrap">
<div class="footer-grid">
<div>{{{{part:brand}}}}
<p>Specialist kidney and ENT care under one roof in Shaikpet, Hyderabad. Led by Dr. Chetan Veeramaneni and Dr. T. Mounika.</p>
<div class="socials">
<a href="#" aria-label="Instagram">{{{{icon:instagram}}}}</a>
<a href="#" aria-label="YouTube">{{{{icon:youtube}}}}</a>
<a href="#" aria-label="Facebook">{{{{icon:facebook}}}}</a>
</div></div>
<div><h4>Clinic</h4><ul>
<li><a href="about.html">About Altus</a></li>
<li><a href="doctors.html">Our Doctors</a></li>
<li><a href="kidney-care.html">Kidney Care</a></li>
<li><a href="ent-care.html">ENT Care</a></li>
<li><a href="gallery.html">Gallery</a></li>
<li><a href="health-library.html">Blogs</a></li>
</ul></div>
<div><h4>Patients</h4><ul>
<li><a href="book-appointment.html">Book Appointment</a></li>
<li><a href="patient-info.html">Your First Visit</a></li>
<li><a href="patient-info.html#insurance">Insurance &amp; Payments</a></li>
<li><a href="patient-info.html#faq">FAQs</a></li>
<li><a href="privacy-policy.html">Privacy Policy</a></li>
</ul></div>
<div><h4>Visit us</h4>
<p>{{{{site:addr1}}}},<br>{{{{site:addr2}}}},<br>{{{{site:city}}}}</p>
<p><a href="tel:{{{{site:phone_raw}}}}">{{{{site:phone}}}}</a><br><a href="mailto:{{{{site:email}}}}">{{{{site:email}}}}</a></p>
<div class="emergency-note">For a medical emergency, please call 108 or go to the nearest hospital emergency department.</div>
</div>
</div>
<a class="footer-map" href="https://www.google.com/maps/search/?api=1&amp;query={{{{site:map_q}}}}" target="_blank" rel="noopener" aria-label="Open Altus clinic location in Google Maps">
  <iframe title="Altus clinic location" loading="lazy" tabindex="-1" aria-hidden="true" src="https://maps.google.com/maps?q={{{{site:map_q}}}}&amp;z=16&amp;output=embed"></iframe>
  <span>{{{{icon:pin}}}} <strong>Altus ENT &amp; Kidney Care</strong><small>Open in Google Maps ↗</small></span>
</a>
<div class="footer-bottom"><span>© {{{{site:year}}}} Altus ENT &amp; Kidney Care. All rights reserved.</span><span>Website by Kathanika Media</span></div>
</div></footer>
<div class="fab">
<a class="wa" href="https://wa.me/{{{{site:wa}}}}?text=Hello%20Altus%2C%20I%27d%20like%20to%20book%20an%20appointment." target="_blank" rel="noopener" aria-label="Chat on WhatsApp">{{{{icon:whatsapp}}}}</a>
<a class="call" href="tel:{{{{site:phone_raw}}}}" aria-label="Call the clinic">{{{{icon:phone}}}}</a>
</div>
<nav class="mobile-bar" aria-label="Quick actions">
<a href="tel:{{{{site:phone_raw}}}}">{{{{icon:phone}}}}Call</a>
<a href="https://wa.me/{{{{site:wa}}}}" target="_blank" rel="noopener">{{{{icon:whatsapp}}}}WhatsApp</a>
<a class="primary" href="book-appointment.html">{{{{icon:calendar}}}}Book</a>
</nav>
<script src="assets/js/main.js"></script>
</body>
</html>
"""

SCHEMA = """{"@context":"https://schema.org","@type":"MedicalClinic","name":"Altus ENT & Kidney Care",
"telephone":"+91-9966881811","email":"altusentkidneycare@gmail.com",
"address":{"@type":"PostalAddress","streetAddress":"3rd Floor, AV Complex, Beside Aparna One, Dwaraka Nagar Colony, Shaikpet","addressLocality":"Hyderabad","addressRegion":"Telangana","postalCode":"500104","addressCountry":"IN"},
"medicalSpecialty":["Nephrology","Otolaryngologic"],
"employee":[{"@type":"Physician","name":"Dr. Chetan Veeramaneni","medicalSpecialty":"Nephrology"},{"@type":"Physician","name":"Dr. T. Mounika","medicalSpecialty":"Otolaryngologic"}]}"""


def render(text):
    for _ in range(4):  # parts may contain tokens
        text = re.sub(r"\{\{part:([\w-]+)\}\}", lambda m: PARTS[m.group(1)], text)
    text = re.sub(r"\{\{icon:([\w-]+)\}\}", lambda m: ICONS[m.group(1)], text)
    text = re.sub(r"\{\{site:([\w-]+)\}\}", lambda m: SITE[m.group(1)], text)
    return text


def build():
    shutil.copytree(SRC / "assets", DIST / "assets", dirs_exist_ok=True)
    (DIST / "assets" / "img").mkdir(exist_ok=True)
    (DIST / "assets" / "img" / "favicon.svg").write_text(LOGO.replace('class="mark" ', '').replace("currentColor", "#5c3d26"), encoding="utf-8")
    for page in sorted((SRC / "pages").glob("*.html")):
        raw = page.read_text(encoding="utf-8")
        m = re.match(r"<!--(.*?)-->\s*", raw, re.S)
        meta = dict(re.findall(r"^\s*(\w+):\s*(.+?)\s*$", m.group(1), re.M))
        body = raw[m.end():]
        html = LAYOUT.format(title=meta["title"], description=meta["description"],
                             nav=nav_html(meta.get("nav", "")), body=body, schema=SCHEMA)
        (DIST / page.name).write_text(render(html), encoding="utf-8")
        print("built", page.name)


if __name__ == "__main__":
    build()
