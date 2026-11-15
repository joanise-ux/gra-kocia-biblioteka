'use strict';
/* =========================================================
   Dane gry: kategorie książek, szafy, ulepszenia, zwierzęta, regiony.
   ========================================================= */

const T = 48; // rozmiar kafelka w jednostkach świata

const CATEGORIES = {
  fantasy: { name: 'Fantasy', color: '#8e6cc4', titles: ['Smok w filiżance', 'Zaklęta mapa', 'Księga mgieł', 'Czarodziej z poddasza'] },
  crime: { name: 'Kryminał', color: '#4a78b0', titles: ['Kto zjadł sernik?', 'Cień w spiżarni', 'Zagadka latarni', 'Ślad na śniegu'] },
  romance: { name: 'Romans', color: '#e27d9a', titles: ['Listy spod jabłoni', 'Herbata dla dwojga', 'Serce z wełny', 'Lato w Lawendowie'] },
  nature: { name: 'Przyroda', color: '#5fa055', titles: ['Atlas grzybów', 'Ptaki znad stawu', 'Sekrety mchu', 'Rok w ogrodzie'] },
  poetry: { name: 'Poezja', color: '#e0a83a', titles: ['Wiersze o deszczu', 'Kołysanki księżyca', 'Haiku dla kota', 'Szepty jesieni'] },
  fairy: { name: 'Bajki', color: '#62b8e0', titles: ['Jeżyk i gwiazdka', 'Bajki na dobranoc', 'Zaczarowany kapcie', 'Miś, który liczył chmury'] },
  cooking: { name: 'Kucharskie', color: '#e8743b', titles: ['Pierogi babci Sowy', 'Ciasta z leśnego runa', 'Zupy na chłodne dni', 'Kakao na sto sposobów'] },
  travel: { name: 'Podróże', color: '#3fae9d', titles: ['Mapy dalekich lądów', 'Pociągiem przez góry', 'Wyspa latarników', 'Szlakiem herbaty'] },
  comics: { name: 'Komiksy', color: '#d9534f', titles: ['Super Szop', 'Kapitan Wiewiórka', 'Przygody Kotołaka', 'Patrol Borsuków'] },
  history: { name: 'Historia', color: '#9a6a44', titles: ['Dawne zamki', 'Kronika młyna', 'Dzieje bursztynu', 'Rycerze z Mchowa'] },
  spooky: { name: 'Groza', color: '#5b4b8a', titles: ['Duch z biblioteki', 'Skrzypiąca podłoga', 'Noc dyń', 'Szept w kominie'] },
};
const CAT_ORDER = Object.keys(CATEGORIES);

// Kolejne szafy i kategorie, które przynoszą
const BOOKCASE_SETS = [
  { cats: ['fantasy', 'crime', 'romance', 'nature', 'poetry'], price: 0 },
  { cats: ['fairy', 'cooking'], price: 120 },
  { cats: ['travel', 'comics'], price: 260 },
  { cats: ['history', 'spooky'], price: 450 },
];
// Miejsca szaf w sali (lewy kafelek podstawy, szafa ma 3×1 kafle)
const BOOKCASE_SPOTS = [
  { tx: 11, ty: 2 },
  { tx: 15, ty: 2 },
  { tx: 11, ty: 8 },
  { tx: 15, ty: 8 },
];
const SHELVES_PER_CASE = 5;
const BOOKS_PER_SHELF = 4;
const MAX_SHELVES_PER_CAT = 3;

const UPGRADES = {
  speed: { name: 'Szybkie łapki', icon: '🐾', prices: [60, 140, 260], desc: '{kot} chodzi szybciej.' },
  bag: { name: 'Torba na książki', icon: '👜', prices: [80, 200], desc: 'Kotka nosi więcej książek naraz i obsługuje kilku gości za jednym kursem.' },
  counter: { name: 'Większa lada', icon: '🛎️', prices: [180], desc: 'Jeszcze jedno miejsce dla gościa i więcej gości każdego dnia.' },
  reading: { name: 'Czytelnia', icon: '⭐', prices: [300], desc: 'Pokój z fotelami za prawą ścianą. Wchodzą tu tylko stali klienci (⭐ po 3 wizytach): czytają w spokoju i zostawiają napiwek.' },
  cozy: { name: 'Przytulny kącik', icon: '🛋️', prices: [100, 220], desc: 'Zadowoleni goście zostawiają większe napiwki.' },
};

function shelfPrice(current) {
  return 50 + (current - 1) * 40;
}

