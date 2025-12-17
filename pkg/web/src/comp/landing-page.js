import { define, html } from "/web_modules/heresy.js";

define("RoiLandingPage", {
  style(self) {
    return `
    ${self} {
      --accent: #ff6b35;
      --accent-light: #ff8c5a;
      --accent-dark: #e55a25;
      --deep: #1a1a2e;
      --deep-light: #2d2d44;
      --cream: #fefbf8;
      --soft-gray: #f4f4f8;
      display: block;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    }

    /* Hero Section */
    ${self} .hero {
      background: linear-gradient(135deg, var(--deep) 0%, var(--deep-light) 50%, #3d3d5c 100%);
      color: white;
      padding: 80px 24px 100px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    ${self} .hero::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 30% 70%, rgba(255, 107, 53, 0.15) 0%, transparent 50%),
                  radial-gradient(circle at 70% 30%, rgba(255, 140, 90, 0.1) 0%, transparent 40%);
      animation: float 20s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      33% { transform: translate(2%, 1%) rotate(1deg); }
      66% { transform: translate(-1%, 2%) rotate(-1deg); }
    }
    ${self} .hero-content {
      position: relative;
      z-index: 1;
      max-width: 900px;
      margin: 0 auto;
    }
    ${self} .hero h1 {
      font-size: clamp(48px, 8vw, 80px);
      font-weight: 800;
      margin: 0 0 16px;
      letter-spacing: -2px;
      line-height: 1.1;
    }
    ${self} .hero h1 span {
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    ${self} .tagline {
      font-size: clamp(20px, 3vw, 28px);
      opacity: 0.9;
      margin: 0 0 40px;
      font-weight: 300;
      line-height: 1.5;
    }
    ${self} .hero-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }
    ${self} .btn {
      padding: 16px 36px;
      font-size: 18px;
      font-weight: 600;
      border-radius: 50px;
      text-decoration: none;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    ${self} .btn-primary {
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
      color: white;
      box-shadow: 0 4px 20px rgba(255, 107, 53, 0.4);
    }
    ${self} .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 30px rgba(255, 107, 53, 0.5);
    }
    ${self} .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
    ${self} .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
    }

    /* Trusted By */
    ${self} .trusted {
      background: var(--soft-gray);
      padding: 40px 24px;
      text-align: center;
    }
    ${self} .trusted p {
      color: #666;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 0 0 16px;
    }
    ${self} .trusted-logos {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 40px;
      flex-wrap: wrap;
      opacity: 0.6;
      font-size: 18px;
      color: #444;
    }
    ${self} .trusted-logos span {
      font-weight: 600;
    }

    /* Features Section */
    ${self} .features {
      padding: 100px 24px;
      background: white;
    }
    ${self} .section-header {
      text-align: center;
      max-width: 700px;
      margin: 0 auto 60px;
    }
    ${self} .section-header h2 {
      font-size: clamp(32px, 5vw, 48px);
      color: var(--deep);
      margin: 0 0 16px;
      font-weight: 700;
    }
    ${self} .section-header p {
      font-size: 18px;
      color: #666;
      line-height: 1.6;
    }
    ${self} .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 32px;
      max-width: 1200px;
      margin: 0 auto;
    }
    ${self} .feature-card {
      background: var(--soft-gray);
      border-radius: 20px;
      padding: 40px 32px;
      transition: all 0.3s ease;
    }
    ${self} .feature-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
    }
    ${self} .feature-icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin-bottom: 24px;
    }
    ${self} .feature-card h3 {
      font-size: 22px;
      color: var(--deep);
      margin: 0 0 12px;
      font-weight: 600;
    }
    ${self} .feature-card p {
      color: #666;
      line-height: 1.6;
      margin: 0;
    }

    /* Screenshot Section */
    ${self} .screenshots {
      padding: 100px 24px;
      background: linear-gradient(180deg, var(--cream) 0%, white 100%);
    }
    ${self} .screenshot-showcase {
      max-width: 1100px;
      margin: 0 auto;
    }
    ${self} .screenshot-main {
      background: var(--deep);
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.3);
      margin-bottom: 40px;
    }
    ${self} .screenshot-main img {
      width: 100%;
      border-radius: 12px;
      display: block;
    }
    ${self} .screenshot-placeholder {
      background: linear-gradient(135deg, #e8e8f0 0%, #d8d8e8 100%);
      border-radius: 12px;
      aspect-ratio: 16/9;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #888;
      font-size: 24px;
    }
    ${self} .screenshot-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    @media (max-width: 768px) {
      ${self} .screenshot-grid {
        grid-template-columns: 1fr;
      }
    }
    ${self} .screenshot-thumb {
      background: white;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.3s ease;
    }
    ${self} .screenshot-thumb:hover {
      transform: scale(1.02);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    }
    ${self} .screenshot-thumb img {
      width: 100%;
      border-radius: 8px;
      display: block;
    }
    ${self} .screenshot-thumb p {
      margin: 12px 0 0;
      font-size: 14px;
      color: #666;
      text-align: center;
    }

    /* How it Works */
    ${self} .how-it-works {
      padding: 100px 24px;
      background: var(--deep);
      color: white;
    }
    ${self} .how-it-works .section-header h2 {
      color: white;
    }
    ${self} .how-it-works .section-header p {
      color: rgba(255, 255, 255, 0.7);
    }
    ${self} .steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 40px;
      max-width: 1000px;
      margin: 0 auto;
    }
    ${self} .step {
      text-align: center;
      position: relative;
    }
    ${self} .step-number {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 700;
      margin: 0 auto 20px;
    }
    ${self} .step h3 {
      font-size: 20px;
      margin: 0 0 12px;
      font-weight: 600;
    }
    ${self} .step p {
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.6;
      margin: 0;
    }

    /* Pricing Preview */
    ${self} .pricing {
      padding: 100px 24px;
      background: white;
    }
    ${self} .pricing-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 32px;
      max-width: 900px;
      margin: 0 auto;
    }
    ${self} .pricing-card {
      background: var(--soft-gray);
      border-radius: 24px;
      padding: 40px 32px;
      text-align: center;
      position: relative;
      transition: all 0.3s ease;
    }
    ${self} .pricing-card.featured {
      background: linear-gradient(135deg, var(--deep) 0%, var(--deep-light) 100%);
      color: white;
      transform: scale(1.02);
    }
    ${self} .pricing-card:hover {
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    }
    ${self} .pricing-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--accent);
      color: white;
      padding: 6px 20px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    ${self} .pricing-card h3 {
      font-size: 24px;
      margin: 0 0 8px;
      font-weight: 600;
    }
    ${self} .pricing-card .price {
      font-size: 48px;
      font-weight: 700;
      margin: 16px 0;
    }
    ${self} .pricing-card .price span {
      font-size: 18px;
      font-weight: 400;
      opacity: 0.7;
    }
    ${self} .pricing-card ul {
      list-style: none;
      padding: 0;
      margin: 24px 0;
      text-align: left;
    }
    ${self} .pricing-card li {
      padding: 8px 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    ${self} .pricing-card li::before {
      content: '✓';
      color: var(--accent);
      font-weight: bold;
    }
    ${self} .pricing-card.featured li::before {
      color: var(--accent-light);
    }
    ${self} .pricing-card .btn {
      width: 100%;
      justify-content: center;
      margin-top: 16px;
    }
    ${self} .pricing-note {
      text-align: center;
      margin-top: 40px;
      color: #888;
      font-size: 14px;
    }

    /* CTA Section */
    ${self} .cta {
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
      padding: 80px 24px;
      text-align: center;
      color: white;
    }
    ${self} .cta h2 {
      font-size: clamp(28px, 4vw, 40px);
      margin: 0 0 16px;
      font-weight: 700;
    }
    ${self} .cta p {
      font-size: 18px;
      opacity: 0.9;
      margin: 0 0 32px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }
    ${self} .cta .btn {
      background: white;
      color: var(--accent-dark);
    }
    ${self} .cta .btn:hover {
      background: var(--cream);
    }

    /* Footer */
    ${self} .landing-footer {
      background: var(--deep);
      color: rgba(255, 255, 255, 0.7);
      padding: 60px 24px 40px;
      text-align: center;
    }
    ${self} .landing-footer .logo {
      font-size: 28px;
      font-weight: 700;
      color: white;
      margin-bottom: 16px;
    }
    ${self} .landing-footer p {
      margin: 0 0 24px;
      font-size: 14px;
    }
    ${self} .footer-links {
      display: flex;
      justify-content: center;
      gap: 24px;
      flex-wrap: wrap;
    }
    ${self} .footer-links a {
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      font-size: 14px;
    }
    ${self} .footer-links a:hover {
      color: var(--accent-light);
    }
    `;
  },

  render() {
    return this.html`
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-content">
          <h1><span>roiheimen</span></h1>
          <p class="tagline">
            Taleliste og avroysting for demokratiske mote.<br>
            Frå styremote til landsmote &ndash; enkelt og effektivt.
          </p>
          <div class="hero-buttons">
            <a href="/registrer.html" class="btn btn-primary">
              Kom i gang gratis
            </a>
            <a href="/login.html" class="btn btn-secondary">
              Logg inn
            </a>
          </div>
        </div>
      </section>

      <!-- Trusted By -->
      <section class="trusted">
        <p>Brukt av</p>
        <div class="trusted-logos">
          <span>MDG Landsmote</span>
          <span>Noregs Mallag</span>
          <span>Lokale foreiningar</span>
        </div>
      </section>

      <!-- Features -->
      <section class="features">
        <div class="section-header">
          <h2>Alt du treng for gode mote</h2>
          <p>Roiheimen gjer det enkelt a halda styr pa kven som skal snakka, og la alle stemma nar avgjerder skal takast.</p>
        </div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">📋</div>
            <h3>Smart taleliste</h3>
            <p>Deltakarane melder seg pa frå eiga eining. Du ser kven som ventar, og kven som har ordet. Stott for innlegg, replikkar og saksopplysningar.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🗳️</div>
            <h3>Enkel avroysting</h3>
            <p>Opne eller hemmelege avroysting. Resultat i sanntid eller etter at alle har stemt. Perfekt for vedtak og val.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📱</div>
            <h3>Fungerer overalt</h3>
            <p>Deltakarane brukar eigen mobil, nettbrett eller PC. Ingen app a lasta ned &ndash; berre opna nettlesaren.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🎯</div>
            <h3>Enkelt oppsett</h3>
            <p>Opprett organisasjon, legg til mote, inviter deltakarar. Klart til bruk pa minutt.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📺</div>
            <h3>Storskjermvisning</h3>
            <p>Vis talelista og avroysting pa storskjerm. Alle ser kven som har ordet og resultata av avroysting.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3>Sikker og privat</h3>
            <p>Hemmelege avroysting er verkeleg hemmelege. Ingen kan sjå kva den enkelte stemte.</p>
          </div>
        </div>
      </section>

      <!-- Screenshots -->
      <section class="screenshots">
        <div class="section-header">
          <h2>Sjå korleis det fungerer</h2>
          <p>Roiheimen er designa for a vera enkel a bruka &ndash; bade for dei som styrer motet og deltakarane.</p>
        </div>
        <div class="screenshot-showcase">
          <div class="screenshot-main">
            <div class="screenshot-placeholder">
              Bilete av Roiheimen i bruk kjem her
            </div>
          </div>
          <div class="screenshot-grid">
            <div class="screenshot-thumb">
              <img src="/docs/speechlist.png" alt="Taleliste" onerror="this.parentElement.innerHTML='<div style=\\'aspect-ratio:4/3;background:#f0f0f0;display:flex;align-items:center;justify-content:center;border-radius:8px\\'>Taleliste</div>'">
              <p>Taleliste for deltakarar</p>
            </div>
            <div class="screenshot-thumb">
              <img src="/docs/manage.png" alt="Administrasjon" onerror="this.parentElement.innerHTML='<div style=\\'aspect-ratio:4/3;background:#f0f0f0;display:flex;align-items:center;justify-content:center;border-radius:8px\\'>Administrasjon</div>'">
              <p>Administrer motet</p>
            </div>
            <div class="screenshot-thumb">
              <img src="/docs/referendum.png" alt="Avroysting" onerror="this.parentElement.innerHTML='<div style=\\'aspect-ratio:4/3;background:#f0f0f0;display:flex;align-items:center;justify-content:center;border-radius:8px\\'>Avroysting</div>'">
              <p>Enkel avroysting</p>
            </div>
          </div>
        </div>
      </section>

      <!-- How it Works -->
      <section class="how-it-works">
        <div class="section-header">
          <h2>Kom i gang pa tre steg</h2>
          <p>Det tar berre nokre minutt a setja opp organisasjonen din.</p>
        </div>
        <div class="steps">
          <div class="step">
            <div class="step-number">1</div>
            <h3>Opprett organisasjon</h3>
            <p>Registrer deg og opprett ein organisasjon for laget, partiet eller foreininga di.</p>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <h3>Legg til mote</h3>
            <p>Opprett mote med agenda og avroysting. Inviter deltakarar med e-post eller lenke.</p>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <h3>Koyrer motet</h3>
            <p>Deltakarane melder seg pa talelista og stemmer frå eiga eining. Du har full oversikt.</p>
          </div>
        </div>
      </section>

      <!-- Pricing -->
      <section class="pricing">
        <div class="section-header">
          <h2>Pris som passar alle</h2>
          <p>Gratis for sma mote. Rimeleg for dei store.</p>
        </div>
        <div class="pricing-cards">
          <div class="pricing-card">
            <h3>Gratis</h3>
            <div class="price">0 kr</div>
            <ul>
              <li>Opp til 24 deltakarar</li>
              <li>Alle funksjonar</li>
              <li>Ubegrensa mote</li>
              <li>Automatisk sletting etter 30 dagar</li>
            </ul>
            <a href="/registrer.html" class="btn btn-primary">Kom i gang</a>
          </div>
          <div class="pricing-card featured">
            <div class="pricing-badge">Kjem snart</div>
            <h3>Organisasjon</h3>
            <div class="price">? kr <span>/ mote</span></div>
            <ul>
              <li>Ubegrensa deltakarar</li>
              <li>Alle funksjonar</li>
              <li>Data lagrast til du slettar</li>
              <li>Prioritert support</li>
            </ul>
            <a href="/registrer.html" class="btn btn-primary">Prov gratis forst</a>
          </div>
        </div>
        <p class="pricing-note">
          Har du sporsmal? Ta kontakt pa hei@roiheimen.no
        </p>
      </section>

      <!-- CTA -->
      <section class="cta">
        <h2>Klar til a gjera mota dine betre?</h2>
        <p>Det er gratis a prova, og du kan vera i gang pa minutt.</p>
        <a href="/registrer.html" class="btn">Opprett gratis konto</a>
      </section>

      <!-- Footer -->
      <footer class="landing-footer">
        <div class="logo">roiheimen</div>
        <p>Taleliste og avroysting for demokratiske mote</p>
        <div class="footer-links">
          <a href="/login.html">Logg inn</a>
          <a href="/registrer.html">Registrer deg</a>
        </div>
      </footer>
    `;
  },
});
