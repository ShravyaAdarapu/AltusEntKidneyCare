# Altus website: what's real vs. placeholder

Run locally: `python build.py`, then serve `dist/` (preview config "altus-site", port 8090).
Edit content in `src/pages/*.html`; clinic phone, email and address live in `SITE` in `build.py`; timings in `TIMINGS`.

## From the visiting card (confirmed)
- Clinic name, address, appointment number 99668 81811, email
- Both doctors' degrees and titles

## From public web profiles (verify with the doctors)
- Dr. Chetan: education, STAR Hospitals / Yashoda history, expertise, procedures, awards, publications, memberships (STAR Hospitals profile, drchetanveeramaneni.com)
- Dr. Mounika: MBBS 2014, MS ENT 2021, fellowship 2022–23, procedures, award, memberships, publications, 8 yrs experience (Yashoda Hospitals profile)
- Dr. Chetan's photo is hot-linked from drchetanveeramaneni.com; replace with the new shoot photos

## Placeholder / dummy (must be replaced before launch)
- OPD timings and doctor days (Mon–Sat 5–9 PM, Sun morning; Chetan Mon/Wed/Fri, Mounika Tue/Thu/Sat)
- Consultation fees on Patient Info page (₹800 etc.)
- Patient testimonials on home page (sample text; check NMC advertising rules before using real ones)
- "18+ years combined" and "40+ procedures" stats
- Clinic facilities (endoscopy station, sample collection, lift/parking) and partner-hospital wording
- Gallery tiles (awaiting clinic shoot)
- Dr. Mounika photo (monogram placeholder)
- Medical registration numbers (NMC disclosure line on both profiles)
- Instagram / YouTube / Facebook links (currently `#`)
- Health library articles (titles and summaries only)
- Logo is an SVG redraw of the card logo; swap in the original files when received
