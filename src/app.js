import './styles.css';
import Hls from 'hls.js';

const CONFIG = {
  supportEmail: 'support@yourdomain.com',
  brand: 'Daily Payouts',
  videos: {
    watch: 'https://cdn.converteai.net/f5f35ad9-c386-4bdb-a002-e5cfcb42d695/69ebac07715b20730f8a248f/main.m3u8',
    platinum: 'https://cdn.converteai.net/f5f35ad9-c386-4bdb-a002-e5cfcb42d695/69d7b60cedf0d391e0a4b766/main.m3u8',
    rapid: 'https://cdn.converteai.net/f5f35ad9-c386-4bdb-a002-e5cfcb42d695/69d3ea4ed1523c28395b9846/main.m3u8',
    multiplier: 'https://cdn.converteai.net/f5f35ad9-c386-4bdb-a002-e5cfcb42d695/69d3ea528a800605e3887418/main.m3u8',
    protector: 'https://cdn.converteai.net/f5f35ad9-c386-4bdb-a002-e5cfcb42d695/692461263dad7de372bd35c4/main.m3u8',
    social: 'https://cdn.converteai.net/f5f35ad9-c386-4bdb-a002-e5cfcb42d695/692460783752bd8e7992b3ec/main.m3u8'
  }
};
const ONE_DOLLAR_TEST_MODE = import.meta.env.VITE_ONE_DOLLAR_TEST_MODE === 'true';
const displayedPrice = normal => ONE_DOLLAR_TEST_MODE ? '$1.00' : normal;
const testBanner = () => ONE_DOLLAR_TEST_MODE ? '<div class="warning">$1 LIVE CHECKOUT TEST MODE — EVERY PURCHASE IN THIS FUNNEL IS CURRENTLY $1.00</div>' : '';

const offers = {
  platinum: { step: 1, title: 'Upgrade To Daily Payouts Platinum', subtitle: 'Get the complete done-for-you setup and optimization package', price: '$397', sale: '$147', decline: 'No thanks, continue without Platinum', down: 'dsplatinum', next: 'rapid', portrait: true },
  dsplatinum: { step: 1, title: 'Wait — Take $50 Off Platinum Setup', subtitle: 'Get the same done-for-you Platinum Setup at this one-time reduced price', price: '$147', sale: '$97', decline: 'No Thank You, I Don’t Want This Discount', next: 'rapid' },
  rapid: { step: 2, title: 'Get Faster Payouts', subtitle: 'Add the payout acceleration upgrade to your order', price: '$197', sale: '$97', decline: "No thanks, I don't want faster payouts", down: 'dsrapid', next: 'multiplier' },
  dsrapid: { step: 2, title: 'Hold Up — Don’t Miss This', subtitle: 'Activate Rapid Daily Payouts at this one-time reduced price', price: '$97', sale: '$77', decline: 'No Thank You, I Don’t Want This Discount', next: 'multiplier' },
  multiplier: { step: 3, title: 'Activate Multiple Income Streams', subtitle: 'Add automated income streams designed to multiply your daily payouts', price: '$97', sale: '$77', decline: 'No thanks, skip the Multiplier', down: 'dsmultiplier', next: 'protector' },
  dsmultiplier: { step: 3, title: 'Take Your Daily Payouts Further', subtitle: 'Unlock the Multiplier upgrade at this one-time reduced price', price: '$77', sale: '$57', decline: 'No Thank You, I Don’t Want This Discount', next: 'protector' },
  protector: { step: 4, title: 'Protect Your Payouts Now', subtitle: 'Activate the payout protection upgrade today', price: '$97', sale: '$47', decline: 'No thanks, skip protection', down: 'dsprotector', next: 'social' },
  dsprotector: { step: 4, title: 'Last Chance to Maximize Your Daily Payouts', subtitle: 'Unlock the protection upgrade at this one-time reduced price', price: '$47', sale: '$37', decline: 'No Thank You, I Don’t Want This Discount', next: 'social' },
  social: { step: 5, title: 'Unlock Social Media Payouts', subtitle: 'Activate the Social Payments Bot and supported platform payout channels', price: '$97', sale: '$37', decline: 'No thanks, skip Social Payments', down: 'dssocial', next: 'dpptyp25' },
  dssocial: { step: 5, title: 'You’re One Step Away from Social Media Payouts', subtitle: 'Get the Social Payments Bot at this final one-time price', price: '$37', sale: '$27', decline: 'No Thank You, Take Me To The Members Area', next: 'dpptyp25' }
};

