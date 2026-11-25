# Licence request: Trenitalia NeTEx on the Italian NAP (CCISS)

Why: Trenitalia's national static timetable ("OAP Trenitalia – NeTEx Livello 1", NAP dataset 1077621) is downloadable anonymously. The NAP pages show no licence, but the file's record in the
page metadata (asset 1080596, hidden field "Licenza") says **"No licence – No contract"**. That
means no licence agreement or contract is required, but it grants no rights explicitly (unlike
CC BY) and says nothing on redistributing derived data or attribution (see
docs/europe-rail-data.md, Italy). Under licence-first, we build nothing on it before the data owner
confirms in writing that this value allows our reuse.

Two messages: the main one to **Trenitalia** (data owner, decides the licence) and a short one to
the **NAP / CCISS** (operator of the access point under Reg. 2017/1926 and 2024/490: whether the
NAP has general reuse terms, and who the licensor of an operator dataset is).

**Contacts (looked up 2026-11-19, each from the page given):**

- **Trenitalia: redazioneintreno@trenitalia.it.** The e-mail the NAP lists for the data supplier
  "OAP Trenitalia" (https://www.cciss.it/nap/mmtis/public/catalog/Organisation), so the mailbox
  behind the dataset; the name suggests an editorial team, so ask them to forward it if needed.
  No PEC of Trenitalia S.p.A. is published (FS Italiane's contact page points to Trenitalia's
  contact page, which has none). Not for this: protezionedati@trenitalia.it (data protection
  officer, personal data only), fatturazioneonline@trenitalia.it (invoicing).
- **NAP / CCISS: div4.dgssa@mit.gov.it** (Division 4 of MIT's Direzione Generale per la Sicurezza
  Stradale e l'Autotrasporto, which runs the CCISS), PEC **dg.ssa-div4@pec.mit.gov.it**; from
  https://www.cciss.it/web/cciss/contatti. Not NAP-specific: the NAP pages list no contact of
  their own.
- From: Simon Legner — fill in the sender address when sending.

Send the Italian text; the English version is the same message, for reference (or to include under
the Italian one).

---

## 1. To Trenitalia

**Oggetto:** Richiesta di licenza: riutilizzo dei dati NeTEx Trenitalia pubblicati sul NAP
(dataset 1077621) / Licence for reusing Trenitalia's NeTEx timetable

### Italiano

Gentili Signore e Signori,

mi chiamo Simon Legner e sviluppo **zugx** (https://zugx.legner.me), un sito gratuito e senza
pubblicità per consultare gli orari ferroviari: tabelloni delle partenze, indice dei treni, orari
grafici e ricerca di collegamenti. Il progetto è open source (AGPL-3.0,
https://github.com/simon04/zugx) e copre attualmente Austria, Germania, Slovenia e
Spagna, sempre a partire dai dati aperti ufficiali di ciascun paese.

Vorremmo aggiungere l'Italia utilizzando l'orario programmato di Trenitalia pubblicato sul Punto di
Accesso Nazionale (NAP, CCISS) come "OAP Trenitalia – NeTEx Livello 1"
(https://www.cciss.it/nap/mmtis/public/catalog/Dataset/1077621). Il file è scaricabile
liberamente e nei metadati della risorsa sul NAP (asset 1080596) il campo "Licenza" riporta
"No licence – No contract". Non è però una licenza esplicita e non dice nulla sulla pubblicazione di
dati derivati né sull'attribuzione. Per questo, prima di utilizzare i dati, vi chiediamo una
conferma.

Cosa faremmo con i dati:

- ricavare dal file NeTEx elenchi di stazioni e di treni (con i giorni di circolazione), quadri
  delle partenze per stazione, orari grafici per linea e dati per la ricerca di collegamenti;
- mostrare queste informazioni sul sito, citando la fonte ("Trenitalia") e la data dei dati;
- pubblicare i file derivati (testo, formato TOML) nel repository pubblico del progetto, come
  facciamo per gli altri paesi.

Le nostre domande:

1. Confermate che l'indicazione "No licence – No contract" significa che possiamo riutilizzare i
   dati NeTEx di Trenitalia in questo modo, inclusa la pubblicazione dei file derivati?
2. Se preferite una licenza esplicita, una licenza aperta come la CC BY 4.0 sarebbe ideale: è
   quella con cui la Regione Liguria pubblica i dati Trenitalia del proprio territorio, e con cui
   utilizziamo i dati di Renfe per la Spagna.
3. Quale forma di attribuzione desiderate (testo ed eventuale link)?

Una risposta scritta (basta una risposta a questa e-mail) sarebbe ideale, così da poterla
documentare accanto alla fonte dei dati. Restiamo a disposizione per qualsiasi chiarimento.

Cordiali saluti,
Simon Legner
zugx — https://zugx.legner.me

### English

Dear Sir or Madam,

my name is Simon Legner and I develop **zugx** (https://zugx.legner.me), a free, ad-free website
for browsing train timetables — departure boards, a train index, graphic timetables and a journey
search. The project is open source (AGPL-3.0, https://github.com/simon04/zugx); it
currently covers Austria, Germany, Slovenia and Spain, always from each country's official open data.

We would like to add Italy using Trenitalia's planned timetable published on the National Access
Point (NAP, CCISS) as "OAP Trenitalia – NeTEx Livello 1"
(https://www.cciss.it/nap/mmtis/public/catalog/Dataset/1077621). The file can be downloaded
freely, and in the NAP's metadata of the file (asset 1080596) the field "Licence" says "No
licence – No contract". This is not an explicit licence, though, and says nothing on publishing
derived data or on attribution. So before using the data we would like to ask you to confirm.

What we would do with the data:

- derive from the NeTEx file lists of stations and trains (with their running days), departure
  plans per station, graphic timetables per line, and data for the journey search;
- show this on the website, crediting the source ("Trenitalia") and the date of the data;
- publish the derived files (text, TOML format) in the project's public repository, as we do for
  the other countries.

Our questions:

1. Do you confirm that "No licence – No contract" means we may reuse Trenitalia's NeTEx data in
   this way, including publishing the derived files?
2. If you prefer an explicit licence, an open licence such as CC BY 4.0 would be ideal: Regione
   Liguria publishes Trenitalia's data for its region under it, and we use Renfe's data for Spain
   under it.
3. What attribution would you like (wording and, if any, link)?

A written answer (a reply to this e-mail is enough) would be great, so that we can document it
next to the data source. We are happy to answer any questions.

Kind regards,
Simon Legner
zugx — https://zugx.legner.me

---

## 2. To the NAP / CCISS

**Oggetto:** NAP MMTIS: condizioni di riutilizzo dei dataset (es. Trenitalia NeTEx, dataset 1077621) / NAP MMTIS: reuse terms of the datasets

### Italiano

Gentili Signore e Signori,

sviluppo **zugx** (https://zugx.legner.me), un sito gratuito, senza pubblicità e open source
(https://github.com/simon04/zugx) per consultare gli orari ferroviari, e vorremmo utilizzare
l'orario programmato di Trenitalia pubblicato sul NAP ("OAP Trenitalia – NeTEx Livello 1",
https://www.cciss.it/nap/mmtis/public/catalog/Dataset/1077621).

Sulle pagine del NAP non è visibile una licenza; solo nei metadati della risorsa (asset 1080596)
il campo "Licenza" riporta "No licence – No contract". Potreste indicarci:

1. che cosa significa "No licence – No contract" per il riutilizzo: i dati possono essere
   riutilizzati e ridistribuiti liberamente, anche come dati derivati?
2. se il NAP prevede condizioni generali di riutilizzo per i dataset pubblicati, oppure se queste
   sono stabilite da ciascun fornitore;
3. se è previsto di mostrare la licenza sulle pagine dei dataset.

Abbiamo scritto anche a Trenitalia. Vi ringrazio per l'attenzione.

Cordiali saluti,
Simon Legner
zugx — https://zugx.legner.me

### English

Dear Sir or Madam,

I develop **zugx** (https://zugx.legner.me), a free, ad-free and open-source
(https://github.com/simon04/zugx) website for browsing train timetables, and we would like to use
Trenitalia's planned timetable published on the NAP ("OAP Trenitalia – NeTEx Livello 1",
https://www.cciss.it/nap/mmtis/public/catalog/Dataset/1077621).

The NAP pages show no licence; only the file's metadata (asset 1080596) has the field "Licence"
with "No licence – No contract". Could you tell us:

1. what "No licence – No contract" means for reuse: may the data be reused and redistributed
   freely, also as derived data?
2. whether the NAP has general reuse terms for the published datasets, or whether each supplier
   sets its own;
3. whether the licence is meant to be shown on the dataset pages.

We have written to Trenitalia as well. Thank you for your help.

Kind regards,
Simon Legner
zugx — https://zugx.legner.me
