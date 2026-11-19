/* ============ KONFIGURATION (alles an einer Stelle) ============ */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz5uEEaTn5Pe-ec-33u-pvSRlJCKSAYdsRV3CgDyBfdfGwoHiEGjb46DXZIARyjO293aA/exec";
const PREIS = "14.90";          // Endpreis in Euro (Backend: MARKEN.heizung.preise.basis muss gleich sein)
const PLAN = "basis";           // ein Angebot, Antwort binnen 24 Std. (Servicezeit 8–20 Uhr)
/* ============================================================== */

let selectedAnliegen = null;
function euro(p) { return p.replace('.', ','); }
document.querySelectorAll('.js-preis').forEach(e => { e.textContent = euro(PREIS); });

function el(tag, txt, cls) { const e = document.createElement(tag); if (txt) e.textContent = txt; if (cls) e.className = cls; return e; }
const BRAND_NAME = { vaillant: 'Vaillant', buderus: 'Buderus', junkers: 'Junkers / Bosch', viessmann: 'Viessmann', wolf: 'Wolf', broetje: 'Brötje', andere: 'anderer Hersteller' };

/* Übernahme in das Formular */
function prefill(brand, code) {
  if (brand && BRAND_NAME[brand]) document.getElementById('f_brand').value = BRAND_NAME[brand];
  if (code) document.getElementById('f_vin').value = code.toUpperCase();
  if (!selectedAnliegen) setAnliegen('stoerung');
}

/* ---------- Herkunft + Trichter (anonym, ohne Cookies) ---------- */
function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
const requestId = newId();
const quelle = (function () {
  let q = '';
  try {
    const u = new URLSearchParams(location.search);
    q = u.get('quelle') || u.get('utm_source') || (u.get('gclid') ? 'google-ads' : '');
    if (!q && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (host && host !== location.hostname.replace(/^www\./, '')) q = host;
    }
    if (q) sessionStorage.setItem('hs_quelle', q.slice(0, 60));
    else q = sessionStorage.getItem('hs_quelle') || '';
  } catch (e) {}
  return q || 'direkt';
})();
const visitId = newId();
const funnelSent = {};
function funnel(step) {
  if (funnelSent[step] || navigator.webdriver) return;
  funnelSent[step] = true;
  try {
    fetch(APPS_SCRIPT_URL, {
      method: 'POST', mode: 'no-cors', keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ kind: 'funnel', service: 'heizung', visit: visitId, step, quelle, plan: PLAN,
        device: window.matchMedia && matchMedia('(max-width: 700px)').matches ? 'mobil' : 'desktop' })
    }).catch(() => {});
  } catch (e) {}
}
funnel('1 Seite geöffnet');
try {
  const pk = document.getElementById('angebot');
  if (pk && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { funnel('1b Preise gesehen'); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(pk);
  }
} catch (e) {}


/* ---------- Anliegen ---------- */
function setAnliegen(a) {
  selectedAnliegen = a;
  document.querySelectorAll('[data-a]').forEach(b => {
    const on = b.dataset.a === a;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  document.getElementById('anliegenField').classList.remove('need');
  const teil = a === 'ersatzteil';
  document.getElementById('problemLabel').textContent = teil ? 'Welches Teil suchst du / was ist defekt? *' : 'Was passiert genau? *';
  document.getElementById('f_problem').placeholder = teil
    ? 'z. B. Pumpe macht Geräusche, Monteur sagt Pumpe tauschen – welche passt? Oder: Zündelektrode gesucht.'
    : 'Seit wann? Heizung und/oder Warmwasser betroffen? Geräusche? Schon die Entstörtaste gedrückt?';
}
document.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => setAnliegen(b.dataset.a)));

/* ---------- Fotos: Vorschau, Entfernen, max. 3, Komprimierung im Browser ---------- */
const MAX_PHOTOS = 3;
let photos = [];
let photosChanged = true;
const fileDrop = document.getElementById('fileDrop');
const photoInput = document.getElementById('photoInput');
const thumbs = document.getElementById('thumbs');
const photoNote = document.getElementById('photoNote');
fileDrop.addEventListener('click', () => photoInput.click());
fileDrop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); photoInput.click(); } });
function note(msg, warn) { photoNote.textContent = msg || ''; photoNote.classList.toggle('warn', !!warn); }
function renderPhotos() {
  thumbs.innerHTML = '';
  photos.forEach((p, i) => {
    const d = el('div', '', 'thumb');
    const img = document.createElement('img'); img.src = p.dataUrl; img.alt = 'Foto ' + (i + 1);
    const x = el('button', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Foto ' + (i + 1) + ' entfernen');
    x.addEventListener('click', () => { photos.splice(i, 1); photosChanged = true; renderPhotos(); note(''); });
    d.append(img, x); thumbs.appendChild(d);
  });
  const n = photos.length;
  fileDrop.classList.toggle('has-files', n > 0);
  fileDrop.textContent = n === 0 ? '📷 Fotos auswählen' : (n < MAX_PHOTOS ? `✅ ${n} Foto(s) – weitere hinzufügen` : `✅ ${n} Fotos ausgewählt (Maximum)`);
}
photoInput.addEventListener('change', async () => {
  const files = Array.from(photoInput.files || []);
  photoInput.value = '';
  if (!files.length) return;
  const free = MAX_PHOTOS - photos.length;
  if (free <= 0) { note('Es sind schon 3 Fotos ausgewählt. Entferne eins, um ein anderes hinzuzufügen.', true); return; }
  const take = files.slice(0, free);
  fileDrop.textContent = 'Fotos werden verarbeitet…';
  let failed = 0;
  for (const f of take) {
    try { photos.push({ dataUrl: await compressImage(f, 1400, 0.72) }); photosChanged = true; funnel('4 Foto hinzugefügt'); }
    catch (e) { failed++; }
  }
  renderPhotos();
  const msgs = [];
  if (files.length > take.length) msgs.push(`Es werden maximal ${MAX_PHOTOS} Fotos übernommen.`);
  if (failed) msgs.push('Ein Foto konnte nicht gelesen werden – bitte als JPG oder PNG versuchen.');
  note(msgs.join(' '), msgs.length > 0);
});
function compressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    const timer = setTimeout(() => reject(new Error('timeout')), 20000);
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = () => { clearTimeout(timer); reject(new Error('read')); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('decode')); };
    img.onload = () => {
      clearTimeout(timer);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) { const s = maxDim / Math.max(width, height); width = Math.round(width * s); height = Math.round(height * s); }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Daten sammeln + an das Backend schicken (gleiches Format wie bisher) ---------- */