const query = () => window.location.search || '';
const url = path => `/${path}${query()}`;
const route = () => window.location.pathname.replace(/^\/+|\/+$/g, '') || 'watch';
const sessionId = (() => {
  let id = localStorage.getItem('dp_session_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('dp_session_id', id); }
  return id;
})();
const tracking = () => {
  const params = new URLSearchParams(location.search);
  return {
    source: params.get('utm_source') || params.get('source') || (document.referrer ? new URL(document.referrer).hostname : 'direct'),
    campaign: params.get('utm_campaign') || '', medium: params.get('utm_medium') || '',
    aid: params.get('aid') || '', tid: params.get('tid') || '', landingPage: location.pathname,
    referrer: document.referrer || ''
  };
};
function track(eventType, extra = {}) {
  const payload = { sessionId, eventType, path: location.pathname, offerKey: route(), tracking: tracking(), metadata: { viewport: `${innerWidth}x${innerHeight}`, device: innerWidth < 768 ? 'mobile' : innerWidth < 1100 ? 'tablet' : 'desktop' }, ...extra };
  fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
}

function video(key, portrait = false) {
  const src = CONFIG.videos[key];
  if (src) {
    const topLine = key === 'watch' ? 'Click Here To Get Paid Today' : 'Your Video Has Started';
    return `<div class="video-frame custom-player ${portrait ? 'portrait' : ''}" data-player>
      <video class="vsl" playsinline autoplay muted preload="auto" disablepictureinpicture disableremoteplayback data-src="${src}"></video>
      <button class="sound-gate" type="button" aria-label="Unmute and watch video">
        <strong>${topLine}</strong>
        <svg class="gate-sound" aria-hidden="true" viewBox="0 0 160 120"><path d="M18 45h27l32-25v80L45 75H18z" fill="currentColor"/><path d="M91 39c13 11 13 31 0 42M106 25c23 20 23 60 0 80" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" opacity=".45"/><path d="M22 12l116 96" stroke="currentColor" stroke-width="9" stroke-linecap="round"/></svg>
        <strong>Watch The Video Now!</strong>
      </button>
      <div class="player-controls" aria-label="Video controls">
        <button class="control play-toggle" type="button" aria-label="Pause video">❚❚</button>
        <button class="control mute-toggle" type="button" aria-label="Unmute video">🔇</button>
      </div>
    </div>`;
  }
  return `<div class="video-frame ${portrait ? 'portrait' : ''}"><div class="video-placeholder" role="button" tabindex="0"><div class="play">▶</div><strong>Your video goes here</strong><span>Add the licensed VSL URL in src/app.js</span></div></div>`;
}

function footer() {
  return `<footer class="footer"><p>Results vary. This product does not guarantee income or success. Examples and testimonials are illustrative and are not promises of future results. Review all terms before purchasing.</p><div class="footer-nav"><a data-link href="/privacy">Privacy</a> &nbsp;|&nbsp; <a data-link href="/terms">Terms &amp; Conditions</a></div><div>© ${new Date().getFullYear()} ${CONFIG.brand}. All rights reserved.</div></footer>`;
}

function watchPage() {
  return `<main class="page">${testBanner()}<section class="shell watch-shell">${video('watch', true)}<a class="cta front-cta" data-link href="${url('checkout')}">Get Instant Access For ${displayedPrice('$67')}<small>${ONE_DOLLAR_TEST_MODE ? 'Temporary live checkout test price' : 'Secure one-time payment'}</small></a></section>${footer()}</main>`;
}

function offerPage(key, offer) {
  const declineTarget = offer.down || offer.next;
  return `<main class="page"><div class="warning">${ONE_DOLLAR_TEST_MODE ? '$1 LIVE CHECKOUT TEST MODE — THIS UPGRADE WILL CHARGE $1.00' : 'IMPORTANT: Please do not close this window or click the Back button.'}</div><section class="shell"><div class="step">STEP ${offer.step}</div><h1>${offer.title}</h1>${CONFIG.videos[key] ? video(key, offer.portrait) : ''}<h2>${offer.subtitle}</h2><div class="price">One-time price <span class="old">${offer.price}</span> ${displayedPrice(offer.sale)}</div><button class="cta upsell-cta" type="button" data-offer="${key}" data-next="${offer.next}">✓ Yes, Add This Upgrade<small>Charge my saved payment method ${displayedPrice(offer.sale)}</small></button><a class="decline" data-link href="${url(declineTarget)}">${offer.decline}</a><div class="payment-message" aria-live="polite"></div></section>${footer()}</main>`;
}

function checkoutPage() {
  const price = displayedPrice('$67.00');
  return `<main class="checkout-page">${testBanner()}<div class="checkout-reserve">YOUR ORDER IS RESERVED FOR: <strong id="reserve-timer">10:00</strong></div><header class="checkout-header"><span class="lock">●</span> Secure Checkout</header><section class="checkout-grid"><form id="checkout-form" class="checkout-form"><h2>Customer Information</h2><p class="checkout-help">Enter your billing details to receive your order confirmation.</p><div class="form-grid"><label>First name<input name="firstName" autocomplete="given-name" required></label><label>Last name<input name="lastName" autocomplete="family-name" required></label><label class="wide">Email address<input name="email" type="email" autocomplete="email" required></label><label class="wide">Phone number<input name="phone" type="tel" autocomplete="tel"></label><label class="wide">Billing address<input name="address1" autocomplete="address-line1" required></label><label>City<input name="city" autocomplete="address-level2" required></label><label>State<input name="state" autocomplete="address-level1" required></label><label>ZIP / postal code<input name="zip" autocomplete="postal-code" required></label><label>Country<select name="country"><option value="US">United States</option><option value="CA">Canada</option><option value="GB">United Kingdom</option><option value="AU">Australia</option></select></label></div><h2>Payment Information</h2><div id="gateway-loading" class="gateway-loading">Loading secure payment fields…</div><div class="card-fields"><label class="wide">Card number<div id="ccnumber" class="hosted-field"></div></label><label>Expiration<div id="ccexp" class="hosted-field"></div></label><label>Security code<div id="cvv" class="hosted-field"></div></label></div><div id="checkout-message" class="checkout-message" aria-live="polite"></div><button id="pay-button" class="buy-button" type="button" disabled>BUY NOW — ${price}</button><p class="secure-note">🔒 100% Secure &amp; Safe Payment</p><p class="vault-note">Your payment method is securely stored by NMI for any optional one-click upgrades you choose during this checkout session.</p></form><aside class="order-summary"><h2>Daily Payouts - FE</h2><div class="summary-row"><span>Today's price</span><strong>${price}</strong></div><div class="summary-row"><span>Subtotal</span><strong>${price}</strong></div><p>+ any applicable taxes</p><div class="summary-total"><span>Today's payment</span><strong>${price}</strong></div><p>This is a single payment made in U.S. Dollars.</p><p class="guarantee"><strong>60-Day Guarantee</strong><br>Your purchase is covered by the product refund policy.</p></aside></section><footer class="checkout-footer">By clicking “BUY NOW,” you authorize a one-time charge of ${price} and agree to the <a data-link href="/terms">Terms of Sale</a> and <a data-link href="/privacy">Privacy Policy</a>.<br>© ${new Date().getFullYear()} ${CONFIG.brand}. All rights reserved.</footer></main>`;
}

function initializeVideos() {
  document.querySelectorAll('video.vsl').forEach(player => {
    const source = player.dataset.src;
    if (player.canPlayType('application/vnd.apple.mpegurl')) {
      player.src = source;
    } else if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(source);
      hls.attachMedia(player);
      player._hls = hls;
    }

    const wrapper = player.closest('[data-player]');
    const gate = wrapper.querySelector('.sound-gate');
    const playButton = wrapper.querySelector('.play-toggle');
    const muteButton = wrapper.querySelector('.mute-toggle');
    let furthestPoint = 0;
    let internalSeek = false;
    const milestones = new Set();

    const updateButtons = () => {
      playButton.textContent = player.paused ? '▶' : '❚❚';
      playButton.setAttribute('aria-label', player.paused ? 'Play video' : 'Pause video');
      muteButton.textContent = player.muted ? '🔇' : '🔊';
      muteButton.setAttribute('aria-label', player.muted ? 'Unmute video' : 'Mute video');
    };

    const beginPlayback = () => player.play().catch(() => {});
    beginPlayback();

    gate.addEventListener('click', () => {
      player.muted = false;
      gate.classList.add('hidden');
      wrapper.classList.add('activated');
      beginPlayback();
      updateButtons();
      track('video_unmuted');
    });

    playButton.addEventListener('click', event => {
      event.stopPropagation();
      if (player.paused) beginPlayback(); else player.pause();
    });

    muteButton.addEventListener('click', event => {
      event.stopPropagation();
      player.muted = !player.muted;
      updateButtons();
    });

    player.addEventListener('click', () => {
      if (!gate.classList.contains('hidden')) return;
      if (player.paused) beginPlayback(); else player.pause();
    });
    player.addEventListener('play', updateButtons);
    player.addEventListener('pause', updateButtons);
    player.addEventListener('volumechange', updateButtons);
    player.addEventListener('timeupdate', () => {
      if (!player.seeking && player.currentTime > furthestPoint) furthestPoint = player.currentTime;
      if (player.duration) [25, 50, 75, 100].forEach(percent => {
        if (!milestones.has(percent) && player.currentTime / player.duration * 100 >= percent) {
          milestones.add(percent); track('video_progress', { metadata: { percent, device: innerWidth < 768 ? 'mobile' : innerWidth < 1100 ? 'tablet' : 'desktop' } });
        }
      });
    });
    player.addEventListener('seeking', () => {
      if (internalSeek || player.currentTime <= furthestPoint + 1.25) return;
      internalSeek = true;
      player.currentTime = furthestPoint;
      queueMicrotask(() => { internalSeek = false; });
    });
    player.addEventListener('contextmenu', event => event.preventDefault());
    updateButtons();
  });
}

