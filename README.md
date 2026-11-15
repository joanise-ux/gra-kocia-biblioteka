# Kocia Biblioteka 🐾📚

Przytulna gra w przeglądarce. Jesteś trzykolorową kotką, która prowadzi bibliotekę z księgarnią. Leśni (a potem japońscy) goście przychodzą kupić albo wypożyczyć książkę, a Ty przynosisz im właściwą z szafy.

## Jak grać

- **Komputer:** `WASD` / strzałki to chodzenie, `E` / `Spacja` to akcja (otwórz szafę, podaj książkę, weź zwrot).
- **Telefon:** joystick po lewej, przycisk 🐾 po prawej.
- Dymek gościa pokazuje kolor książki (kategorię) oraz „kup” albo „pożycz”. Nikt się nie spieszy.
- Na koniec dnia możesz kupić ulepszenia: szybkie łapki, torbę na książki, nowe szafy i półki, większą ladę, przytulny kącik.
- Kotka bawi się też w sali: podejdź i naciśnij `E` przy fotelu (siada, a po chwili zasypia), przy ścianie z lampkami (łapie je łapką), przy kwiatku (podlewa go, kwiatek zakwita, a za pierwsze podlanie danego dnia dostajesz 💗) albo przy stoliku z książką i świeczką (czyta i przewraca strony). Ruch kończy zabawę. Na podłodze leży też kłębek wełny: pacnij go `E` albo popchnij, idąc, a potoczy się i odbije od ścian, zostawiając nitkę.
- **Czytelnia dla stałych klientów** (do kupienia w sklepie): gość obsłużony 5 razy dostaje ⭐ (na karcie zbiera gwiazdki ★★☆☆☆) i zostaje stałym klientem. Tylko przed nimi otwiera się furtka w barierce. W czytelni siadają w fotelach, czytają, a wychodząc zostawiają napiwek i 💗. Kotka może się z każdym przywitać (`E`, +💗). Gdy czytelnik pokazuje ☕, kotka nalewa herbatkę z wózka w kącie czytelni i mu ją zanosi: czyta wtedy dłużej i zostawia większy napiwek.
- **Karta stałych klientów** (przycisk ⭐ Stali, klawisz `K` albo szafka z kartoteką w czytelni): kto ile razy był, ile brakuje do ⭐, co lubi czytać i ile wypił herbatek.
- Mapę świata otworzysz przyciskiem 🗺️ u góry, klawiszem `M` albo kotką: podejdź do mapy na prawej ścianie i naciśnij `E`. `E` lub `Esc` ją zamyka.
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
- `js/yarn.js`: kłębek wełny do turlania
- `js/customers.js`: goście
- `js/shop.js`, `js/ui.js`: sklep i interfejs
- `js/audio.js`: dźwięki i muzyka (Web Audio, bez plików)
- `js/game.js`: pętla gry, kamera, zapis
