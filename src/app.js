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
  },
  checkoutUrls: {
    platinum: '', dsplatinum: '', rapid: '', dsrapid: '', multiplier: '',
    dsmultiplier: '', protector: '', dsprotector: '', social: '', dssocial: ''
  }
};

const offers = {
  platinum: { step: 1, title: 'Unlock the Complete Platinum Upgrade', subtitle: 'Get the premium tools and resources available in your account', price: '$197', sale: '$97', decline: 'No thanks, continue without Platinum', down: 'dsplatinum', next: 'rapid', portrait: true },
  dsplatinum: { step: 1, title: 'A Special One-Time Platinum Offer', subtitle: 'Activate the core Platinum package at a reduced price', price: '$97', sale: '$67', decline: 'No thanks, I will pass on Platinum', next: 'rapid' },
  rapid: { step: 2, title: 'Get Faster Payouts', subtitle: 'Add the payout acceleration upgrade to your order', price: '$197', sale: '$97', decline: "No thanks, I don't want faster payouts", down: 'dsrapid', next: 'multiplier' },
  dsrapid: { step: 2, title: 'Wait — Get the Essential Accelerator', subtitle: 'Choose the streamlined version at today’s reduced price', price: '$97', sale: '$47', decline: 'No thanks, continue without the accelerator', next: 'multiplier' },
  multiplier: { step: 3, title: 'Multiply Your Results', subtitle: 'Add the advanced scaling toolkit to your account', price: '$197', sale: '$97', decline: 'No thanks, skip the multiplier', down: 'dsmultiplier', next: 'protector' },
  dsmultiplier: { step: 3, title: 'Add the Multiplier Lite Edition', subtitle: 'Keep the essentials and save today', price: '$97', sale: '$47', decline: 'No thanks, continue without it', next: 'protector' },
  protector: { step: 4, title: 'Protect Your Progress', subtitle: 'Add account protection and continuity resources', price: '$197', sale: '$97', decline: 'No thanks, skip protection', down: 'dsprotector', next: 'social' },
  dsprotector: { step: 4, title: 'Essential Protection — Reduced', subtitle: 'Secure the core protection package at a lower price', price: '$97', sale: '$47', decline: 'No thanks, continue without protection', next: 'social' },
  social: { step: 5, title: 'Add the Social Growth Suite', subtitle: 'Expand your reach with the complete social toolkit', price: '$197', sale: '$97', decline: 'No thanks, skip social growth', down: 'dssocial', next: 'dpptyp25' },
  dssocial: { step: 5, title: 'Social Growth Starter Offer', subtitle: 'Get the streamlined social toolkit at a special price', price: '$97', sale: '$47', decline: 'No thanks, finish my order', next: 'dpptyp25' }
};

const query = () => window.location.search || '';
const url = path => `/${path}${query()}`;
const route = () => window.location.pathname.replace(/^\/+|\/+$/g, '') || 'watch';

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
  return `<main class="page"><section class="shell watch-shell">${video('watch', true)}</section>${footer()}</main>`;
}

function offerPage(key, offer) {
  const declineTarget = offer.down || offer.next;
  const checkout = CONFIG.checkoutUrls[key];
  const acceptHref = checkout || url(offer.next);
  return `<main class="page"><div class="warning">IMPORTANT: Please do not close this window or click the Back button.</div><section class="shell"><div class="step">STEP ${offer.step}</div><h1>${offer.title}</h1>${CONFIG.videos[key] ? video(key, offer.portrait) : ''}<h2>${offer.subtitle}</h2><div class="price">One-time price <span class="old">${offer.price}</span> ${offer.sale}</div><a class="cta" ${checkout ? '' : 'data-link'} href="${acceptHref}">✓ Yes, Add This Upgrade<small>60-day money-back guarantee</small></a><a class="decline" data-link href="${url(declineTarget)}">${offer.decline}</a></section>${footer()}</main>`;
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
  return `<main class="page access-page"><section class="access"><h1>Thank You for Upgrading!</h1><h2>Sign up below to access your products</h2><form class="form-box" id="access-form"><label for="name">First name</label><input id="name" name="name" autocomplete="given-name" required><label for="email">Email address *</label><input id="email" name="email" type="email" autocomplete="email" required><button type="submit">Get Access Here</button></form></section><footer class="access-footer"><p>${CONFIG.supportEmail}</p><p>For order assistance, contact support using the email above.</p><p><a data-link href="/privacy">Privacy</a> | <a data-link href="/terms">Terms &amp; Conditions</a></p><p>${CONFIG.brand} © ${new Date().getFullYear()} | All rights reserved.</p></footer></main>`;
}

function legalPage(kind) {
  const privacy = kind === 'privacy';
  return `<main class="page"><article class="legal"><h1>${privacy ? 'Privacy Policy' : 'Terms & Conditions'}</h1><p>Last updated: October 16, 2026</p><p>${privacy ? 'We collect information you voluntarily submit, along with limited technical data needed to operate and improve this website. We use it to deliver requested services, provide support, prevent abuse, and comply with legal obligations.' : 'By using this website, you agree to use it lawfully and understand that results vary. Product access, refund eligibility, billing, and support are governed by the terms shown at checkout.'}</p><p>Questions may be sent to ${CONFIG.supportEmail}.</p><p><a data-link href="/watch">Return to the offer</a></p></article>${footer()}</main>`;
}

function render() {
  const current = route();
  let html;
  if (current === 'watch' || current === '') html = watchPage();
  else if (offers[current]) html = offerPage(current, offers[current]);
  else if (current === 'dpptyp25') html = accessPage();
  else if (current === 'privacy' || current === 'terms') html = legalPage(current);
  else html = `<main class="page"><section class="legal"><h1>Page not found</h1><p><a data-link href="/watch">Return to the offer</a></p></section>${footer()}</main>`;
  document.querySelector('#app').innerHTML = html;
  bindNavigation();
  initializeVideos();
  document.querySelector('#access-form')?.addEventListener('submit', event => {
    event.preventDefault();
    event.currentTarget.innerHTML = '<h2 style="text-align:center;margin:40px 0">You’re all set. Check your inbox for access instructions.</h2>';
  });
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