function accessPage() {
  return `<main class="page access-page"><section class="access"><h1>Thank You for Your Order!</h1><h2>Please call now to get your program started immediately.</h2><div class="call-box"><p>Your order is complete. Call our activation team now so we can help you get started.</p><a class="call-button" href="tel:+18582571162">Call (858) 257-1162</a><small>Tap the number above to call now.</small></div></section><footer class="access-footer"><p><strong>Program Activation: <a href="tel:+18582571162">(858) 257-1162</a></strong></p><p>Please call to get your program started immediately.</p><p><a data-link href="/privacy">Privacy</a> | <a data-link href="/terms">Terms &amp; Conditions</a></p><p>${CONFIG.brand} © ${new Date().getFullYear()} | All rights reserved.</p></footer></main>`;
}

function legalPage(kind) {
  const privacy = kind === 'privacy';
  return `<main class="page"><article class="legal"><h1>${privacy ? 'Privacy Policy' : 'Terms & Conditions'}</h1><p>Last updated: October 16, 2026</p><p>${privacy ? 'We collect information you voluntarily submit, along with limited technical data needed to operate and improve this website. We use it to deliver requested services, provide support, prevent abuse, and comply with legal obligations.' : 'By using this website, you agree to use it lawfully and understand that results vary. Product access, refund eligibility, billing, and support are governed by the terms shown at checkout.'}</p><p>Questions may be sent to ${CONFIG.supportEmail}.</p><p><a data-link href="/watch">Return to the offer</a></p></article>${footer()}</main>`;
}

