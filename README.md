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

## Statystyki odwiedzin (Umami)

Gra może wysyłać anonimowe statystyki do [Umami Cloud](https://cloud.umami.is) (darmowy plan, bez ciasteczek, bez danych osobowych). Panel pokazuje liczbę odwiedzających, czas wizyty, kraje i urządzenia.

1. Załóż konto na cloud.umami.is → **Add website** → wpisz adres gry.
2. Skopiuj **Website ID** i wklej go w `js/stats.js` w `UMAMI_WEBSITE_ID`.
3. Wypchnij zmianę. Dopóki ID jest puste, nic nie jest wysyłane. Na `localhost` statystyki też są wyłączone.

Otwarta i widoczna karta z grą co minutę wysyła zdarzenie „gra trwa”, dzięki czemu „Czas wizyty” w panelu pokazuje faktyczny czas grania. Dodatkowo w zakładce **Events** widać „start gry” (nowa / kontynuacja) oraz „koniec dnia” z numerem dnia, czyli jak daleko gracze dochodzą.

## Konta graczy (Supabase)

Gracz może się zalogować adresem e-mail (bez hasła: dostaje kod w mailu) i grać tą samą kotką na telefonie i na komputerze. Postęp zapisuje się w przeglądarce jak wcześniej, a po zalogowaniu kopiuje się też na konto. Dopóki nic nie jest skonfigurowane, gra działa jak dawniej, bez kont.

Jak to działa:
- Po zalogowaniu na urządzeniu, które nie ma jeszcze gry, wczytuje się gra z konta.
- Jeśli na urządzeniu jest inna gra niż na koncie, gracz wybiera, którą zachować.
- Postęp wysyła się na konto do 2 s po każdym zapisie i przy zamknięciu karty. Gdy gracz wraca do karty, a na innym urządzeniu jest nowszy postęp, gra go wczytuje.
- Bez internetu (albo gdy Supabase nie odpowiada przez 6 s) gra działa lokalnie.
- Gracz może się wylogować albo usunąć konto razem z zapisem na koncie (RODO).

Konfiguracja (jednorazowo):
1. Załóż darmowy projekt na supabase.com (region EU, np. Frankfurt).
2. **SQL Editor → New query**: wklej `supabase/schema.sql` → **Run**.
3. **Authentication → URL Configuration → Site URL**: adres gry.
4. **Authentication → Emails → Templates → Magic Link**: w treści maila wstaw kod `{{ .Token }}`, np. „Twój kod do Kociej Biblioteki: {{ .Token }}”.
5. **Authentication → Emails → SMTP Settings**: podłącz własny serwer pocztowy (np. darmowy plan Resend albo Brevo). Wbudowana poczta Supabase wysyła maile tylko do członków zespołu projektu i ma bardzo niski limit, więc bez tego gracze nie dostaną kodu.
6. **Project Settings → API**: skopiuj *Project URL* i klucz *anon public* do `js/cloud.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). Klucz `anon` jest publiczny z założenia, a dane chroni RLS. Nigdy nie wklejaj klucza `service_role`.

Listę kont graczy widzisz w panelu Supabase: **Authentication → Users**.

Uwaga: darmowy projekt Supabase zostaje uśpiony po tygodniu bez ruchu. Gra działa wtedy lokalnie, a projekt wznowisz jednym kliknięciem w panelu.

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
- `js/stats.js`: anonimowe statystyki odwiedzin (Umami)
- `js/cloud.js`: konta graczy i zapis w chmurze (Supabase); `js/vendor/`: biblioteka supabase-js 2.118.0 (MIT)
- `supabase/schema.sql`: tabela zapisów z RLS i funkcja usuwania konta
- `js/shop.js`, `js/ui.js`: sklep i interfejs
- `js/audio.js`: dźwięki i muzyka (Web Audio, bez plików)
- `js/game.js`: pętla gry, kamera, zapis