function formData() {
  const v = id => document.getElementById(id).value.trim();
  const anliegen = selectedAnliegen === 'ersatzteil' ? '[Ersatzteil bestimmen] ' : '[Störung klären] ';
  return {
    requestId, quelle, service: 'heizung',
    timestamp: new Date().toISOString(),
    plan: PLAN, price: PREIS,
    name: v('f_name'), email: v('f_email'), phone: '',
    model: [v('f_brand'), v('f_model')].filter(Boolean).join(' '), year: '',
    vin: v('f_vin').toUpperCase(), engine: v('f_engine'),
    problem: anliegen + v('f_problem')
  };
}
function post(payload) {
  return fetch(APPS_SCRIPT_URL, {
    method: 'POST', mode: 'no-cors', keepalive: false,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
}

const form = document.getElementById('reqform');
const errorBox = document.getElementById('errorBox');
form.addEventListener('input', () => funnel('3 Formular begonnen'));
function showError(msg) { errorBox.textContent = msg; errorBox.style.display = 'block'; errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

document.getElementById('toStage2').addEventListener('click', () => {
  errorBox.style.display = 'none';
  if (!selectedAnliegen) { document.getElementById('anliegenField').classList.add('need'); return showError('Bitte wähle oben aus, worum es geht: Störung klären oder Ersatzteil bestimmen.'); }
  if (!form.checkValidity()) { form.reportValidity(); return; }
  if (photos.length === 0) return showError('Bitte mindestens ein Foto hochladen (Display oder Typenschild).');
  funnel('5 Weiter zur Zahlung');
  const payload = Object.assign({ kind: 'request' }, formData(), { photos: photosChanged ? photos.map(p => p.dataUrl) : [] });
  post(payload).then(() => { photosChanged = false; }).catch(err => console.error('Sicherung fehlgeschlagen', err));
  document.getElementById('stage1').style.display = 'none';
  document.getElementById('stage2').style.display = 'block';
  renderPaypalButton();
  document.getElementById('anfrage').scrollIntoView({ behavior: 'smooth' });
});
document.getElementById('backToForm').addEventListener('click', () => {
  document.getElementById('stage2').style.display = 'none';
  document.getElementById('stage1').style.display = 'block';
});

let paypalRendered = false;
function renderPaypalButton() {
  if (paypalRendered) return;
  if (typeof paypal === 'undefined') { showError('Die Zahlungsfunktion konnte nicht geladen werden. Bitte Seite neu laden oder Werbeblocker kurz deaktivieren.'); return; }
  paypalRendered = true;
  paypal.Buttons({
    style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'buynow' },
    createOrder: (data, actions) => (funnel('6 PayPal geöffnet'), actions.order.create({
      purchase_units: [{ amount: { value: PREIS, currency_code: 'EUR' }, description: 'Heizung-Störung.de – Persönliche Auskunft', custom_id: requestId }]
    })),
    onApprove: async (data, actions) => { const order = await actions.order.capture(); await submitPaid(order); },
    onError: (err) => {
      console.error(err);
      paypalRendered = false;
      document.getElementById('paypal-btn-container').innerHTML = '';
      showError('Bei der Zahlung ist ein Fehler aufgetreten. Es wurde nichts abgebucht – bitte versuch es erneut.');
      renderPaypalButton();
    }
  }).render('#paypal-btn-container');
}

async function submitPaid(order) {
  funnel('7 Bezahlt');
  const payload = Object.assign({ kind: 'paid' }, formData(), {
    photos: photos.map(p => p.dataUrl), paypalOrderId: order.id,
    paypalPayerEmail: (order.payer && order.payer.email_address) || ''
  });
  let sent = false;
  for (let i = 0; i < 3 && !sent; i++) {
    try { await post(payload); sent = true; }
    catch (e) { console.error('Übertragung fehlgeschlagen, neuer Versuch', e); await new Promise(r => setTimeout(r, 1500)); }
  }
  document.getElementById('stage2').style.display = 'none';
  document.getElementById('confirmation').style.display = 'block';
  const t = document.getElementById('confirmText');
  t.textContent = '';
  t.append('Transaktions-ID: ', Object.assign(document.createElement('strong'), { textContent: order.id }),
    document.createElement('br'), 'Die Antwort geht an ' + payload.email + '.');
  if (!sent) t.append(document.createElement('br'), 'Hinweis: Die Übertragung war gestört. Bitte schick uns kurz deine Transaktions-ID per E-Mail, damit nichts verloren geht.');
  document.getElementById('confirmation').scrollIntoView({ behavior: 'smooth' });
}

/* Link von einer Code-Seite: ?hersteller=vaillant&code=F28 */
try {
  const u = new URLSearchParams(location.search);
  const hb = u.get('hersteller'), hc = u.get('code');
  if (hb || hc) {
    prefill(hb, hc || '');
  }
} catch (e) {}
