# Licence request: HŽ Putnički prijevoz (HŽPP) GTFS

Why: HŽPP publishes its timetable as GTFS (https://www.hzpp.hr/GTFS_files.zip, updated daily),
but states no licence, and the Croatian NAP lists it as "contractual arrangement, fee required"
(see PLAN.md, Slovenia findings; docs/europe-rail-data.md, Croatia). Croatia was built once and
dropped for that reason (local branch `local/hr-me-bg-backup`). Under licence-first, we build
nothing on it before HŽPP confirms reuse in writing.

**Contacts (from https://www.hzpp.hr/kontakt, 2026-11-19):**

- **To: pristupinfo@hzpp.hr** — HŽPP's officer for the right of access to information
  (https://www.hzpp.hr/en/right-of-access-to-information). In Croatia, reuse of information held by
  public authorities, including state-owned companies, is handled under the Act on the Right of
  Access to Information (Zakon o pravu na pristup informacijama), so a re-use request there is the
  formal channel.
- **Cc: informatika@hzpp.hr** (IT department; likely produces the GTFS). Alternative if there's no
  answer: pravna_sluzba@hzpp.hr (legal department).
- **From:** Simon Legner — fill in the sender address when sending.
- **Subject:** Zahtjev za ponovnu uporabu informacija: GTFS vozni red HŽPP-a / Request to re-use
  HŽPP's GTFS timetable

Send the Croatian text; the English version is the same message, for reference (or to include under
the Croatian one).

---

## Hrvatski

Poštovani,

zovem se Simon Legner i razvijam **zugx** (https://zugx.legner.me), besplatnu internetsku stranicu
bez oglasa za pregled željezničkih voznih redova: polasci po kolodvorima, popis vlakova, grafikoni
voznog reda i pretraživanje veza. Projekt je otvorenog koda (AGPL-3.0,
https://github.com/simon04/zugx) i trenutačno obuhvaća Austriju, Sloveniju i Španjolsku, uvijek na
temelju službenih otvorenih podataka svake zemlje.

Željeli bismo dodati Hrvatsku, i to na temelju vašeg voznog reda u formatu GTFS
(https://www.hzpp.hr/GTFS_files.zip) — to bi bio prirodan nastavak Slovenije (Dobova – Zagreb,
Rijeka). Uz datoteku nismo pronašli licenciju ni uvjete korištenja, a na Nacionalnoj pristupnoj
točki skup podataka naveden je kao „ugovorni odnos, uz naknadu”. Stoga ovim putem podnosimo zahtjev
za ponovnu uporabu informacija.

Što bismo radili s podacima:

- iz GTFS-a izradili bismo popise kolodvora i vlakova (s danima prometovanja), polaske po
  kolodvorima, grafikone voznog reda po prugama i podatke za pretraživanje veza;
- te bismo podatke prikazivali na stranici, uz navođenje izvora („HŽ Putnički prijevoz”) i datuma
  podataka;
- izvedene datoteke (tekst, format TOML) objavili bismo u javnom repozitoriju projekta, kao i za
  ostale zemlje.

Naša pitanja:

1. Smijemo li na taj način ponovno upotrebljavati vaš GTFS, uključujući objavu izvedenih datoteka?
2. Pod kojom licencijom? Otvorena licencija, primjerice CC BY 4.0 ili Otvorena dozvola Republike
   Hrvatske, bila bi idealna; za Španjolsku podatke Renfea koristimo pod CC BY 4.0.
3. Ako je ponovna uporaba moguća samo uz ugovor ili naknadu: koji su uvjeti?
4. Kakvo navođenje izvora želite (tekst i, ako je potrebno, poveznica)?

Pisani odgovor (dovoljan je odgovor na ovu e-poruku) bio bi idealan, kako bismo ga mogli
dokumentirati uz izvor podataka. Rado ćemo odgovoriti na sva pitanja.

S poštovanjem,
Simon Legner
zugx — https://zugx.legner.me

---

## English

Dear Sir or Madam,

my name is Simon Legner and I develop **zugx** (https://zugx.legner.me), a free, ad-free website
for browsing train timetables — departure boards, a train index, graphic timetables and a journey
search. The project is open source (AGPL-3.0, https://github.com/simon04/zugx); it currently covers
Austria, Slovenia and Spain, always from each country's official open data.

We would like to add Croatia using your GTFS timetable (https://www.hzpp.hr/GTFS_files.zip) — a
natural continuation of Slovenia (Dobova – Zagreb, Rijeka). We found no licence or terms of use with
the file, and the National Access Point lists the dataset as "contractual arrangement, fee
required". So we hereby submit a request to re-use the information.

What we would do with the data:

- derive from the GTFS lists of stations and trains (with their running days), departure plans per
  station, graphic timetables per line, and data for the journey search;
- show this on the website, crediting the source ("HŽ Putnički prijevoz") and the date of the
  data;
- publish the derived files (text, TOML format) in the project's public repository, as we do for
  the other countries.

Our questions:

1. May we re-use your GTFS in this way, including publishing the derived files?
2. Under which licence? An open licence such as CC BY 4.0 or the Open Licence of the Republic of
   Croatia would be ideal; for Spain we use Renfe's data under CC BY 4.0.
3. If re-use is only possible under a contract or for a fee: what are the terms?
4. What attribution would you like (wording and, if any, link)?

A written answer (a reply to this e-mail is enough) would be great, so that we can document it
next to the data source. We are happy to answer any questions.

Kind regards,
Simon Legner
zugx — https://zugx.legner.me