function startReserveTimer() {
  const output = document.querySelector('#reserve-timer');
  if (!output) return;
  let seconds = 600;
  const tick = () => {
    output.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    if (seconds > 0) seconds -= 1;
  };
  tick();
  const timer = setInterval(tick, 1000);
  addEventListener('popstate', () => clearInterval(timer), { once: true });
}

async function initializeCheckout() {
  const form = document.querySelector('#checkout-form');
  if (!form) return;
  startReserveTimer();
  let checkoutStarted = false;
  form.addEventListener('input', () => {
    if (!checkoutStarted) { checkoutStarted = true; track('checkout_started'); }
  });
  form.elements.email.addEventListener('blur', () => {
    if (!form.elements.email.validity.valid || !form.elements.email.value) return;
    const customer = Object.fromEntries(new FormData(form));
    track('lead_captured', { customer });
  });
  const payButton = form.querySelector('#pay-button');
  const message = form.querySelector('#checkout-message');
  const loading = form.querySelector('#gateway-loading');
  const showError = text => {
    message.textContent = text;
    message.className = 'checkout-message error';
    payButton.disabled = false;
    payButton.textContent = `BUY NOW — ${displayedPrice('$67.00')}`;
  };
  window.handleNmiToken = async response => {
    payButton.disabled = true;
    payButton.textContent = 'PROCESSING…';
    message.textContent = 'Securely processing your order…';
    message.className = 'checkout-message';
    const data = Object.fromEntries(new FormData(form));
    try {
      const request = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentToken: response.token, customer: data, sessionId, tracking: tracking() })
      });
      const result = await request.json();
      if (!request.ok || !result.success) return showError(result.message || 'Your payment could not be processed.');
      message.textContent = 'Approved! Loading your first upgrade…';
      message.className = 'checkout-message success';
      location.assign(`${result.next}${query()}`);
    } catch {
      showError('Unable to reach the payment service. Please try again.');
    }
  };
  try {
    const configRequest = await fetch('/api/config', { cache: 'no-store' });
    const config = await configRequest.json();
    if (!configRequest.ok || !config.tokenizationKey) throw new Error(config.message || 'Payment gateway is unavailable.');
    const script = document.createElement('script');
    script.src = 'https://secure.nmi.com/token/Collect.js';
    script.dataset.tokenizationKey = config.tokenizationKey;
    script.dataset.variant = 'inline';
    script.onload = () => {
      window.CollectJS.configure({
        variant: 'inline', paymentSelector: '#pay-button',
        fields: {
          ccnumber: { selector: '#ccnumber', title: 'Card Number', placeholder: 'Card number' },
          ccexp: { selector: '#ccexp', title: 'Expiration Date', placeholder: 'MM / YY' },
          cvv: { selector: '#cvv', title: 'CVV', placeholder: 'CVV' }
        },
        styleSniffer: true,
        customCss: { color: '#111827', 'font-size': '16px', 'font-family': 'Inter, Arial, sans-serif' },
        focusCss: { color: '#111827' }, invalidCss: { color: '#dc2626' },
        callback: window.handleNmiToken
      });
      loading.hidden = true;
      payButton.disabled = false;
    };
    script.onerror = () => showError('The secure payment fields failed to load. Please refresh and try again.');
    document.head.appendChild(script);
  } catch (error) {
    showError(error.message || 'The payment gateway is unavailable.');
  }
}

