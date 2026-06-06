# 🚑 LifeLine AI — Predict. Route. Save Lives.

Predictive emergency routing & hospital intelligence for Nigerian cities.
LifeLine AI doesn't just find the fastest route it **predicts future congestion**
and intelligently routes patients to the **best available hospital**.

Built as a dark, glassmorphic, neon-accented operator console — a mix of
**Uber + Google Maps + a medical dashboard**.

---

## ✨ What's inside

| Page | Route | Highlights |
|------|-------|-----------|
| **Emergency Dispatch** | `/` | Patient location, emergency type, priority + animated "AI thinking" stepper |
| **Recommended Hospital** | `/hospitals` | Animated 95/100 score ring, "why" reasons, comparison cards with progress bars |
| **Predictive Route** | `/route` | Full dark map, red vs. green routes, predicted-congestion zone, pulsing **AI alert** + live reroute |
| **Mission Summary** | `/summary` | Success animation, confetti, impact metrics |

Plus a floating **enterprise status widget** (System Online · Predictions Running · Hospitals Monitored).

### Tech
- **React 18 + Vite** — fast, static, S3-friendly build
- **Framer Motion** — fade-up cards, score-ring draw, pulsing alerts, confetti
- **React-Leaflet + CARTO dark tiles** — night map, **no API key required**
- **Space Grotesk** (headings) + **Inter** (body)
- Design tokens match the brief exactly (`#0B1020`, electric blue, cyan, emergency red…)

---

## 🛠️ Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

---

## 📦 Build for production

```bash
npm run build
```

Output goes to `dist/`. The app uses a **HashRouter** and `base: './'`, so it
works on any static host (including a bare S3 bucket) with **no rewrite rules**.

---

## ☁️ Deploy to AWS S3 (static hosting)

1. **Create a bucket** (globally-unique name), e.g. `lifeline-ai-demo`.
2. **Enable static website hosting**
   - S3 → your bucket → *Properties* → *Static website hosting* → **Enable**
   - Index document: `index.html`
   - Error document: `index.html` (HashRouter handles routing client-side)
3. **Upload the build**

   ```bash
   npm run build
   aws s3 sync dist/ s3://lifeline-ai-demo --delete
   ```

   …or just drag the **contents of `dist/`** into the bucket via the console.
4. **Make it public** 
   - *Permissions* → uncheck *Block all public access*
   - Add this bucket policy (replace the bucket name):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicRead",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::lifeline-ai-demo/*"
       }
     ]
   }
   ```
5. Open the **bucket website endpoint** URL. Done. 🎉

> **Nicer URLs + HTTPS (optional):** put **CloudFront** in front of the bucket
> and point your domain at it. Set the default root object to `index.html`.

---

## 🎨 Design system

Tokens are defined as CSS variables in [`src/index.css`](src/index.css):
`--bg`, `--primary`, `--secondary`, `--success`, `--warning`, `--critical`, etc.
Change them in one place to re-theme the whole app.
