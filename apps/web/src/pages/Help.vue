<script setup lang="ts">
// End-user help: all views and features, keyboard shortcuts, where the data comes from.
// German, English, Slovenian and Spanish (Italian UI shows the English text).
import { useI18n } from "../i18n/index.ts";
const { locale } = useI18n();
</script>

<template>
  <article class="legal help max-w-3xl">
    <template v-if="locale === 'de'">
      <h1>Hilfe</h1>
      <p>
        zugx zeigt Fahrplan- und Echtzeitdaten der Züge in Österreich, Deutschland, Slowenien und
        Spanien – schnell, kompakt und am Handy wie am Desktop. Diese Seite erklärt alle Ansichten,
        die Bedienung und woher die Daten stammen.
      </p>
      <nav aria-label="Inhalt" class="toc">
        <a href="#suche">Suche &amp; Verbindungen</a> · <a href="#abfahrten">Abfahrtstafel</a> ·
        <a href="#zuglauf">Zuglauf</a> · <a href="#zuege">Züge</a> · <a href="#radar">Radar</a> ·
        <a href="#bildfahrplan">Bildfahrplan</a> · <a href="#vzg">VzG-Grafik</a> ·
        <a href="#netzgrafik">Netzgrafik</a> · <a href="#stoerungen">Störungen</a> ·
        <a href="#tasten">Tastenkürzel</a> · <a href="#daten">Daten &amp; Quellen</a> ·
        <a href="#grenzen">Grenzen</a>
      </nav>

      <h2 id="navigation">Menü &amp; Live-Schalter</h2>
      <p>
        Das Menü zeigt alles mit einem Klick: zuerst Suche, Radar und Störungen (immer Echtzeit,
        roter Punkt ●), dann Bahnhöfe und Züge, dann Bildfahrplan und Netzgrafik (Fahrplan), dann
        Strecken und Infrastrukturnetzkarte. Der Schalter <strong>● Live</strong> rechts oben (Taste
        <kbd>e</kbd>) wählt, wo eine Seite beides hat, zwischen Echtzeit und Fahrplan: beim Bahnhof
        Abfahrtstafel oder Abfahrtsplan, im Bildfahrplan die Echtzeit-Überlagerung, und in der
        Suche: mit Live aus werden Verbindungen ohne Server direkt im Browser aus dem ÖBB-Fahrplan
        berechnet (Bahn, die nächsten Tage, ohne Verspätungen). Die Wahl wird gemerkt. Die
        <strong>Länderauswahl</strong> (AT/DE/SI/ES) bestimmt, welches Landes Züge, Bildfahrpläne,
        Strecken, Netzkarte und Bahnhöfe gezeigt werden; Suche und Verbindungen umfassen alle
        Länder. Für Deutschland gibt es Echtzeit nur teilweise (vor allem Fernverkehr und Bayern);
        für Slowenien und Spanien gibt es keine Echtzeit, dort ist der Live-Schalter aus.
        Schnellzugriff (<kbd>⌘K</kbd>) und Roh-JSON (<kbd>d</kbd>) stehen in der Fußzeile.
      </p>

      <h2 id="suche">Suche &amp; Verbindungen</h2>
      <p>
        Auf der Startseite Abfahrts- und Zielbahnhof eingeben (Vorschläge erscheinen beim Tippen,
        aus dem eingebauten Bahnhofsverzeichnis), optional Zeit und „über“. Ohne Ziel öffnet sich
        die Abfahrtstafel des Bahnhofs.
      </p>
      <ul>
        <li>
          <strong>Zeitleiste</strong>: jede Verbindung als Balken, Teilstrecken in der Farbe des
          Zuges, Umstiegszeiten dazwischen (knappe Umstiege hervorgehoben); Verspätungen und
          Ausfälle sind markiert. Alternativ als <strong>Tabelle</strong>.
        </li>
        <li>
          <strong>Früher / Später</strong> lädt weitere Verbindungen; ankreuzen und
          <strong>Vergleichen</strong> stellt mehrere Verbindungen nebeneinander.
        </li>
        <li>
          Ein Klick öffnet die Details: alle Halte, Bahnsteige, Echtzeit, Hinweise; „Was, wenn ich
          den Anschluss verpasse?“ sucht die nächste Möglichkeit ab dem Umstiegsbahnhof.
          Verbindungen lassen sich teilen und in den Kalender eintragen.
        </li>
      </ul>

      <h2 id="abfahrten">Abfahrtstafel</h2>
      <p>
        Abfahrten bzw. Ankünfte eines Bahnhofs mit Echtzeit: Verspätung, Bahnsteig (Bahnsteigwechsel
        hervorgehoben), Ausfälle und Hinweise. Filter nach Verkehrsmittel (z. B. nur Fernverkehr),
        „Früher / Später“ blättert, die Liste aktualisiert sich automatisch. Große Bahnhöfe wie Wien
        Hbf führen auch Straßenbahn und Bus – diese lassen sich über die Filter einblenden. Der
        Stern merkt den Bahnhof als Favorit; der Wikidata-Link führt zum Bahnhof auf Wikidata.
      </p>
      <p>
        <strong>Abfahrtsplan</strong> (Link auf der Abfahrtstafel): alle Abfahrten eines Tages aus
        dem Jahresfahrplan, nach Stunden in Spalten wie der Aushang im Bahnhof – mit Zug, Ziel,
        Unterwegshalten (verlinkt) und Bahnsteig; Datum wählbar (←/→). Ohne Echtzeit.
      </p>

      <h2 id="zuglauf">Zuglauf</h2>
      <p>
        Ein Zug mit allen Halten, geplanten und tatsächlichen Zeiten, Bahnsteigen,
        Verspätungsverlauf und Karte. Erreichbar über einen Klick auf einen Zug oder direkt per
        Adresse, z. B.
        <code>/train/RJX-162</code>, mit <code>?d=2026-11-13</code> für ein anderes Datum. Bei
        Verspätung steht die erwartete Ist-Zeit unter der Soll-Zeit. Zeichen wie im ÖBB-Kursbuch: ◗
        hält nur zum Einsteigen, ◖ hält nur zum Aussteigen, | kein Halt zum Ein- oder Aussteigen.
      </p>

      <h2 id="bahnhoefe">Bahnhöfe</h2>
      <p>
        Alle Bahnhöfe von A bis Z mit dem ÖBB-Betriebsstellen-Kürzel (aus OpenStreetMap) und den
        dort haltenden Gattungen. Das Suchfeld filtert nach Name oder Kürzel, auch mehrere durch
        Komma oder Leerzeichen getrennt, ohne Groß-/Kleinschreibung („Kt, Vb, Vps“ oder „kt vb
        vps“); ein Bahnhof öffnet seinen Abfahrtsplan laut Fahrplan.
      </p>

      <h2 id="zuege">Züge (Zugindex)</h2>
      <p>
        Alle Züge des Fahrplanjahres im gewählten Land – Nummer, Name, Laufweg, Verkehrstage – zum
        Durchsuchen und Filtern nach Betreiber, Gattung, Bahnhof oder Datum. Die Verkehrstage
        stammen aus dem Jahresfahrplan.
      </p>

      <h2 id="radar">Radar</h2>
      <p>
        Live-Karte aller Züge im Kartenausschnitt, eingefärbt nach Verspätung oder Gattung; kleine
        Pfeile zeigen die Fahrtrichtung. Ein Klick auf einen Zug öffnet seinen Zuglauf seitlich. Die
        Positionen werden von der ÖBB-Fahrplanauskunft aus dem Fahrplan und den Echtzeitdaten
        berechnet – sie sind keine GPS-Positionen. Die „Bahnkarte“ blendet die Strecken der
        OpenRailwayMap ein.
      </p>
      <p>
        <strong>Zugteile</strong>: Vereinigte Züge (Nachtzüge, Railjets mit Flügelzug) stehen als
        ein Zug auf der Karte, z. B. „NJ 466 / EN 40462“ – der vermutlich betriebliche Zug zuerst
        (rein kommerzielle Nummern ab 40000 zuletzt, sonst die kleinere Nummer). Im Zuglauf wählt
        man den Zugteil per Klick auf sein Abzeichen. Der Kasten „Zugteile“ (auch auf der Zugseite)
        zeigt je Abschnitt, mit welchen Zügen vereinigt gefahren wird und – bei rein kommerziellen
        Nummern – den betrieblichen Zug (EN 40462: bis Salzburg EC 462, „ab hier NJ 466“). Grundlage
        sind die Angaben der ÖBB-Auskunft; welche Nummer im vereinigten Abschnitt betrieblich gilt,
        ist dort nicht immer erkennbar.
      </p>

      <h2 id="bildfahrplan">Bildfahrplan</h2>
      <p>
        Weg-Zeit-Diagramme für Strecken (die Fahrplanbilder der ÖBB und einige längere Korridore):
        waagrecht die Bahnhöfe nach Streckenkilometer, senkrecht die Zeit nach unten. Jeder Zug ist
        eine Linie in der Farbe seiner Gattung; steile Linien sind langsam, senkrechte Stücke sind
        Aufenthalte. Ein Klick auf einen Zug (im Diagramm oder in den Tabellen) öffnet seinen
        Zuglauf seitlich, Strg/⌘-Klick die ganze Zugseite. Die Farben folgen der Angebotsebene wie
        in der Fahrplanplanung üblich: RJX magenta, RJ rot, EC/IC braunrot, ICE dunkelgrau, IR und
        CJX violett, REX grün, R graublau, S blau, Nightjet nachtblau, private Fernverkehrsanbieter
        (WESTbahn, RegioJet) orange.
      </p>
      <ul>
        <li>
          Beliebiger Tag des Fahrplanjahres, Abschnitt und Richtung wählbar, Zeitfenster 1–24
          Stunden; Mausrad verschiebt die Zeit, Strg/⌘ + Mausrad zoomt. Datum und Uhrzeit bleiben
          beim Wechsel zu einem anderen Bildfahrplan erhalten.
        </li>
        <li>
          Fährt ein Zug ohne Halt durch, wird die Durchfahrtszeit geschätzt – gewichtet nach der
          zulässigen Geschwindigkeit (in langsamen Abschnitten wie dem Wienerwald später, auf
          schnellen früher).
        </li>
        <li>
          Darüberfahren zeigt Zugnummer und Laufweg, ein Klick den Zuglauf; ein Klick auf einen
          Bahnhof öffnet seine Abfahrtstafel; die Strecken-Links führen zur VzG-Grafik.
        </li>
        <li>
          <strong>Echtzeit</strong> (nur für heute): die tatsächlichen Fahrten aus der
          ÖBB-Fahrplanauskunft als kräftige Linien über dem Plan – durchgezogen bis jetzt,
          gestrichelt als Prognose, Punkte an gemeldeten Zeiten, die aktuelle Verspätung an der
          Jetzt-Linie. Der ersetzte Plan wird dünn und blass. Auch Züge, die in den Fahrplandaten
          fehlen (z. B. WESTbahn), erscheinen dann.
        </li>
        <li>
          <strong>Maßstab</strong> 1×/2×/4× streckt die Zeitachse (Tasten
          <kbd>+</kbd>/<kbd>−</kbd>). Am oberen Rand zeigen eine bzw. zwei dünne Linien, wo die
          Strecke ein- oder zweigleisig ist.
        </li>
        <li>
          <strong>Fahrplantabellen</strong> unter dem Diagramm, für beide Richtungen: wie im
          ÖBB-Kursbuch (Bahnhöfe als Zeilen, ein Zug je Spalte, „|“ = Durchfahrt; der Bahnhofsname
          öffnet den Abfahrtsplan des Tages, daneben die Nummern der dort abzweigenden
          Fahrplanbilder als Links; mit Echtzeit Verspätung und erwartete Zeit je Halt);
          <strong>Transponieren</strong> zeigt eine Zeile je Zug. Das ganze
          <a href="/kursbuch">Kursbuch</a> (alle Fahrplanbilder ab 100 für einen Tag, A4 mit
          Seitenzahlen) lässt sich als PDF drucken.
        </li>
        <li>
          <strong>Zweiter Bildschirm</strong>: Diagramm und Tabellen lassen sich in eigenen Fenstern
          öffnen; Tag, Uhrzeit, Abschnitt und der Zug unter dem Mauszeiger bleiben synchron.
        </li>
      </ul>
      <h3 id="planung">Planung</h3>
      <p>
        Unter dem Diagramm werten fünf Ansichten den gezeigten Fahrplan aus – für kürzere Umstiege,
        verlässlichere Züge auf eingleisigen Strecken und schnellere Fahrten:
      </p>
      <ul>
        <li>
          <strong>Knoten</strong>: für einen Bahnhof (Auswahl oder Klick auf den Namen im Diagramm)
          die Linien mit ihren üblichen Ankunfts- und Abfahrtsminuten und ihrem Takt, ob sie sich um
          eine Knotenminute treffen (Vollknoten :00, Halbknoten :30), die Symmetrieminute; dazu für
          jede Ankunft der erste Anschluss je Richtung (grün ≤ 10′, gelb ≤ 20′, rot länger) und
          knapp verpasste Anschlüsse. Der Mindestumstieg ist einstellbar. Mit „alle Linien“ kommen
          alle anderen Züge am Bahnhof aus der ÖBB-Fahrplanauskunft dazu (andere Strecken, WESTbahn
          …).
        </li>
        <li>
          <strong>Kreuzungen</strong>: wo sich Züge beider Richtungen neben eingleisigen Abschnitten
          begegnen – mit dem Puffer je Richtung (wie viel Verspätung des Gegenzugs abgefangen wird)
          und, bei Echtzeit, der zu erwartenden Folgeverspätung. Im Diagramm: eingleisige Abschnitte
          grau, Kreuzungen als Punkte, Begegnungen zwischen zwei Bahnhöfen als ✕ (oft eine Ausweiche
          ohne Personenhalt).
        </li>
        <li>
          <strong>Fahrzeitreserve</strong>: geplante Fahrzeit zwischen zwei Halten im Vergleich zur
          kürzest möglichen mit der zulässigen Geschwindigkeit (inkl. Anfahren und Bremsen) – je
          Abschnitt, Gattung und Richtung. Viel Reserve heißt Spielraum für schnellere Züge.
          Einstellbar: Anfahrbeschleunigung (Triebzug, lokbespannt), Bremsverzögerung, Regelzuschlag
          und die Schwelle für „viel Reserve“.
        </li>
        <li>
          <strong>Kapazität</strong>: die Sperrzeitentreppe – je Zug und Blockabschnitt (von
          Hauptsignal zu Hauptsignal, bei ETCS Level 2 von ETCS-Halttafel zu ETCS-Halttafel, aus
          OpenStreetMap) die Zeit, in der der Abschnitt für andere Züge gesperrt ist, im Diagramm
          als Kästchen; rot = Konflikt. Die Tabelle zeigt je Blockabschnitt die Belegung im
          Zeitfenster, die längste Sperrzeit und den Engpass. Einstellbar: Vorsignalabstand,
          Fahrstraßen- und Reaktionszeit, Auflösezeit, Zuglängen, Toleranz.
        </li>
        <li>
          <strong>Pünktlichkeit (Echtzeit)</strong>: wo Züge Zeit verlieren, je Abschnitt und Halt,
          aus den gemeldeten Echtzeiten. Gesammelt im eigenen Browser, solange Echtzeit läuft (7
          Tage).
        </li>
      </ul>
      <p class="muted">
        Grenzen: Kreuzungen, Fahrzeitreserve und Pünktlichkeit nur für Züge dieses Bildfahrplans;
        Ein-/ Zweigleisigkeit aus OpenStreetMap, Durchfahrtszeiten und Mindestfahrzeiten geschätzt.
      </p>

      <h2 id="vzg">VzG-Grafik</h2>
      <p>
        Zulässige Geschwindigkeiten entlang einer Strecke, angelehnt an das „Verzeichnis der örtlich
        zulässigen Geschwindigkeiten und Besonderheiten“ (VzG) der ÖBB: senkrecht der
        Streckenkilometer in Fahrtrichtung, daneben Bahnhöfe und Signale, die Kilometer der
        Geschwindigkeitswechsel, das Geschwindigkeitsband (Fahrtrichtung durchgezogen, Gegenrichtung
        strichpunktiert) und die Kurvenradien. Gleis (Regelgleis 1/2), Richtung und Maßstab sind
        wählbar; Darüberfahren zeigt Details zu Signalen, Abschnitten und Kurven.
      </p>
      <ul>
        <li>
          Alle ÖBB-Strecken nach Streckennummer und weitere Bahnen (z. B. Stubaitalbahn,
          Zillertalbahn, Lokalbahn Wien–Baden).
        </li>
        <li>
          <strong>Anschlussstrecken</strong>: an Knotenbahnhöfen führen Links („↗ 222 01“) zur
          VzG-Grafik der abzweigenden Strecke.
        </li>
        <li>
          <strong>⤓ SVG</strong> lädt die Grafik als eigenständige Datei mit Titel, Legende und
          Quellenangabe herunter – z. B. für Wikimedia Commons (Lizenz ODbL wie die
          OpenStreetMap-Daten).
        </li>
        <li>
          <strong>Übersicht</strong> (<code>/vzg</code>): alle Strecken mit Name, Von–Bis, ein-/
          zweigleisig, Länge, Bahnhöfen und Signalen; Filter nach Nummer („10101“ findet „101 01“),
          Name oder Bahnhof, sortierbar.
        </li>
        <li>Bahnhöfe mit ihrer <strong>Seehöhe</strong>, soweit in OpenStreetMap erfasst.</li>
        <li>
          <strong>Streckenband</strong>: die Strecke als schematisches Band wie in den
          Wikipedia-Streckendiagrammen – Bahnhöfe nach Art, Brücken und Tunnel mit Namen und Länge,
          Abzweige.
        </li>
        <li>
          <strong>Streckenprofil</strong> unter der Grafik: Länge, Bahnhöfe und Haltestellen,
          Höchst- und Durchschnittsgeschwindigkeit, Tunnel und Brücken, engster Kurvenradius,
          Elektrifizierung, Zugsicherung (ETCS/PZB), zweigleisiger Anteil, Spurweite, Seehöhen, Züge
          pro Tag und Anschlussstrecken.
        </li>
        <li>
          <strong>Streckenkarte</strong>: eine druck- und Wikipedia-taugliche Karte der Strecke mit
          Tunneln, Bahnhöfen (verlinkt zur Abfahrtstafel) und abzweigenden Strecken (verlinkt zu
          deren Karte); wahlweise nach zulässiger Geschwindigkeit eingefärbt und mit
          Streckenkilometern; als SVG herunterladbar.
        </li>
        <li>
          <strong>Infrastrukturnetzkarte</strong> (<code>/vzg/netz</code>): alle Strecken
          Österreichs, eingefärbt nach Geschwindigkeit, Elektrifizierung, ETCS, PZB, Gleisanzahl,
          Spurweite, Betreiber oder <strong>Züge pro Tag</strong> (Verkehrsstärke aus dem Fahrplan);
          mit Staats- und Landesgrenzen, für ganz Österreich oder ein einzelnes Bundesland.
          Darüberfahren zeigt die Werte, ein Klick öffnet die Streckenkarte; als SVG herunterladbar.
        </li>
        <li>
          Die Daten stammen aus OpenStreetMap, nicht aus dem amtlichen VzG: Bremswege, Neigungen und
          Besonderheiten fehlen, die Kurvenradien sind aus der Gleisgeometrie geschätzt.
        </li>
      </ul>

      <h2 id="netzgrafik">Netzgrafik</h2>
      <p>
        Der Taktfahrplan als Netz: Knoten mit ihren Ankunfts- und Abfahrtsminuten, Linien mit Takt
        und Fahrzeit, rekonstruiert aus dem Fahrplan eines Werktags, Samstags oder Sonntags. Lässt
        sich im Netzgrafik-Editor (Open Rail Association) öffnen oder als Datei exportieren.
      </p>

      <h2 id="stoerungen">Störungen</h2>
      <p>Aktuelle Störungs- und Baustellenmeldungen der ÖBB mit ihrem Gültigkeitszeitraum.</p>

      <h2 id="tasten">Tastenkürzel</h2>
      <p>
        Am Desktop: <kbd>?</kbd> zeigt alle Kürzel. Häufig: <kbd>/</kbd> Suche,
        <kbd>Strg/⌘ K</kbd> Befehlspalette, <kbd>j</kbd>/<kbd>k</kbd> nächste/vorige Zeile,
        <kbd>h</kbd>/<kbd>l</kbd> früher/später, <kbd>g</kbd> Start, <kbd>t</kbd> Züge,
        <kbd>r</kbd> Radar. Im Bildfahrplan <kbd>←</kbd>/<kbd>→</kbd> Tag, <kbd>↑</kbd>/<kbd>↓</kbd>
        zwei Stunden (mit Umschalt ein ganzes Fenster), <kbd>+</kbd>/<kbd>−</kbd> Maßstab,
        <kbd>n</kbd> jetzt.
      </p>

      <h2 id="daten">Daten &amp; Quellen</h2>
      <ul>
        <li>
          <strong>Echtzeit, Verbindungen, Abfahrten, Zugläufe, Radar, Störungen</strong>: direkt aus
          der ÖBB-Fahrplanauskunft (Scotty/HAFAS) – inoffizielle Schnittstelle, Anfragen gehen über
          zugx an die ÖBB.
        </li>
        <li>
          <strong>Jahresfahrplan</strong> (Bahnhofsverzeichnis, Zugindex, Bildfahrplan, Netzgrafik):
          Österreich –
          <a href="https://data.oebb.at/de/datensaetze~soll-fahrplan-gtfs~">ÖBB Open Data (GTFS)</a
          >, CC BY 4.0, regelmäßig aktualisiert; nur ÖBB (und einige Partner) – nicht WESTbahn, GKB,
          Raaberbahn u. a. Deutschland – DELFI e.V. (<a
            href="https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite"
            >opendata-oepnv.de</a
          >), CC BY 4.0. Slowenien – nationaler Fahrplan IJPP (<a href="https://www.nap.si/"
            >NAP Slovenija</a
          >), CC BY-SA 4.0. Spanien – Renfe Operadora (<a href="https://data.renfe.com/"
            >data.renfe.com</a
          >), CC BY 4.0.
        </li>
        <li>
          <strong
            >Strecken, Geschwindigkeiten, Signale, Kilometer, Ein-/Zweigleisigkeit, Grenzen</strong
          >
          (VzG-Grafik, Strecken- und Infrastrukturnetzkarte, Durchfahrtszeiten und Gleisanzahl im
          Bildfahrplan):
          <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap-Mitwirkende</a>, ODbL.
        </li>
        <li>
          <strong>Karten</strong>: OpenFreeMap, OpenStreetMap, OpenRailwayMap (Quellen in der
          Kartenecke).
        </li>
        <li>
          <strong>Wikidata</strong>: Links zu Bahnhöfen über DinoData, zu Strecken über die
          OpenStreetMap-Daten.
        </li>
      </ul>
      <p>
        Details zu Datenschutz und Verarbeitung: <RouterLink to="/privacy">Datenschutz</RouterLink>.
      </p>

      <h2 id="grenzen">Grenzen</h2>
      <p>
        zugx ist kein Angebot von ÖBB, SŽ, Renfe, DELFI oder DB; alle Angaben ohne Gewähr,
        verbindlich sind die Informationen des Verkehrsunternehmens. Radar-Positionen und
        Durchfahrtszeiten sind berechnet bzw. geschätzt; die VzG-Grafik ist nicht das amtliche VzG.
      </p>
    </template>

    <template v-else-if="locale === 'sl'">
      <h1>Pomoč</h1>
      <p>
        zugx prikazuje vozni red in podatke v realnem času za vlake v Avstriji, Nemčiji, Sloveniji
        in Španiji – hitro, pregledno, na telefonu in računalniku. Ta stran pojasnjuje vse poglede,
        kako jih uporabljati in od kod so podatki.
      </p>
      <nav aria-label="Vsebina" class="toc">
        <a href="#suche">Iskanje in povezave</a> · <a href="#abfahrten">Tabla odhodov</a> ·
        <a href="#zuglauf">Potek vlaka</a> · <a href="#zuege">Vlaki</a> ·
        <a href="#radar">Radar</a> · <a href="#bildfahrplan">Grafikon voznega reda</a> ·
        <a href="#vzg">Diagram hitrosti (VzG)</a> · <a href="#netzgrafik">Netzgrafik</a> ·
        <a href="#stoerungen">Motnje</a> · <a href="#tasten">Tipkovnica</a> ·
        <a href="#daten">Podatki in viri</a> · <a href="#grenzen">Omejitve</a>
      </nav>

      <h2 id="navigation">Meni, država in stikalo V živo</h2>
      <p>
        Meni prikazuje vse na en klik: najprej Iskanje, Radar in Motnje (vedno v realnem času, rdeča
        pika ●), nato Postaje in Vlake, nato grafikon voznega reda in Netzgrafik (vozni red), nato
        Proge in zemljevid infrastrukturnega omrežja. Stikalo <strong>● V živo</strong> zgoraj desno
        (tipka <kbd>e</kbd>) izbira med realnim časom in voznim redom, kjer stran ponuja oboje:
        tabla odhodov ali plakat odhodov za postajo, prikaz v realnem času v grafikonu voznega reda
        in iskanje: pri izklopljenem načinu V živo se povezave izračunajo v brskalniku iz voznega
        reda (železnica, naslednji dnevi, brez zamud). Nastavitev se zapomni. Izbirnik
        <strong>države</strong> (AT/DE/SI/ES) določa, katere države vlaki, grafikoni voznega reda,
        proge, zemljevid omrežja in postaje so prikazani; iskanje in povezave zajemajo vse države.
        Za Nemčijo so podatki v realnem času le delni (predvsem daljinski vlaki in Bavarska); za
        Slovenijo in Španijo ni podatkov v realnem času, zato je stikalo V živo tam izklopljeno.
        Hitri skok (<kbd>⌘K</kbd>) in surovi JSON (<kbd>d</kbd>) sta v nogi strani.
      </p>

      <h2 id="suche">Iskanje in povezave</h2>
      <p>
        Na začetni strani vnesite izhodišče in cilj (predlogi med tipkanjem, iz vgrajenega seznama
        postaj), po želji čas in »prek«. Brez cilja se odpre tabla odhodov.
      </p>
      <ul>
        <li>
          <strong>Časovnica</strong>: vsaka povezava kot pas, odseki v barvi vlaka, vmes časi
          prestopa (tesni so poudarjeni), označene zamude in odpovedi; ali kot
          <strong>tabela</strong>.
        </li>
        <li>
          <strong>Prej / Pozneje</strong> naloži več povezav; označite več povezav in jih
          <strong>primerjajte</strong> drugo ob drugi.
        </li>
        <li>
          Klik za podrobnosti: vsi postanki, tiri, realni čas, opombe; »Kaj če zamudim?« poišče
          naslednjo možnost s prestopne postaje. Povezave lahko delite ali dodate v koledar.
        </li>
      </ul>

      <h2 id="abfahrten">Tabla odhodov</h2>
      <p>
        Odhodi ali prihodi z realnim časom: zamuda, tir (spremembe poudarjene), odpovedi in opombe.
        Filtriranje po vrsti prevoza (npr. samo daljinski), listanje s »Prej / Pozneje«, seznam se
        samodejno osvežuje. Velike postaje, kot je Wien Hbf, prikazujejo tudi tramvaje in avtobuse –
        vklopite jih s filtri. Zvezdica shrani postajo med priljubljene; povezava na Wikipodatke
        odpre postajo na Wikipodatkih.
      </p>
      <p>
        <strong>Plakat odhodov</strong> (povezava na tabli odhodov): vsi odhodi dneva iz letnega
        voznega reda, po urah v stolpcih kot plakat na postaji – z vlakom, ciljem, naslednjimi
        postanki (povezanimi) in tirom; izberite datum (←/→). Brez realnega časa.
      </p>

      <h2 id="zuglauf">Potek vlaka</h2>
      <p>
        Vlak z vsemi postanki, načrtovanimi in dejanskimi časi, tiri, profilom zamude in
        zemljevidom. Kliknite vlak kjer koli ali odprite npr. <code>/train/RJX-162</code> (dodajte
        <code>?d=2026-11-13</code> za drug datum). Pri zamudi je pod načrtovanim časom prikazan
        pričakovani dejanski čas. Znaki kot v knjigi voznega reda ÖBB: ◗ samo vstop, ◖ samo izstop,
        | brez postanka za potnike.
      </p>

      <h2 id="bahnhoefe">Postaje</h2>
      <p>
        Vse postaje izbrane države od A do Ž z okrajšavo obratnega mesta (iz OpenStreetMap) in
        vrstami vlakov, ki tam ustavljajo. Filter išče po imenih in okrajšavah, tudi po več hkrati,
        ločenih z vejicami ali presledki, ne glede na velike in male črke (»Kt, Vb, Lj« ali »kt vb
        lj«); postaja odpre svoj plakat odhodov iz voznega reda.
      </p>

      <h2 id="zuege">Vlaki (seznam vlakov)</h2>
      <p>
        Vsi vlaki voznoredne dobe izbrane države – številka, ime, pot, dnevi vožnje – za iskanje in
        filtriranje po prevozniku, vrsti, postaji ali datumu.
      </p>

      <h2 id="radar">Radar</h2>
      <p>
        Zemljevid vseh vlakov v pogledu v živo, obarvanih po zamudi ali vrsti; male puščice kažejo
        smer. Kliknite vlak, da se njegov potek odpre v stranski plošči. Položaje izračuna
        načrtovalnik poti ÖBB iz voznega reda in podatkov v realnem času – niso položaji GPS.
        »Železniški zemljevid« doda tire iz OpenRailwayMap.
      </p>
      <p>
        <strong>Deli vlaka</strong>: spojeni vlaki (nočni vlaki, Railjeti z delom za drug cilj) so
        na zemljevidu prikazani kot en vlak, npr. »NJ 466 / EN 40462« – najprej verjetni obratovalni
        vlak (samo tržne številke od 40000 na koncu, sicer nižja številka). V poteku izberete del s
        klikom na njegovo oznako. Okvir »Deli vlaka« (tudi na strani vlaka) za vsak odsek navaja
        vlake, s katerimi vozi spojen, in – pri samo tržnih številkah – obratovalni vlak (EN 40462:
        EC 462 do Salzburga, »od tu NJ 466«). Na podlagi podatkov načrtovalnika poti ÖBB; katera
        številka je na spojenem odseku obratovalna, tam ni vedno razvidno.
      </p>

      <h2 id="bildfahrplan">Grafikon voznega reda (Bildfahrplan)</h2>
      <p>
        Diagrami čas–pot za proge (grafikoni voznega reda ÖBB, nekateri daljši koridorji in proge SŽ
        v Sloveniji): postaje vodoravno po kilometrih proge, čas navzdol. Vsak vlak je črta v barvi
        svoje vrste; strme črte so počasne, navpični deli so postanki. Kliknite vlak (v diagramu ali
        tabelah), da se njegov potek odpre v stranski plošči, Ctrl/⌘ + klik za celotno stran vlaka.
        Barve sledijo ravni ponudbe, kot je običajno pri načrtovanju voznega reda: RJX magenta, RJ
        rdeča, EC/IC rjavo-rdeča, ICE temno siva, IR in CJX vijolična, REX zelena, R sivo-modra, S
        modra, Nightjet nočno modra, zasebni daljinski prevozniki (WESTbahn, RegioJet) oranžna.
      </p>
      <ul>
        <li>
          Kateri koli dan voznoredne dobe, odsek in smer, časovno okno 1–24 ur; kolesce miške
          premika v času, Ctrl/⌘ + kolesce povečuje. Datum in čas ostaneta pri menjavi listov.
        </li>
        <li>
          Časi na postajah, kjer vlak pelje brez postanka, so ocenjeni in uteženi z dovoljeno
          hitrostjo (pozneje na počasnih odsekih, prej na hitrih).
        </li>
        <li>
          Pomaknite se nad vlak za številko in pot, kliknite za potek vlaka; postaja odpre svojo
          tablo odhodov; povezave prog odprejo diagram hitrosti.
        </li>
        <li>
          <strong>V živo</strong> (samo danes): dejanske poti iz načrtovalnika poti ÖBB, narisane
          krepko čez načrt – polna črta do zdaj, črtkano kot napoved, pike ob sporočenih časih,
          trenutna zamuda ob črti »zdaj«; nadomeščeni načrt postane tanek in bled. Prikazani so tudi
          vlaki, ki jih ni v podatkih voznega reda (npr. WESTbahn).
        </li>
        <li>
          <strong>Merilo</strong> 1×/2×/4× raztegne časovno os (tipki <kbd>+</kbd>/<kbd>−</kbd>).
          Ena ali dve tanki črti ob zgornjem robu kažeta enotirno ali dvotirno progo.
        </li>
        <li>
          <strong>Tabele voznega reda</strong> pod diagramom, za obe smeri: kot knjiga voznega reda
          ÖBB (postaje kot vrstice, vlak na stolpec, »|« = pelje skozi; ime postaje odpre njen
          plakat odhodov za ta dan, zraven pa številke listov, ki se tam odcepijo, kot povezave; pri
          vklopljenem realnem času zamuda in pričakovani čas na postanek);
          <strong>Zasukaj</strong> prikaže vrstico na vlak. Celotno
          <a href="/kursbuch">knjigo voznega reda</a> (vsi listi izbrane države za en dan, A4 s
          številkami strani) lahko natisnete kot PDF.
        </li>
        <li>
          <strong>Drugi zaslon</strong>: diagram in tabele se lahko odprejo v lastnih oknih; dan,
          čas, odsek in vlak pod kazalcem ostanejo usklajeni.
        </li>
      </ul>
      <h3 id="planning">Načrtovanje</h3>
      <p>
        Pod diagramom pet pogledov ovrednoti prikazani vozni red – za krajše prestope, zanesljivejše
        vlake na enotirnih progah in hitrejše vožnje:
      </p>
      <ul>
        <li>
          <strong>Vozlišče</strong>: za postajo (izberite jo ali kliknite njeno ime v diagramu)
          linije z običajnimi minutami prihoda in odhoda ter intervalom, ali se srečajo okoli minute
          vozlišča (polno vozlišče :00, polovično :30), simetrijska minuta; in za vsak prihod prva
          zveza po smeri (zeleno ≤ 10′, oranžno ≤ 20′, rdeče dlje) ter tesno zamujene zveze.
          Najkrajši čas prestopa je nastavljiv. Z »vse linije« pridejo iz načrtovalnika poti ÖBB
          tudi vsi drugi vlaki na postaji (druge proge, WESTbahn …).
        </li>
        <li>
          <strong>Križanja</strong>: kjer se vlaki obeh smeri srečajo ob enotirni progi – z rezervo
          v vsako smer (koliko zamude nasprotnega vlaka se absorbira) in s podatki v živo
          pričakovano preneseno zamudo. V diagramu: enotirna proga osenčena, križanja kot pike,
          srečanja med dvema postajama kot ✕ (pogosto izogibališče brez postanka za potnike).
        </li>
        <li>
          <strong>Rezerva voznega časa</strong>: načrtovani vozni čas med dvema postankoma v
          primerjavi z najkrajšim možnim pri dovoljeni hitrosti (vključno s speljevanjem in
          ustavljanjem) – po odseku, vrsti in smeri. Veliko rezerve pomeni prostor za hitrejše
          vlake. Nastavljivo: pospešek pri speljevanju (motorni vlak, z lokomotivo), zaviranje,
          običajni dodatek in prag za veliko rezerve.
        </li>
        <li>
          <strong>Zmogljivost</strong>: stopnice zasedenosti – za vsak vlak in prostorski odsek (od
          glavnega do glavnega signala, pri ETCS Level 2 od oznake ETCS do oznake ETCS, iz
          OpenStreetMap) čas, ko je odsek zaseden za druge vlake, narisan kot pravokotniki v
          diagramu; rdeče = konflikt. Tabela za vsak prostorski odsek prikaže zasedenost časovnega
          okna, najdaljši čas zasedenosti in ozko grlo. Nastavljivo: razdalja predsignala, čas
          postavitve vozne poti in reakcije, čas sprostitve, dolžine vlakov, toleranca.
        </li>
        <li>
          <strong>Točnost (v živo)</strong>: kje vlaki izgubljajo čas, po odseku in postanku, iz
          sporočenih časov v realnem času. Zbira se v vašem brskalniku, medtem ko teče V živo (7
          dni).
        </li>
      </ul>
      <p class="muted">
        Omejitve: križanja, rezerva voznega časa in točnost samo za vlake tega lista; enotirnost in
        dvotirnost iz OpenStreetMap, časi prevoza in najkrajši vozni časi so ocenjeni.
      </p>

      <h2 id="vzg">Diagram hitrosti (VzG)</h2>
      <p>
        Dovoljene hitrosti vzdolž proge po zgledu VzG ÖBB (seznam dovoljenih hitrosti): kilometri
        proge navzdol v smeri vožnje, postaje in signali, kilometri sprememb hitrosti, pas hitrosti
        (smer vožnje polna črta, nasprotna smer črta-pika) in polmeri lokov. Izberite tir (redni tir
        1/2), smer in merilo; za podrobnosti se pomaknite nad diagram.
      </p>
      <ul>
        <li>
          Vse proge ÖBB po številki proge in druge železnice (npr. Stubaitalbahn, Zillertalbahn,
          Lokalbahn Wien–Baden); v Sloveniji proge SŽ po njihovi številki (10, 20, 30 …).
        </li>
        <li>
          <strong>Priključne proge</strong>: na odcepnih postajah povezave (»↗ 222 01«) odprejo
          diagram druge proge.
        </li>
        <li>
          <strong>⤓ SVG</strong> prenese diagram kot samostojno datoteko z napisom, legendo in viri
          – npr. za Wikimedia Commons (licenca ODbL, kot podatki OpenStreetMap).
        </li>
        <li>
          <strong>Pregled</strong> (<code>/vzg</code>): vse proge z imenom, od–do,
          enotirno/dvotirno, dolžino, postajami in signali; filtriranje po številki (»10101« najde
          »101 01«), imenu ali postaji, razvrščanje.
        </li>
        <li>
          Postaje z njihovo <strong>nadmorsko višino</strong>, kjer je vpisana v OpenStreetMap.
        </li>
        <li>
          <strong>Shema proge</strong> (Streckenband): proga kot shematski pas kot na Wikipediji –
          postaje po vrsti, mostovi in predori z imenom in dolžino, odcepi.
        </li>
        <li>
          <strong>Profil proge</strong> pod diagramom: dolžina, postaje in postajališča, najvišja in
          povprečna hitrost, predori in mostovi, najožji lok, elektrifikacija, varovanje vlakov
          (ETCS/PZB), delež dvotirnosti, tirna širina, nadmorske višine, vlaki na dan in priključne
          proge.
        </li>
        <li>
          <strong>Zemljevid proge</strong>: zemljevid proge, primeren za tisk in Wikipedijo, s
          predori, postajami (povezanimi z njihovo tablo odhodov) in priključnimi progami
          (povezanimi z njihovim zemljevidom); po želji obarvan po dovoljeni hitrosti in s kilometri
          proge; za prenos kot SVG.
        </li>
        <li>
          <strong>Zemljevid infrastrukturnega omrežja</strong> (<code>/vzg/netz</code>): vse proge
          izbrane države, obarvane po hitrosti, elektrifikaciji, ETCS, PZB, številu tirov, tirni
          širini, upravljavcu ali <strong>vlakih na dan</strong> (gostota prometa iz voznega reda);
          z državno mejo (v Avstriji tudi z mejami zveznih dežel), za celo državo ali eno zvezno
          deželo. Pomaknite se nad progo za vrednosti, kliknite za zemljevid proge; za prenos kot
          SVG.
        </li>
        <li>
          Podatki iz OpenStreetMap, ne uradni VzG: brez zavornih poti, vzponov ali opomb; polmeri
          lokov so ocenjeni iz geometrije tira.
        </li>
      </ul>

      <h2 id="netzgrafik">Netzgrafik</h2>
      <p>
        Taktni vozni red kot omrežje: vozlišča z minutami prihoda in odhoda, linije s taktom in
        voznim časom, rekonstruirano iz voznega reda delavnika, sobote ali nedelje. Odprite ga v
        urejevalniku Netzgrafik-Editor (Open Rail Association) ali ga izvozite. Za zdaj samo za
        Avstrijo.
      </p>

      <h2 id="stoerungen">Motnje</h2>
      <p>Trenutna obvestila ÖBB o motnjah in gradbenih delih z obdobjem veljavnosti.</p>

      <h2 id="tasten">Bližnjice na tipkovnici</h2>
      <p>
        Na računalniku <kbd>?</kbd> prikaže vse bližnjice. Pogoste: <kbd>/</kbd> iskanje,
        <kbd>Ctrl/⌘ K</kbd> hitri skok, <kbd>j</kbd>/<kbd>k</kbd> naslednja/prejšnja vrstica,
        <kbd>h</kbd>/<kbd>l</kbd> prej/pozneje, <kbd>g</kbd> začetek, <kbd>t</kbd> vlaki,
        <kbd>r</kbd> radar. Grafikon voznega reda: <kbd>←</kbd>/<kbd>→</kbd> dan, <kbd>↑</kbd>/<kbd
          >↓</kbd
        >
        dve uri (Shift: celo okno), <kbd>+</kbd>/<kbd>−</kbd> merilo, <kbd>n</kbd> zdaj.
      </p>

      <h2 id="daten">Podatki in viri</h2>
      <ul>
        <li>
          <strong>Realni čas, povezave, table odhodov, poteki vlakov, radar, motnje</strong>:
          načrtovalnik poti ÖBB (Scotty/HAFAS) – neuradni vmesnik, zahteve gredo prek zugx do ÖBB.
        </li>
        <li>
          <strong>Voznoredna doba</strong> (seznam postaj, seznam vlakov, grafikon voznega reda,
          Netzgrafik): Avstrija –
          <a href="https://data.oebb.at/de/datensaetze~soll-fahrplan-gtfs~"
            >odprti podatki ÖBB (GTFS)</a
          >, CC BY 4.0, redno posodobljeno; samo ÖBB (in nekateri partnerji) – ne WESTbahn, GKB,
          Raaberbahn ipd. Nemčija – DELFI e.V. (<a
            href="https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite"
            >opendata-oepnv.de</a
          >), CC BY 4.0. Slovenija – nacionalni vozni red IJPP (<a href="https://www.nap.si/"
            >NAP Slovenija</a
          >), CC BY-SA 4.0. Španija – Renfe Operadora (<a href="https://data.renfe.com/"
            >data.renfe.com</a
          >), CC BY 4.0.
        </li>
        <li>
          <strong>Proge, omejitve hitrosti, signali, kilometri, enotirnost/dvotirnost, meje</strong>
          (diagram hitrosti, zemljevid proge in infrastrukturnega omrežja, časi prevoza in število
          tirov v grafikonu voznega reda):
          <a href="https://www.openstreetmap.org/copyright">© sodelavci OpenStreetMap</a>, ODbL.
        </li>
        <li>
          <strong>Zemljevidi</strong>: OpenFreeMap, OpenStreetMap, OpenRailwayMap (navedbe v kotu
          zemljevida).
        </li>
        <li>
          <strong>Wikipodatki</strong>: povezave do postaj prek DinoData, do prog prek podatkov
          OpenStreetMap.
        </li>
      </ul>
      <p>
        Varstvo zasebnosti in obdelava podatkov: <RouterLink to="/privacy">Zasebnost</RouterLink>.
      </p>

      <h2 id="grenzen">Omejitve</h2>
      <p>
        zugx ni storitev ÖBB, SŽ, Renfe, DELFI ali DB; brez jamstva, zavezujoče so informacije
        prevoznika. Položaji na radarju in časi prevoza so izračunani ali ocenjeni; diagram hitrosti
        ni uradni VzG.
      </p>
    </template>
    <template v-else-if="locale === 'es'">
      <h1>Ayuda</h1>
      <p>
        zugx muestra horarios y datos en tiempo real de los trenes en Austria, Alemania, Eslovenia y
        España – rápido, compacto, en el móvil y en el ordenador. Esta página explica todas las
        vistas, cómo usarlas y de dónde proceden los datos.
      </p>
      <nav aria-label="Índice" class="toc">
        <a href="#suche">Búsqueda y conexiones</a> · <a href="#abfahrten">Panel de salidas</a> ·
        <a href="#zuglauf">Recorrido del tren</a> · <a href="#zuege">Trenes</a> ·
        <a href="#radar">Radar</a> · <a href="#bildfahrplan">Gráfico de circulación</a> ·
        <a href="#vzg">Diagrama VzG</a> · <a href="#netzgrafik">Netzgrafik</a> ·
        <a href="#stoerungen">Incidencias</a> · <a href="#tasten">Teclado</a> ·
        <a href="#daten">Datos y fuentes</a> · <a href="#grenzen">Limitaciones</a>
      </nav>

      <h2 id="navigation">Menú, país e interruptor En directo</h2>
      <p>
        El menú muestra todo a un clic: primero Buscar, Radar e Incidencias (siempre en tiempo real,
        punto rojo ●), después Estaciones y Trenes, luego el gráfico de circulación y la Netzgrafik
        (horario) y, por último, Líneas y el mapa de la red de infraestructura. El interruptor
        <strong>● En directo</strong> arriba a la derecha (tecla <kbd>e</kbd>) elige entre tiempo
        real y horario donde una página ofrece ambos: panel de salidas o cartel de salidas de una
        estación, la superposición en tiempo real en el gráfico de circulación y la búsqueda: con En
        directo desactivado, las conexiones se calculan en el navegador a partir del horario de ÖBB
        (tren, los próximos días, sin retrasos). La elección se recuerda. El selector de
        <strong>país</strong> (AT/DE/SI/ES) determina de qué país se muestran los trenes, gráficos
        de circulación, líneas, mapa de la red y estaciones; la búsqueda y las conexiones abarcan
        todos los países. Para Alemania, el tiempo real es solo parcial (sobre todo larga distancia
        y Baviera); para Eslovenia y España no hay datos en tiempo real, por lo que allí En directo
        está desactivado. El salto rápido (<kbd>⌘K</kbd>) y el JSON en bruto (<kbd>d</kbd>) están en
        el pie de página.
      </p>

      <h2 id="suche">Búsqueda y conexiones</h2>
      <p>
        En la página de inicio introduzca origen y destino (sugerencias mientras escribe, a partir
        de la lista de estaciones integrada) y, opcionalmente, una hora y «por». Sin destino se abre
        el panel de salidas de la estación.
      </p>
      <ul>
        <li>
          <strong>Cronograma</strong>: cada conexión como una barra, los trayectos en el color del
          tren, los tiempos de transbordo entre ellos (los justos, resaltados), retrasos y
          supresiones marcados; o como <strong>tabla</strong>.
        </li>
        <li>
          <strong>Antes / Después</strong> carga más conexiones; marque varias y
          <strong>compárelas</strong> una junto a otra.
        </li>
        <li>
          Un clic abre los detalles: todas las paradas, vías, tiempo real, avisos; «¿Y si lo
          pierdo?» busca la siguiente opción desde la estación de transbordo. Las conexiones se
          pueden compartir o añadir al calendario.
        </li>
      </ul>

      <h2 id="abfahrten">Panel de salidas</h2>
      <p>
        Salidas o llegadas con tiempo real: retraso, vía (cambios resaltados), supresiones y avisos.
        Filtro por medio de transporte (p. ej. solo larga distancia), «Antes / Después» pasa de
        página, la lista se actualiza automáticamente. Las grandes estaciones como Wien Hbf también
        muestran tranvías y autobuses – actívelos con los filtros. La estrella guarda la estación
        como favorita; el enlace a Wikidata abre la estación en Wikidata.
      </p>
      <p>
        <strong>Cartel de salidas</strong> (enlace en el panel de salidas): todas las salidas de un
        día según el horario anual, por horas en columnas como el cartel de la estación – con tren,
        destino, paradas siguientes (enlazadas) y vía; fecha seleccionable (←/→). Sin tiempo real.
      </p>

      <h2 id="zuglauf">Recorrido del tren</h2>
      <p>
        Un tren con todas sus paradas, horas programadas y reales, vías, evolución del retraso y
        mapa. Haga clic en un tren en cualquier lugar o abra p. ej.
        <code>/train/RJX-162</code> (añada <code>?d=2026-11-13</code> para otra fecha). Si hay
        retraso, la hora real prevista aparece bajo la programada. Signos como en el Kursbuch de
        ÖBB: ◗ solo para subir, ◖ solo para bajar, | sin parada para viajeros.
      </p>

      <h2 id="bahnhoefe">Estaciones</h2>
      <p>
        Todas las estaciones del país seleccionado de la A a la Z con la abreviatura del punto de
        servicio (de OpenStreetMap) y las categorías de tren que paran allí. El filtro busca por
        nombres y abreviaturas, también varios a la vez separados por comas o espacios, sin
        distinguir mayúsculas y minúsculas («Kt, Vb, Vps» o «kt vb vps»); una estación abre su
        cartel de salidas según el horario.
      </p>

      <h2 id="zuege">Trenes (índice de trenes)</h2>
      <p>
        Todos los trenes del año de horario del país seleccionado – número, nombre, recorrido, días
        de circulación – para buscar y filtrar por operador, categoría, estación o fecha.
      </p>

      <h2 id="radar">Radar</h2>
      <p>
        Mapa en directo de todos los trenes en la vista, coloreados por retraso o categoría; unas
        pequeñas flechas indican el sentido de la marcha. Haga clic en un tren para abrir su
        recorrido en un panel lateral. Las posiciones las calcula el planificador de viajes de ÖBB a
        partir del horario y los datos en tiempo real – no son posiciones GPS. «Mapa ferroviario»
        añade las vías de OpenRailwayMap.
      </p>
      <p>
        <strong>Partes del tren</strong>: los trenes acoplados (trenes nocturnos, Railjets con una
        parte para otro destino) aparecen en el mapa como un solo tren, p. ej. «NJ 466 / EN 40462» –
        primero el probable tren operativo (los números solo comerciales a partir de 40000 al final;
        si no, el número menor). En el recorrido se elige la parte haciendo clic en su distintivo.
        El recuadro «Partes del tren» (también en la página del tren) indica por tramo con qué
        trenes circula acoplado y – en los números solo comerciales – el tren operativo (EN 40462:
        EC 462 hasta Salzburgo, «desde aquí NJ 466»). Se basa en los datos del planificador de
        viajes de ÖBB; qué número es el operativo en un tramo acoplado no siempre se aprecia en
        ellos.
      </p>

      <h2 id="bildfahrplan">Gráfico de circulación (Bildfahrplan)</h2>
      <p>
        Diagramas espacio–tiempo de líneas (los gráficos de horario de ÖBB, algunos corredores más
        largos y líneas de SŽ en Eslovenia): estaciones en horizontal según el punto kilométrico,
        tiempo hacia abajo. Cada tren es una línea del color de su categoría; las líneas empinadas
        son lentas, los tramos verticales son paradas. Haga clic en un tren (en el gráfico o en las
        tablas) para abrir su recorrido en un panel lateral, Ctrl/⌘ + clic para la página completa
        del tren. Los colores siguen el nivel de oferta, como es habitual en la planificación de
        horarios: RJX magenta, RJ rojo, EC/IC rojo pardo, ICE gris oscuro, IR y CJX violeta, REX
        verde, R azul pizarra, S azul, Nightjet azul noche, operadores privados de larga distancia
        (WESTbahn, RegioJet) naranja.
      </p>
      <ul>
        <li>
          Cualquier día del año de horario, tramo y sentido, una franja de 1–24 horas; la rueda del
          ratón desplaza en el tiempo, Ctrl/⌘ + rueda amplía. Fecha y hora se mantienen al cambiar
          de hoja.
        </li>
        <li>
          Las horas en las estaciones por las que un tren pasa sin parar son estimadas, ponderadas
          según la velocidad permitida (más tarde en los tramos lentos, antes en los rápidos).
        </li>
        <li>
          Pase el ratón por encima para ver número y recorrido, haga clic para el recorrido del
          tren; una estación abre su panel de salidas; los enlaces de línea abren el diagrama VzG.
        </li>
        <li>
          <strong>En directo</strong> (solo hoy): marchas reales del planificador de viajes de ÖBB,
          dibujadas en trazo grueso sobre lo programado – continuas hasta ahora, discontinuas como
          previsión, puntos en las horas comunicadas, el retraso actual en la línea de «ahora»; lo
          programado sustituido queda fino y tenue. También aparecen trenes que faltan en los datos
          del horario (p. ej. WESTbahn).
        </li>
        <li>
          <strong>Escala</strong> 1×/2×/4× estira el eje del tiempo (teclas
          <kbd>+</kbd>/<kbd>−</kbd>). Una o dos líneas finas en el borde superior indican vía única
          o doble.
        </li>
        <li>
          <strong>Tablas de horario</strong> bajo el gráfico, para ambos sentidos: como en el
          Kursbuch de ÖBB (estaciones como filas, un tren por columna, «|» = pasa sin parar; el
          nombre de la estación abre su cartel de salidas del día y, a su lado, los números de las
          hojas que se bifurcan allí, como enlaces; con tiempo real, retraso y hora prevista por
          parada); <strong>Trasponer</strong> muestra una fila por tren. El
          <a href="/kursbuch">libro de horarios</a> completo (todas las hojas del país seleccionado
          para un día, A4 con números de página) se puede imprimir como PDF.
        </li>
        <li>
          <strong>Segundo monitor</strong>: el gráfico y las tablas pueden abrirse en ventanas
          propias; día, hora, tramo y el tren bajo el cursor permanecen sincronizados.
        </li>
      </ul>
      <h3 id="planning">Planificación</h3>
      <p>
        Bajo el gráfico, cinco vistas evalúan el horario mostrado – para transbordos más cortos,
        trenes más fiables en vía única y viajes más rápidos:
      </p>
      <ul>
        <li>
          <strong>Nodo</strong>: para una estación (selecciónela o haga clic en su nombre en el
          gráfico), las líneas con sus minutos habituales de llegada y salida y su intervalo, si
          coinciden en torno a un minuto de nodo (nodo completo :00, semi-nodo :30), el minuto de
          simetría; y para cada llegada la primera conexión por sentido (verde ≤ 10′, ámbar ≤ 20′,
          rojo más) y las conexiones perdidas por poco. El tiempo mínimo de transbordo es ajustable.
          Con «todas las líneas» se añaden todos los demás trenes de la estación desde el
          planificador de viajes de ÖBB (otras líneas, WESTbahn …).
        </li>
        <li>
          <strong>Cruces</strong>: dónde se encuentran trenes de ambos sentidos junto a vía única –
          con el margen en cada sentido (cuánto retraso del tren contrario se absorbe) y, con datos
          en directo, el retraso inducido previsto. En el gráfico: vía única sombreada, cruces como
          puntos, encuentros entre dos estaciones como ✕ (a menudo un apartadero sin parada de
          viajeros).
        </li>
        <li>
          <strong>Margen de tiempo de recorrido</strong>: tiempo de recorrido programado entre dos
          paradas frente al mínimo posible a la velocidad permitida (incl. arranque y frenado) – por
          tramo, categoría y sentido. Mucho margen significa espacio para trenes más rápidos.
          Ajustable: aceleración de arranque (automotor, remolcado por locomotora), frenado,
          suplemento estándar y el umbral de «mucho margen».
        </li>
        <li>
          <strong>Capacidad</strong>: la escalera de tiempos de ocupación – por tren y cantón (de
          señal principal a señal principal, con ETCS nivel 2 de marcador ETCS a marcador ETCS, de
          OpenStreetMap) el tiempo durante el cual el cantón está bloqueado para otros trenes,
          dibujado como rectángulos en el gráfico; rojo = conflicto. La tabla muestra por cantón la
          ocupación de la franja horaria, el tiempo de ocupación más largo y el cuello de botella.
          Ajustable: distancia de la señal avanzada, tiempo de establecimiento del itinerario y de
          reacción, tiempo de liberación, longitudes de tren, tolerancia.
        </li>
        <li>
          <strong>Puntualidad (en directo)</strong>: dónde pierden tiempo los trenes, por tramo y
          parada, a partir de las horas en tiempo real comunicadas. Se recoge en su navegador
          mientras está activo En directo (7 días).
        </li>
      </ul>
      <p class="muted">
        Limitaciones: cruces, margen de tiempo de recorrido y puntualidad solo para trenes de esta
        hoja; vía única/doble de OpenStreetMap, horas de paso y tiempos mínimos de recorrido
        estimados.
      </p>

      <h2 id="vzg">Diagrama de velocidades (VzG)</h2>
      <p>
        Velocidades permitidas a lo largo de una línea, siguiendo el modelo del VzG de ÖBB (relación
        de velocidades permitidas): puntos kilométricos hacia abajo en el sentido de la marcha,
        estaciones y señales, los PK de los cambios de velocidad, la banda de velocidad (sentido de
        la marcha continua, sentido contrario trazo y punto) y los radios de curva. Elija la vía
        (vía principal 1/2), el sentido y la escala; pase el ratón por encima para ver detalles.
      </p>
      <ul>
        <li>
          Todas las líneas de ÖBB por número de línea y otros ferrocarriles (p. ej. Stubaitalbahn,
          Zillertalbahn, Lokalbahn Wien–Baden); en Eslovenia, las líneas de SŽ por su número (10,
          20, 30 …).
        </li>
        <li>
          <strong>Líneas de enlace</strong>: en las estaciones de bifurcación, los enlaces («↗ 222
          01») abren el diagrama de la otra línea.
        </li>
        <li>
          <strong>⤓ SVG</strong> descarga el diagrama como archivo independiente con título, leyenda
          y fuentes – p. ej. para Wikimedia Commons (licencia ODbL, como los datos de
          OpenStreetMap).
        </li>
        <li>
          <strong>Vista general</strong> (<code>/vzg</code>): todas las líneas con nombre,
          desde–hasta, vía única/doble, longitud, estaciones y señales; filtro por número («10101»
          encuentra «101 01»), nombre o estación, ordenable.
        </li>
        <li>Estaciones con su <strong>altitud</strong>, donde figura en OpenStreetMap.</li>
        <li>
          <strong>Esquema de la línea</strong> (Streckenband): la línea como banda esquemática, como
          en los diagramas de líneas de Wikipedia – estaciones por tipo, puentes y túneles con
          nombre y longitud, bifurcaciones.
        </li>
        <li>
          <strong>Perfil de la línea</strong> bajo el diagrama: longitud, estaciones y apeaderos,
          velocidad máxima y media, túneles y puentes, curva más cerrada, electrificación,
          protección del tren (ETCS/PZB), proporción de vía doble, ancho de vía, altitudes, trenes
          al día y líneas de enlace.
        </li>
        <li>
          <strong>Mapa de la línea</strong>: un mapa de la línea listo para imprimir y para
          Wikipedia, con túneles, estaciones (enlazadas a su panel de salidas) y líneas de enlace
          (enlazadas a su mapa); opcionalmente coloreado por velocidad permitida y con puntos
          kilométricos; descargable como SVG.
        </li>
        <li>
          <strong>Mapa de la red de infraestructura</strong> (<code>/vzg/netz</code>): todas las
          líneas del país seleccionado, coloreadas por velocidad, electrificación, ETCS, PZB, número
          de vías, ancho de vía, administrador o <strong>trenes al día</strong> (densidad de tráfico
          según el horario); con la frontera nacional (en Austria también los límites de los estados
          federados), para todo el país o un solo estado federado. Pase el ratón por encima para ver
          los valores, haga clic para el mapa de la línea; descargable como SVG.
        </li>
        <li>
          Datos de OpenStreetMap, no el VzG oficial: sin distancias de frenado, rampas ni
          observaciones; los radios de curva se estiman a partir de la geometría de la vía.
        </li>
      </ul>

      <h2 id="netzgrafik">Netzgrafik</h2>
      <p>
        El horario cadenciado como red: nodos con sus minutos de llegada y salida, líneas con
        frecuencia y tiempo de recorrido, reconstruido a partir del horario de un día laborable,
        sábado o domingo. Se puede abrir en el Netzgrafik-Editor (Open Rail Association) o exportar.
        Por ahora solo para Austria.
      </p>

      <h2 id="stoerungen">Incidencias</h2>
      <p>Avisos actuales de incidencias y obras de ÖBB con su período de validez.</p>

      <h2 id="tasten">Atajos de teclado</h2>
      <p>
        En el ordenador, <kbd>?</kbd> muestra todos los atajos. Los más comunes:
        <kbd>/</kbd> buscar, <kbd>Ctrl/⌘ K</kbd> salto rápido, <kbd>j</kbd>/<kbd>k</kbd> fila
        siguiente/anterior, <kbd>h</kbd>/<kbd>l</kbd> antes/después, <kbd>g</kbd> inicio,
        <kbd>t</kbd> trenes, <kbd>r</kbd> radar. Gráfico de circulación: <kbd>←</kbd>/<kbd>→</kbd>
        día, <kbd>↑</kbd>/<kbd>↓</kbd> dos horas (Mayús: una franja completa), <kbd>+</kbd>/<kbd
          >−</kbd
        >
        escala, <kbd>n</kbd> ahora.
      </p>

      <h2 id="daten">Datos y fuentes</h2>
      <ul>
        <li>
          <strong
            >Tiempo real, conexiones, paneles de salidas, recorridos de trenes, radar,
            incidencias</strong
          >: el planificador de viajes de ÖBB (Scotty/HAFAS) – interfaz no oficial, las peticiones
          pasan por zugx hasta ÖBB.
        </li>
        <li>
          <strong>Año de horario</strong> (lista de estaciones, índice de trenes, gráfico de
          circulación, Netzgrafik): Austria –
          <a href="https://data.oebb.at/de/datensaetze~soll-fahrplan-gtfs~"
            >datos abiertos de ÖBB (GTFS)</a
          >, CC BY 4.0, actualizados periódicamente; solo ÖBB (y algunos socios) – no WESTbahn, GKB,
          Raaberbahn, etc. Alemania – DELFI e.V. (<a
            href="https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite"
            >opendata-oepnv.de</a
          >), CC BY 4.0. Eslovenia – horario nacional IJPP (<a href="https://www.nap.si/"
            >NAP Slovenija</a
          >), CC BY-SA 4.0. España – Renfe Operadora (<a href="https://data.renfe.com/"
            >data.renfe.com</a
          >), CC BY 4.0.
        </li>
        <li>
          <strong
            >Líneas, limitaciones de velocidad, señales, PK, vía única/doble, fronteras</strong
          >
          (diagrama VzG, mapa de la línea y de la red de infraestructura, horas de paso y número de
          vías en el gráfico de circulación):
          <a href="https://www.openstreetmap.org/copyright">© colaboradores de OpenStreetMap</a>,
          ODbL.
        </li>
        <li>
          <strong>Mapas</strong>: OpenFreeMap, OpenStreetMap, OpenRailwayMap (créditos en la esquina
          del mapa).
        </li>
        <li>
          <strong>Wikidata</strong>: enlaces a estaciones mediante DinoData, a líneas mediante los
          datos de OpenStreetMap.
        </li>
      </ul>
      <p>Privacidad y tratamiento de datos: <RouterLink to="/privacy">Privacidad</RouterLink>.</p>

      <h2 id="grenzen">Limitaciones</h2>
      <p>
        zugx no es un servicio de ÖBB, SŽ, Renfe, DELFI ni DB; sin garantía, la información
        vinculante es la del operador. Las posiciones del radar y las horas de paso son calculadas o
        estimadas; el diagrama VzG no es el VzG oficial.
      </p>
    </template>
    <template v-else>
      <h1>Help</h1>
      <p>
        zugx shows timetable and realtime data of trains in Austria, Germany, Slovenia and Spain –
        fast, compact, on phone and desktop. This page explains all views, how to use them, and
        where the data comes from.
      </p>
      <nav aria-label="Contents" class="toc">
        <a href="#suche">Search &amp; journeys</a> · <a href="#abfahrten">Station board</a> ·
        <a href="#zuglauf">Train run</a> · <a href="#zuege">Trains</a> ·
        <a href="#radar">Radar</a> · <a href="#bildfahrplan">Graphic timetable</a> ·
        <a href="#vzg">VzG chart</a> · <a href="#netzgrafik">Netzgrafik</a> ·
        <a href="#stoerungen">Disruptions</a> · <a href="#tasten">Keyboard</a> ·
        <a href="#daten">Data &amp; sources</a> · <a href="#grenzen">Limits</a>
      </nav>

      <h2 id="navigation">Menu &amp; Live switch</h2>
      <p>
        The menu shows everything one click away: first Search, Radar and Disruptions (always
        realtime, red dot ●), then Stations and Trains, then the graphic timetable and Netzgrafik
        (timetable), then Lines and the infrastructure network map. The
        <strong>● Live</strong> switch top right (key <kbd>e</kbd>) chooses realtime or timetable
        where a page has both: live board or departure plan for a station, the realtime overlay in
        the graphic timetable, and the search: with Live off, journeys are computed in the browser
        from the ÖBB timetable (rail, the next days, no delays). It is remembered. The
        <strong>country</strong> selector (AT/DE/SI/ES) chooses whose trains, graphic timetables,
        lines, network map and stations are shown; search and journeys cover all countries. Germany
        has realtime only in part (mainly long-distance trains and Bavaria); Slovenia and Spain have
        no realtime data, so Live is off there. Quick jump (<kbd>⌘K</kbd>) and raw JSON
        (<kbd>d</kbd>) are in the footer.
      </p>

      <h2 id="suche">Search &amp; journeys</h2>
      <p>
        On the start page enter origin and destination (suggestions while typing, from the built-in
        station list), optionally a time and "via". Without a destination the station board opens.
      </p>
      <ul>
        <li>
          <strong>Timeline</strong>: each journey as a bar, legs in the train's colour, transfer
          times in between (tight ones highlighted), delays and cancellations marked; or as a
          <strong>table</strong>.
        </li>
        <li>
          <strong>Earlier / Later</strong> loads more journeys; tick several and
          <strong>Compare</strong> them side by side.
        </li>
        <li>
          Click for details: all stops, platforms, realtime, notes; "What if I miss it?" searches
          the next option from the transfer station. Share journeys or add them to your calendar.
        </li>
      </ul>

      <h2 id="abfahrten">Station board</h2>
      <p>
        Departures or arrivals with realtime: delay, platform (changes highlighted), cancellations
        and notes. Filter by mode (e.g. long-distance only), "Earlier / Later" pages, the list
        refreshes automatically. Big stations such as Wien Hbf also list trams and buses – enable
        them with the filters. The star saves the station as a favourite; the Wikidata link opens
        the station on Wikidata.
      </p>
      <p>
        <strong>Departure poster</strong> (link on the station board): all departures of a day from
        the annual timetable, by hour in columns like the poster in the station – with train,
        destination, following stops (linked) and platform; choose the date (←/→). No realtime.
      </p>

      <h2 id="zuglauf">Train run</h2>
      <p>
        A train with all stops, planned and actual times, platforms, delay profile and map. Click a
        train anywhere, or open e.g. <code>/train/RJX-162</code> (add <code>?d=2026-11-13</code>
        for another date). When late, the expected actual time is shown under the planned one. Signs
        as in the ÖBB Kursbuch: ◗ boarding only, ◖ alighting only, | no stop for passengers.
      </p>

      <h2 id="bahnhoefe">Stations</h2>
      <p>
        All stations A–Z with the ÖBB operating-point abbreviation (from OpenStreetMap) and the
        categories stopping there. The filter matches names and abbreviations, also several
        separated by commas or spaces, case-insensitive ("Kt, Vb, Vps" or "kt vb vps"); a station
        opens its departure plan from the timetable.
      </p>

      <h2 id="zuege">Trains (train index)</h2>
      <p>
        Every train of the timetable year in the selected country – number, name, route, running
        days – to search and filter by operator, category, station or date.
      </p>

      <h2 id="radar">Radar</h2>
      <p>
        Live map of all trains in view, coloured by delay or category; small arrows show the
        direction. Click a train to open its run in a side panel. Positions are computed by the ÖBB
        journey planner from timetable and realtime data – they are not GPS positions. "Railway map"
        adds the OpenRailwayMap tracks.
      </p>
      <p>
        <strong>Train parts</strong>: joined trains (night trains, Railjets with a portion for
        another destination) show as one train on the map, e.g. "NJ 466 / EN 40462" – the likely
        operational train first (commercial-only numbers from 40000 last, else the lower number). In
        the run, pick a part by clicking its badge. The "Train parts" box (also on the train page)
        lists per stretch the trains it runs joined with and – for commercial-only numbers – the
        operational train (EN 40462: EC 462 to Salzburg, "from here NJ 466"). Based on the ÖBB
        journey planner's data; which number is the operational one in a joined stretch is not
        always visible there.
      </p>

      <h2 id="bildfahrplan">Graphic timetable (Bildfahrplan)</h2>
      <p>
        Time–distance diagrams for lines (ÖBB's timetable diagrams and some longer corridors):
        stations across by line km, time downwards. Each train is a line in its category's colour;
        steep lines are slow, vertical parts are stops. Click a train (in the chart or the tables)
        to open its run in a side panel, Ctrl/⌘-click for the full train page. Colours follow the
        offer level as usual in timetable planning: RJX magenta, RJ red, EC/IC brown-red, ICE dark
        grey, IR and CJX violet, REX green, R slate blue, S blue, Nightjet night blue, private
        long-distance operators (WESTbahn, RegioJet) orange.
      </p>
      <ul>
        <li>
          Any day of the timetable year, section and direction, a 1–24 hour window; mouse wheel
          moves in time, Ctrl/⌘ + wheel zooms. Date and time are kept when switching sheets.
        </li>
        <li>
          Times at stations a train passes without stopping are estimated, weighted by the permitted
          speed (later in slow sections, earlier on fast ones).
        </li>
        <li>
          Hover for number and route, click for the train run; a station opens its departure board;
          line links open the VzG chart.
        </li>
        <li>
          <strong>Live</strong> (today only): actual paths from the ÖBB journey planner drawn bold
          over the plan – solid up to now, dashed as forecast, dots at reported times, the current
          delay at the now line; the replaced plan becomes thin and faint. Trains missing from the
          timetable data (e.g. WESTbahn) appear too.
        </li>
        <li>
          <strong>Scale</strong> 1×/2×/4× stretches the time axis (keys <kbd>+</kbd>/<kbd>−</kbd>).
          One or two thin lines along the top edge show single or double track.
        </li>
        <li>
          <strong>Timetable tables</strong> below the chart, both directions: like the ÖBB Kursbuch
          (stations as rows, a train per column, "|" = passes; a station name opens its departure
          plan for the day, next to it the numbers of the sheets branching off there, as links; with
          realtime on, delay and expected time per stop); <strong>Transpose</strong> shows a row per
          train. The whole <a href="/kursbuch">timetable book</a> (all sheets from 100 for one day,
          A4 with page numbers) can be printed as PDF.
        </li>
        <li>
          <strong>Second monitor</strong>: chart and tables can open in their own windows; day,
          time, section and the hovered train stay in sync.
        </li>
      </ul>
      <h3 id="planning">Planning</h3>
      <p>
        Below the chart, five views evaluate the shown timetable – for shorter transfers, more
        reliable trains on single track and faster journeys:
      </p>
      <ul>
        <li>
          <strong>Node</strong>: for a station (select it or click its name in the chart) the lines
          with their usual arrival and departure minutes and interval, whether they meet around a
          node minute (full node :00, half node :30), the symmetry minute; and for every arrival the
          first connection per direction (green ≤ 10′, amber ≤ 20′, red longer) and near misses. The
          minimum transfer time is adjustable. With “all lines”, every other train at the station
          comes in from the ÖBB journey planner (other lines, WESTbahn …).
        </li>
        <li>
          <strong>Crossings</strong>: where trains of both directions meet next to single track –
          with the buffer each way (how much delay of the opposite train is absorbed) and, with live
          data, the expected knock-on delay. In the chart: single track shaded, crossings as dots,
          meetings between two stations as ✕ (often a passing loop without passenger stop).
        </li>
        <li>
          <strong>Running-time reserve</strong>: scheduled running time between two stops vs. the
          shortest possible at the permitted speed (incl. starting and stopping) – per stretch,
          category and direction. Much reserve means room for faster trains. Adjustable: starting
          acceleration (multiple unit, locomotive-hauled), braking, standard supplement and the
          threshold for much reserve.
        </li>
        <li>
          <strong>Capacity</strong>: the blocking-time stairway – per train and block section (main
          signal to main signal, on ETCS Level 2 from ETCS marker to ETCS marker, from
          OpenStreetMap) the time the section is blocked for other trains, drawn as boxes in the
          chart; red = conflict. The table shows per block section the occupancy of the time window,
          the longest blocking time and the bottleneck. Adjustable: distant signal distance, route
          setting and reaction time, release time, train lengths, tolerance.
        </li>
        <li>
          <strong>Punctuality (live)</strong>: where trains lose time, per stretch and stop, from
          the reported realtime times. Collected in your browser while live runs (7 days).
        </li>
      </ul>
      <p class="muted">
        Limits: crossings, running-time reserve and punctuality only for trains of this sheet;
        single/double track from OpenStreetMap, passing times and minimum running times estimated.
      </p>

      <h2 id="vzg">VzG chart</h2>
      <p>
        Permitted speeds along a line, modelled on ÖBB's VzG (directory of permitted speeds): line
        km downwards in the direction of travel, stations and signals, the km of speed changes, the
        speed band (direction of travel solid, opposite dash-dot) and curve radii. Choose the track
        (Regelgleis 1/2), direction and scale; hover for details.
      </p>
      <ul>
        <li>
          All ÖBB lines by line number, plus other railways (e.g. Stubaitalbahn, Zillertalbahn,
          Lokalbahn Wien–Baden).
        </li>
        <li>
          <strong>Connecting lines</strong>: at junction stations, links ("↗ 222 01") open the other
          line's chart.
        </li>
        <li>
          <strong>⤓ SVG</strong> downloads the chart as a standalone file with caption, legend and
          sources – e.g. for Wikimedia Commons (licence ODbL, like the OpenStreetMap data).
        </li>
        <li>
          <strong>Overview</strong> (<code>/vzg</code>): all lines with name, from–to, single/double
          track, length, stations and signals; filter by number ("10101" finds "101 01"), name or
          station, sortable.
        </li>
        <li>Stations with their <strong>elevation</strong>, where mapped in OpenStreetMap.</li>
        <li>
          <strong>Route strip</strong> (Streckenband): the line as a schematic strip like the
          Wikipedia route diagrams – stations by type, bridges and tunnels with name and length,
          junctions.
        </li>
        <li>
          <strong>Line profile</strong> below the chart: length, stations and halts, top and average
          speed, tunnels and bridges, tightest curve, electrification, train protection (ETCS/PZB),
          double-track share, gauge, elevations, trains per day and connecting lines.
        </li>
        <li>
          <strong>Line map</strong>: a print- and Wikipedia-ready map of the line with tunnels,
          stations (linked to their departure board) and connecting lines (linked to their map);
          optionally coloured by permitted speed and with line km; downloadable as SVG.
        </li>
        <li>
          <strong>Infrastructure network map</strong> (<code>/vzg/netz</code>): all lines in
          Austria, coloured by speed, electrification, ETCS, PZB, track count, gauge, operator or
          <strong>trains per day</strong> (traffic density from the timetable); with national and
          federal-state borders, for all of Austria or one federal state. Hover for the values,
          click for the line map; downloadable as SVG.
        </li>
        <li>
          Data from OpenStreetMap, not the official VzG: no braking distances, gradients or remarks;
          curve radii are estimated from the track geometry.
        </li>
      </ul>

      <h2 id="netzgrafik">Netzgrafik</h2>
      <p>
        The interval timetable as a network: nodes with their arrival and departure minutes, lines
        with frequency and running time, reconstructed from the timetable of a weekday, Saturday or
        Sunday. Open it in the Netzgrafik-Editor (Open Rail Association) or export it.
      </p>

      <h2 id="stoerungen">Disruptions</h2>
      <p>Current disruption and engineering notices from ÖBB with their validity period.</p>

      <h2 id="tasten">Keyboard shortcuts</h2>
      <p>
        On desktop <kbd>?</kbd> lists all shortcuts. Common ones: <kbd>/</kbd> search,
        <kbd>Ctrl/⌘ K</kbd> command palette, <kbd>j</kbd>/<kbd>k</kbd> next/previous row,
        <kbd>h</kbd>/<kbd>l</kbd> earlier/later, <kbd>g</kbd> home, <kbd>t</kbd> trains,
        <kbd>r</kbd> radar. Graphic timetable: <kbd>←</kbd>/<kbd>→</kbd> day, <kbd>↑</kbd>/<kbd
          >↓</kbd
        >
        two hours (Shift: a whole window), <kbd>+</kbd>/<kbd>−</kbd> scale, <kbd>n</kbd> now.
      </p>

      <h2 id="daten">Data &amp; sources</h2>
      <ul>
        <li>
          <strong>Realtime, journeys, boards, train runs, radar, disruptions</strong>: the ÖBB
          journey planner (Scotty/HAFAS) – unofficial interface, requests go via zugx to ÖBB.
        </li>
        <li>
          <strong>Timetable year</strong> (station list, train index, graphic timetable,
          Netzgrafik): Austria –
          <a href="https://data.oebb.at/de/datensaetze~soll-fahrplan-gtfs~">ÖBB open data (GTFS)</a
          >, CC BY 4.0, updated regularly; ÖBB (and some partners) only – not WESTbahn, GKB,
          Raaberbahn etc. Germany – DELFI e.V. (<a
            href="https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite"
            >opendata-oepnv.de</a
          >), CC BY 4.0. Slovenia – national timetable IJPP (<a href="https://www.nap.si/"
            >NAP Slovenija</a
          >), CC BY-SA 4.0. Spain – Renfe Operadora (<a href="https://data.renfe.com/"
            >data.renfe.com</a
          >), CC BY 4.0.
        </li>
        <li>
          <strong>Lines, speed limits, signals, km, single/double track, borders</strong> (VzG
          chart, line and infrastructure network map, passing times and track count in the graphic
          timetable):
          <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>, ODbL.
        </li>
        <li>
          <strong>Maps</strong>: OpenFreeMap, OpenStreetMap, OpenRailwayMap (credits in the map
          corner).
        </li>
        <li>
          <strong>Wikidata</strong>: links to stations via DinoData, to lines via the OpenStreetMap
          data.
        </li>
      </ul>
      <p>Privacy and data processing: <RouterLink to="/privacy">Privacy</RouterLink>.</p>

      <h2 id="grenzen">Limits</h2>
      <p>
        zugx is not a service of ÖBB, SŽ, Renfe, DELFI or DB; no guarantee, the operator's
        information is binding. Radar positions and passing times are computed or estimated; the VzG
        chart is not the official VzG.
      </p>
    </template>
  </article>
</template>

<style scoped>
.help .toc {
  margin: 0.5rem 0 1rem;
  font-size: 0.8125rem;
  line-height: 1.7;
}
.help h2 {
  scroll-margin-top: 1rem;
}
.help kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  padding: 0 0.3rem;
  border: 1px solid var(--line);
  border-radius: 3px;
}
</style>