const SPECIES = {
  fox: {
    emoji: '🦊',
    names: ['Lisica Ola', 'Lis Feliks', 'Lisica Rudka'],
    fav: ['crime', 'romance', 'travel'],
    b: '#ec8a4a', l: '#fff4e6', d: '#6b4a3a', n: '#4a3330',
  },
  rabbit: {
    emoji: '🐰',
    names: ['Królik Kazio', 'Króliczka Tola', 'Królik Bruno'],
    fav: ['romance', 'nature', 'fairy'],
    b: '#f1ebe6', l: '#ffffff', d: '#d9cdc4', n: '#f08fa0',
  },
  bear: {
    emoji: '🐻',
    names: ['Miś Bartek', 'Niedźwiedzica Hela', 'Miś Tymek'],
    fav: ['nature', 'cooking', 'fantasy'],
    b: '#a8714a', l: '#ecd0ad', d: '#7c5236', n: '#4a3330',
  },
  owl: {
    emoji: '🦉',
    names: ['Sowa Zofia', 'Puchacz Edek', 'Sówka Lusia'],
    fav: ['poetry', 'history', 'crime'],
    b: '#b08a66', l: '#f6e8cf', d: '#8a6848', n: '#f0b030',
  },
  hedgehog: {
    emoji: '🦔',
    names: ['Jeżyk Józek', 'Jeżynka Ala', 'Jeż Leon'],
    fav: ['fantasy', 'comics', 'spooky'],
    b: '#e2c29a', l: '#f6e3c8', d: '#7a5640', n: '#4a3330',
  },
};
const JP_SPECIES = {
  tanuki: {
    emoji: '🦝',
    names: ['Tanuki Taro', 'Tanuki Hana', 'Tanuki Kenji'],
    fav: ['fairy', 'comics', 'fantasy'],
    b: '#a08a76', l: '#f1e6d6', d: '#54443a', n: '#3a2a28',
  },
  redpanda: {
    emoji: '🍁',
    names: ['Panda Mei', 'Panda Rin', 'Panda Sora'],
    fav: ['nature', 'romance', 'cooking'],
    b: '#cf5f33', l: '#fff4e6', d: '#3e2a24', n: '#3a2a28',
  },
  crane: {
    emoji: '🕊️',
    names: ['Żurawica Tsuru', 'Żuraw Akio', 'Żurawica Yuki'],
    fav: ['poetry', 'history', 'travel'],
    b: '#fbfaf5', l: '#ffffff', d: '#2f2b2b', n: '#e8b04a', wing: '#efece4',
  },
  macaque: {
    emoji: '🐒',
    names: ['Makak Haru', 'Makaczka Momo', 'Makak Daiki'],
    fav: ['travel', 'comics', 'crime'],
    b: '#a89887', l: '#f0a49b', d: '#7e6e60', n: '#b8645e',
  },
  shiba: {
    emoji: '🐕',
    names: ['Shiba Kuro', 'Shiba Aiko', 'Shiba Hachi'],
    fav: ['crime', 'cooking', 'fairy'],
    b: '#e39a52', l: '#fff6ea', d: '#b8733a', n: '#3a2a28',
  },
};
Object.assign(SPECIES, JP_SPECIES);

const SCARVES = ['#e2675f', '#6c9ee0', '#f0c04e', '#77bd6e', '#b889d4', '#f0956a', '#58bfb3'];

const REGIONS = [
  {
    id: 'forest',
    name: 'Polski las',
    emoji: '🌲',
    desc: 'Drewniana chatka wśród sosen. Lisy, króliki, misie, sowy i jeże.',
    species: ['fox', 'rabbit', 'bear', 'owl', 'hedgehog'],
    available: true,
  },
  {
    id: 'japan',
    name: 'Japonia',
    emoji: '🌸',
    desc: 'Tatami, lampiony i kwitnące wiśnie. Tanuki, pandy rude, żurawie, makaki i shiby.',
    species: ['tanuki', 'redpanda', 'crane', 'macaque', 'shiba'],
    available: true,
    price: 600,
    requires: { region: 'forest', bookcases: 4 },
  },
  { id: 'savanna', name: 'Sawanna', emoji: '🦒', desc: 'Ciepły piasek i plecione kosze.', available: false },
  { id: 'arctic', name: 'Arktyka', emoji: '❄️', desc: 'Śnieg za oknem i kominek.', available: false },
];

// Wystrój wnętrza w każdym regionie
const THEMES = {
  forest: {
    floorA: '#fbe8cb', floorB: '#f7dfbd', custA: '#f6d9b8', custB: '#f0cda8', grout: 'rgba(214,170,120,0.35)',
    wall: '#f6cdab', wallStripe: '#f9d8bb', wood: '#b9784a', wainscot: '#d9915a', panel: '#e6a46c',
    rug: ['#e98b7a', '#fbe2c2', '#f2b46a'], round: ['#9cc48a', '#b9d8a6'],
    roomA: '#f3d9cc', roomB: '#eed0c1', roomRug: ['#8f7cc4', '#e9e1f6'],
    curtain: '#e98b7a', window: 'forest', painting: 'forest', lights: 'bulbs', plant: 'leafy', outside: '#a8d48e',
  },
  japan: {
    floorA: '#e3dca8', floorB: '#d3cb92', custA: '#d9b68c', custB: '#cfab80', grout: 'rgba(140,100,60,0.3)',
    wall: '#f8f1df', wallStripe: '#f8f1df', wood: '#8a5a3a', wainscot: '#a8704a', panel: '#bd8558',
    rug: ['#3f5f8f', '#eef2f7', '#d9534f'], round: ['#d9534f', '#f6d6c6'],
    roomA: '#e3dca8', roomB: '#d3cb92', roomRug: ['#4f6b45', '#eef2e4'],
    curtain: '#d9534f', window: 'sakura', painting: 'fuji', lights: 'lanterns', plant: 'bamboo', outside: '#f6c6d4',
    tatami: true, shoji: true,
  },
};
function theme() {
  return THEMES[G.region] || THEMES.forest;
}

function newBranch() {
  const shelves = {};
  const stock = {};
  for (const c of BOOKCASE_SETS[0].cats) {
    shelves[c] = 1;
    stock[c] = BOOKS_PER_SHELF;
  }
  return { bookcases: 1, shelves, stock, slots: 3, cozy: 0 };
}

// Imię kotki w tekstach: {imie} – zwrot do kotki, {kot} – podmiot zdania
function withName(text) {
  const n = (typeof G !== 'undefined' && G.catName) || '';
  return text.replace(/\{imie\}/g, n || 'kotku').replace(/\{kot\}/g, n || 'Kotka');
}
function cleanName(raw) {
  const n = (raw || '').replace(/[<>&"{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
  return n ? n[0].toLocaleUpperCase('pl') + n.slice(1) : '';
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
