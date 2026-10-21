import './style.css';
import { App } from '@capacitor/app';
import {
  NATIVE,
  $,
  $$,
  esc,
  settings,
  saveSettings,
  t,
  toast,
  nav,
  PRESETS,
  cityName,
  applyI18n,
  applyTheme,
  resolvedTheme,
  watchSystemTheme,
  exportFile,
  clearHTMLCache,
  cap,
} from './core.js';
import { renderMap, tickMap, initMap, renderClocks, initClocks } from './map.js';
import { renderTweets, initTweets } from './tweets.js';
import {
  renderPlan,
  initPlan,
  initNotifications,
  syncAll,
  testNotification,
  exactAlarms,
  checkDue,
  closeTopSheet,
} from './plan.js';

const LEADS = [0, 5, 10, 15, 30];

/* ------------------------------------------------------------------ *
 *  Navigation
 * ------------------------------------------------------------------ */
const activeScreen = () => $('.screen.active').id.replace('screen-', '');

function showScreen(name) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.screen === name));
  $('#screen-title').textContent = t(`title.${name}`);
  $('#eyebrow').textContent = cap(new Intl.DateTimeFormat(settings.lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()));
  window.scrollTo(0, 0);
  renderActive();
}

function renderActive() {
  const name = activeScreen();
  if (name === 'map') renderMap();
  if (name === 'clocks') renderClocks();
  if (name === 'tweets') renderTweets();
  if (name === 'plan') renderPlan();
  if (name === 'settings') renderSettings();
}

/* ------------------------------------------------------------------ *
 *  Réglages
 * ------------------------------------------------------------------ */
function renderSettings() {
  $$('#theme-seg [data-theme-opt]').forEach((b) => b.classList.toggle('active', b.dataset.themeOpt === settings.theme));
  $$('#lang-seg [data-lang]').forEach((b) => b.classList.toggle('active', b.dataset.lang === settings.lang));
  $('#set-h24').checked = settings.h24;
  $('#set-seconds').checked = settings.seconds;
  $('#set-replies').checked = settings.replies;
  $('#city-chips').innerHTML = PRESETS.map(
    (c) => `<button type="button" class="chip ${settings.cities.includes(c.id) ? 'on' : ''}" data-city="${c.id}">${esc(cityName(c))}</button>`
  ).join('');
  $('#lead-chips').innerHTML = LEADS.map(
    (m) => `<button type="button" class="chip ${settings.lead === m ? 'on' : ''}" data-lead="${m}">${m ? `${m} min` : t('lead.off')}</button>`
  ).join('');
  $('#goal-val').textContent = settings.goal;
}

async function backup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('rush.')) data[k] = localStorage.getItem(k);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify({ app: 'rush', v: 1, at: new Date().toISOString(), data });
  if (await exportFile(`rush-backup-${stamp}.json`, json, 'application/json')) toast(t('backup.done'));
}

async function restore(file) {
  try {
    const obj = JSON.parse(await file.text());
    if (!obj || obj.app !== 'rush' || !obj.data) throw new Error('format');
    if (!window.confirm(t('backup.confirm'))) return;
    for (const [k, v] of Object.entries(obj.data)) {
      if (k.startsWith('rush.') && typeof v === 'string') localStorage.setItem(k, v);
    }
    location.reload();
  } catch (e) {
    console.error(e);
    toast(t('backup.bad'));
  }
}

function initSettings() {
  $('#theme-btn').addEventListener('click', () => {
    settings.theme = resolvedTheme() === 'dark' ? 'light' : 'dark';
    saveSettings();
    applyTheme();
    if (activeScreen() === 'settings') renderSettings();
  });
  $('#theme-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-opt]');
    if (!b) return;
    settings.theme = b.dataset.themeOpt;
    saveSettings();
    applyTheme();
  });
  $('#lang-seg').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b || b.dataset.lang === settings.lang) return;
    settings.lang = b.dataset.lang;
    saveSettings();
    applyI18n();
    clearHTMLCache();
    showScreen(activeScreen());
    syncAll();
  });
  $('#set-h24').addEventListener('change', (e) => {
    settings.h24 = e.target.checked;
    saveSettings();
    clearHTMLCache();
    renderActive();
  });
  $('#set-seconds').addEventListener('change', (e) => {
    settings.seconds = e.target.checked;
    saveSettings();
    renderActive();
  });
  $('#set-replies').addEventListener('change', (e) => {
    settings.replies = e.target.checked;
    saveSettings();
  });
  $('#city-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-city]');
    if (!b) return;
    const id = b.dataset.city;
    const set = new Set(settings.cities);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    settings.cities = [...set];
    // une ville retirée ne doit plus rester sélectionnée ailleurs
    const valid = new Set(['ouaga', 'ny', 'paris', ...settings.cities]);
    settings.audiences = settings.audiences.filter((a) => valid.has(a));
    if (!settings.audiences.length) settings.audiences = ['ny'];
    if (!valid.has(settings.twTz)) settings.twTz = 'ny';
    saveSettings();
    clearHTMLCache();
    renderSettings();
  });
  $('#lead-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lead]');
    if (!b) return;
    settings.lead = +b.dataset.lead;
    saveSettings();
    renderSettings();
    syncAll();
  });
  $('#goal-minus').addEventListener('click', () => {
    settings.goal = Math.max(1, settings.goal - 1);
    saveSettings();
    renderSettings();
  });
  $('#goal-plus').addEventListener('click', () => {
    settings.goal = Math.min(50, settings.goal + 1);
    saveSettings();
    renderSettings();
  });
  $('#btn-test').addEventListener('click', testNotification);
  $('#btn-exact').addEventListener('click', exactAlarms);
  $('#btn-backup').addEventListener('click', backup);
  $('#btn-restore').addEventListener('click', () => {
    $('#file-backup').value = '';
    $('#file-backup').click();
  });
  $('#file-backup').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) restore(e.target.files[0]);
  });
}

/* ------------------------------------------------------------------ *
 *  Démarrage
 * ------------------------------------------------------------------ */
function tick() {
  const name = activeScreen();
  if (name === 'map') tickMap();
  else if (name === 'clocks') renderClocks();
  checkDue();
}

function init() {
  nav.go = showScreen;
  nav.rerender = renderActive;

  applyI18n();
  $$('.tab').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.screen)));
  watchSystemTheme();
  initMap();
  initClocks();
  initTweets();
  initPlan();
  initSettings();

  // Bouton retour Android : ferme le mode concentration ou la fenêtre, revient à la carte, puis quitte
  if (NATIVE) {
    App.addListener('backButton', () => {
      if (closeTopSheet()) return;
      if (activeScreen() !== 'map') return showScreen('map');
      App.exitApp();
    });
  }

  applyTheme();
  showScreen('map');
  setInterval(tick, 250);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderActive();
  });
  initNotifications();
}

init();
