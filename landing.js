/**
 * Écran d'accueil et démarrage de l'application selon le rôle :
 * - « Créer une session MJ » : application MJ + session hôte (code à 4 chiffres) ;
 * - « Rejoindre en tant que joueur » : connexion avec le code, puis application en lecture seule.
 * Transport : PeerJS par défaut, BroadcastChannel (entre onglets) avec ?transport=local.
 */
(function () {
  const CODE_KEY = 'chult_explo_session_code';
  const { SessionHost, SessionClient } = ChultSession;
  const { createBroadcastChannelTransport, createPeerJsTransport } = ChultTransports;

  const $ = (id) => document.getElementById(id);
  const landing = $('landing');
  const appEl = $('app');
  const choices = $('landing-choices');
  const joinForm = $('join-form');
  const joinInput = $('join-code');
  const joinError = $('join-error');
  const joinConfirm = $('btn-join-confirm');
  const indicator = $('session-indicator');
  const text = $('session-text');
  const copyBtn = $('session-copy');
  const retryBtn = $('session-retry');

  function createTransport() {
    if (new URLSearchParams(location.search).get('transport') === 'local') {
      return createBroadcastChannelTransport();
    }
    if (typeof Peer === 'function') return createPeerJsTransport(Peer);
    const unavailable = () => Promise.reject(new Error('PeerJS indisponible.'));
    return { host: unavailable, connect: unavailable };
  }

  function readStoredCode() {
    try { return localStorage.getItem(CODE_KEY); } catch (err) { return null; }
  }

  function storeCode(code) {
    try { localStorage.setItem(CODE_KEY, code); } catch (err) { /* stockage indisponible */ }
  }

  function setIndicator(state, label, { copy = false, retry = false } = {}) {
    indicator.hidden = false;
    indicator.dataset.state = state; // 'online' | 'pending' | 'offline'
    text.textContent = label;
    copyBtn.hidden = !copy;
    retryBtn.hidden = !retry;
  }

  function showApp() {
    landing.hidden = true;
    appEl.hidden = false;
  }

  // ----- Rôle MJ -----
  function startAsMj() {
    showApp();
    const mjApp = new ChultMapApp({ role: 'mj' });
    window.chultApp = mjApp;

    let players = 0;
    const host = new SessionHost(createTransport(), {
      getSnapshot: () => mjApp.getSnapshot(),
      onPlayers: (n) => { players = n; render(); },
      onStatus: () => render()
    });
    mjApp.session = host;

    function render() {
      if (host.status === 'online' && host.code) {
        setIndicator('online', `Session ${host.code} · ${players} joueur${players > 1 ? 's' : ''}`, { copy: true });
      } else if (host.status === 'connecting') {
        setIndicator('pending', 'Création de la session…');
      } else {
        setIndicator('offline', 'Hors ligne : les joueurs ne peuvent pas rejoindre', { retry: true });
      }
    }

    function startHost() {
      host.start({ preferredCode: host.code || readStoredCode() })
        .then((code) => storeCode(code))
        .catch((err) => console.warn('Session indisponible :', err));
    }

    copyBtn.onclick = () => {
      if (host.code && navigator.clipboard) navigator.clipboard.writeText(host.code).catch(() => {});
    };
    retryBtn.onclick = () => startHost();
    startHost();
  }

  // ----- Rôle joueur -----
  function renderPlayerIndicator(status) {
    if (status === 'connected') setIndicator('online', 'Connecté');
    else if (status === 'lost') setIndicator('pending', 'Connexion perdue… nouvelle tentative');
    else if (status === 'ended') setIndicator('offline', 'Session terminée');
    else setIndicator('pending', 'Connexion…');
  }

  function onJoin(event) {
    event.preventDefault();
    const code = joinInput.value.trim();
    if (!SessionProtocol.isValidCode(code)) {
      joinError.textContent = 'Le code comporte 4 chiffres.';
      return;
    }
    joinError.textContent = '';
    joinConfirm.disabled = true;

    const fogKeys = new Set(FOG_HEX_KEYS);
    let playerApp = null;
    const client = new SessionClient(createTransport(), {
      parse: (message) => SessionProtocol.parseSnapshot(message, { fogKeys, isInMap: HexGeometry.isInMap }),
      onSnapshot: (snapshot, isFirst) => {
        if (!playerApp) {
          showApp();
          playerApp = new ChultMapApp({ role: 'player' });
          playerApp.session = client;
          window.chultApp = playerApp;
        }
        playerApp.applySnapshot(snapshot, isFirst);
        renderPlayerIndicator(client.status);
      },
      onStatus: (status) => { if (playerApp) renderPlayerIndicator(status); }
    });

    client.join(code).catch(() => {
      joinConfirm.disabled = false;
      joinError.textContent = 'Aucune session avec ce code.';
    });
  }

  $('btn-create-session').addEventListener('click', startAsMj);
  $('btn-join-session').addEventListener('click', () => {
    choices.hidden = true;
    joinForm.hidden = false;
    joinInput.focus();
  });
  $('btn-join-back').addEventListener('click', () => {
    joinForm.hidden = true;
    choices.hidden = false;
    joinError.textContent = '';
  });
  joinInput.addEventListener('input', () => {
    joinInput.value = joinInput.value.replace(/[^0-9]/g, '').slice(0, 4);
  });
  joinForm.addEventListener('submit', onJoin);
})();