function bindUpsells() {
  document.querySelectorAll('.upsell-cta').forEach(button => button.addEventListener('click', async () => {
    if (button.disabled) return;
    const message = button.closest('.shell').querySelector('.payment-message');
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Processing securely…';
    message.textContent = '';
    track('offer_accepted', { offerKey: button.dataset.offer });
    try {
      const request = await fetch('/api/upsell', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer: button.dataset.offer })
      });
      const result = await request.json();
      if (!request.ok || !result.success) {
        if (result.checkoutRequired) {
          message.innerHTML = `Your checkout session expired. <a data-link href="${url('checkout')}">Return to secure checkout</a>.`;
          bindNavigation();
        } else message.textContent = result.message || 'The charge could not be processed.';
        button.disabled = false;
        button.innerHTML = original;
        return;
      }
      button.textContent = 'Approved! Loading next step…';
      location.assign(url(button.dataset.next));
    } catch {
      message.textContent = 'Unable to reach the payment service. Please try again.';
      button.disabled = false;
      button.innerHTML = original;
    }
  }));
}

function render() {
  const current = route();
  let html;
  if (current === 'watch' || current === '') html = watchPage();
  else if (current === 'checkout') html = checkoutPage();
  else if (offers[current]) html = offerPage(current, offers[current]);
  else if (current === 'dpptyp25') html = accessPage();
  else if (current === 'privacy' || current === 'terms') html = legalPage(current);
  else html = `<main class="page"><section class="legal"><h1>Page not found</h1><p><a data-link href="/watch">Return to the offer</a></p></section>${footer()}</main>`;
  document.querySelector('#app').innerHTML = html;
  bindNavigation();
  initializeVideos();
  bindUpsells();
  initializeCheckout();
  track('page_view');
  document.querySelector('.front-cta')?.addEventListener('click', () => track('cta_click', { offerKey: 'frontend' }));
  document.querySelectorAll('a.decline').forEach(link => link.addEventListener('click', () => track('offer_declined', { offerKey: current })));
}

function bindNavigation() {
  document.querySelectorAll('a[data-link]').forEach(link => link.addEventListener('click', event => {
    const target = new URL(link.href);
    if (target.origin !== location.origin) return;
    event.preventDefault();
    history.pushState({}, '', target.pathname + target.search);
    render();
    scrollTo(0, 0);
  }));
}

addEventListener('popstate', render);
render();
