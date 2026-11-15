# Kocia Biblioteka 🐾📚

Przytulna gra w przeglądarce. Jesteś trzykolorową kotką, która prowadzi bibliotekę z księgarnią. Leśni (a potem japońscy) goście przychodzą kupić albo wypożyczyć książkę, a Ty przynosisz im właściwą z szafy.

## Jak grać

- **Komputer:** `WASD` / strzałki to chodzenie, `E` / `Spacja` to akcja (otwórz szafę, podaj książkę, weź zwrot).
- **Telefon:** joystick po lewej, przycisk 🐾 po prawej.
- Dymek gościa pokazuje kolor książki (kategorię) oraz „kup” albo „pożycz”. Nikt się nie spieszy.
- Na koniec dnia możesz kupić ulepszenia: szybkie łapki, torbę na książki, nowe szafy i półki, większą ladę, przytulny kącik.
- Kotka bawi się też w sali: podejdź i naciśnij `E` przy fotelu (siada, a po chwili zasypia), przy ścianie z lampkami (łapie je łapką), przy kwiatku (podlewa go, a kwiatek zakwita) albo przy stoliku z książką i świeczką (czyta i przewraca strony). Ruch kończy zabawę.
- Na mapie świata otwierasz nowe filie. Japonia otwiera się po postawieniu wszystkich szaf w Polskim lesie.

## Uruchomienie lokalne

To statyczna strona bez budowania. Wystarczy dowolny serwer plików, np.:

```bash
python3 -m http.server 8000
```

i otwórz http://localhost:8000.

## Wdrożenie na Vercel

Na vercel.com: **Add New → Project →** wybierz to repozytorium → Framework: *Other*, bez komendy build → **Deploy**. Każdy push na `main` sam zaktualizuje grę.

## Struktura

- `index.html`, `style.css`: strona i wygląd interfejsu
- `js/data.js`: kategorie, ulepszenia, zwierzęta, regiony i motywy
- `js/art.js`: grafika rysowana wektorowo na canvasie
- `js/map.js`: układ sali, szafy, tło
- `js/player.js`, `js/touch.js`: kotka, klawiatura i sterowanie dotykowe
- `js/activities.js`: zabawy kotki z otoczeniem (fotel, lampki, kwiatki, czytanie)
- `js/customers.js`: goście
- `js/shop.js`, `js/ui.js`: sklep i interfejs
- `js/audio.js`: dźwięki i muzyka (Web Audio, bez plików)
- `js/game.js`: pętla gry, kamera, zapis
