<script setup lang="ts">
// Datenschutzerklärung (DSGVO). German is authoritative; English, Slovenian and Spanish as a courtesy.
// Keep in sync with the actual data flows: deploy/Caddyfile (log, proxy), MapView (tile hosts),
// lib/store.ts + useLocalStorage keys, StationInput (geolocation).
import { useI18n } from "../i18n/index.ts";
import { setLocale } from "../i18n/index.ts";
const { locale } = useI18n();
const EMAIL = "simon.legner@gmail.com";
</script>

<template>
  <article class="legal max-w-3xl">
    <template v-if="locale === 'de'">
      <h1>Datenschutzerklärung</h1>
      <p class="muted">Stand: November 2026</p>
      <p>
        zugx verwendet keine Cookies, kein Tracking, keine Analyse-Werkzeuge und keine Werbung. Es
        gibt keine Benutzerkonten. Im Folgenden steht, welche Daten trotzdem technisch anfallen.
      </p>

      <h2>1. Verantwortlicher</h2>
      <p>
        Simon Legner, Innsbruck, Österreich –
        <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>
      </p>

      <h2>2. Hosting und Cloudflare</h2>
      <p>
        Die Website läuft auf einem eigenen Server in Österreich (Webserver Caddy). Der Server ist
        über einen <em>Cloudflare Tunnel</em> mit dem Internet verbunden: Alle Anfragen laufen über
        Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA. Cloudflare verarbeitet
        dabei Ihre IP-Adresse und die Anfragedaten (aufgerufene Adresse, Browser-Kennung,
        Zeitpunkt), um die Seite auszuliefern und vor Angriffen zu schützen; die verschlüsselte
        Verbindung endet bei Cloudflare. Cloudflare ist unter dem EU-US Data Privacy Framework
        zertifiziert (Angemessenheitsbeschluss, Art. 45 DSGVO). Rechtsgrundlage ist unser
        berechtigtes Interesse an einem sicheren, erreichbaren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
        Mehr:
        <a href="https://www.cloudflare.com/privacypolicy/">Datenschutzerklärung von Cloudflare</a>.
      </p>

      <h2>3. Server-Protokolle</h2>
      <p>
        Der Webserver protokolliert jede Anfrage: Zeitpunkt, gekürzte IP-Adresse (IPv4 auf /24, IPv6
        auf /48 – die vollständige Adresse wird nicht gespeichert), Methode, aufgerufene Adresse
        samt Parametern (z. B. Bahnhofsnummern), Statuscode, Größe und Dauer. Browser-Header und
        Cookies werden nicht protokolliert. Die Protokolle liegen im System-Journal (systemd) des
        Servers, werden nur zur Fehlersuche und Missbrauchsabwehr verwendet und abhängig von der
        Größe automatisch überschrieben, üblicherweise nach wenigen Wochen. Rechtsgrundlage: Art. 6
        Abs. 1 lit. f DSGVO.
      </p>

      <h2>4. Fahrplanabfragen</h2>
      <p>
        Suchen nach Abfahrten, Verbindungen, Zügen und Störungen leitet unser Server an die
        Fahrplanauskunft der ÖBB-Personenverkehr AG (fahrplan.oebb.at) weiter. Übermittelt wird nur
        der Inhalt der Abfrage (z. B. Bahnhöfe, Datum, Uhrzeit, Zugnummer). Ihre IP-Adresse, Cookies
        und Browser-Header werden <strong>nicht</strong> weitergegeben – die ÖBB sieht nur unseren
        Server. Die Bahnhofssuche läuft zunächst lokal im Browser. Rechtsgrundlage: Art. 6 Abs. 1
        lit. b und f DSGVO (Erbringung der angefragten Auskunft).
      </p>

      <h2>5. Karten</h2>
      <p>
        Wenn eine Karte angezeigt wird (Radar, Zug- und Verbindungskarten, Bahnhofskarte), lädt Ihr
        Browser die Kartenkacheln direkt von diesen Diensten. Dabei erhalten sie Ihre IP-Adresse,
        den angezeigten Kartenausschnitt und die Browser-Kennung:
      </p>
      <ul>
        <li>
          OpenFreeMap (tiles.openfreemap.org) – Grundkarte,
          <a href="https://openfreemap.org/">openfreemap.org</a>
        </li>
        <li>
          OpenStreetMap Foundation, St John’s Innovation Centre, Cowley Road, Cambridge, CB4 0WS,
          Vereinigtes Königreich (tile.openstreetmap.org) – Bahnhofskarte,
          <a href="https://osmfoundation.org/wiki/Privacy_Policy">Datenschutzerklärung</a>
          (Angemessenheitsbeschluss für das Vereinigte Königreich)
        </li>
        <li>
          OpenRailwayMap (a.tiles.openrailwaymap.org) – Bahnstrecken-Ebene, in der Karte
          abschaltbar,
          <a href="https://www.openrailwaymap.org/">openrailwaymap.org</a>
        </li>
      </ul>
      <p>
        Rechtsgrundlage ist unser berechtigtes Interesse an einer Kartendarstellung (Art. 6 Abs. 1
        lit. f DSGVO).
      </p>

      <h2>6. Speicherung im Browser</h2>
      <p>
        Ihre Einstellungen (Sprache, Farbschema, Kartenoptionen, Land) sowie zuletzt gesuchte und
        favorisierte Bahnhöfe und Verbindungen speichert zugx im <em>localStorage</em> Ihres
        Browsers. Für die Offline-Nutzung legt ein Service Worker die App-Dateien im Browser-Cache
        ab. Diese Daten bleiben auf Ihrem Gerät und werden nicht an uns übertragen. Die Speicherung
        ist für die von Ihnen genutzten Funktionen unbedingt erforderlich (§ 165 Abs. 3 TKG 2021).
        Sie können die Daten jederzeit über die Browser-Einstellungen („Websitedaten löschen“)
        entfernen.
      </p>

      <h2>7. Standort</h2>
      <p>
        Nur wenn Sie „in der Nähe“ wählen, fragt der Browser nach Ihrem Standort. Er wird
        ausschließlich im Browser verwendet, um den nächstgelegenen Bahnhof zu finden, und nicht
        übertragen oder gespeichert. Rechtsgrundlage: Ihre Einwilligung (Art. 6 Abs. 1 lit. a
        DSGVO), die Sie in den Browser-Einstellungen widerrufen können.
      </p>

      <h2>8. Kalender und Teilen</h2>
      <p>
        Kalendereinträge (.ics) und Links zum Teilen werden lokal im Browser erzeugt. Was Sie damit
        weitergeben, entscheiden Sie selbst.
      </p>

      <h2>9. Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Da wir nur gekürzte IP-Adressen
        speichern, können wir Protokolleinträge in der Regel keiner Person zuordnen. Anfragen bitte
        an
        <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>. Sie können sich außerdem bei der
        österreichischen Datenschutzbehörde beschweren: Barichgasse 40–42, 1030 Wien,
        <a href="https://www.dsb.gv.at/">dsb.gv.at</a>.
      </p>
      <p><RouterLink to="/imprint">Impressum</RouterLink></p>
    </template>

    <template v-else-if="locale === 'sl'">
      <h1>Varstvo zasebnosti</h1>
      <p class="muted">
        Stanje november 2026. Zavezujoča je
        <a href="#" @click.prevent="setLocale('de')">nemška različica</a>.
      </p>
      <p>
        zugx ne uporablja piškotkov, sledenja, analitike ali oglasov. Uporabniških računov ni. Ta
        stran navaja podatke, ki se kljub temu obdelujejo iz tehničnih razlogov.
      </p>

      <h2>1. Upravljavec</h2>
      <p>
        Simon Legner, Innsbruck, Avstrija –
        <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>
      </p>

      <h2>2. Gostovanje in Cloudflare</h2>
      <p>
        Spletna stran teče na lastnem strežniku v Avstriji (spletni strežnik Caddy). Strežnik je z
        internetom povezan prek <em>Cloudflare Tunnel</em>: vse zahteve gredo prek družbe
        Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, ZDA. Cloudflare obdeluje vaš
        naslov IP in podatke zahteve (naslov, identifikacija brskalnika, čas), da dostavi stran in
        jo zaščiti pred napadi; šifrirana povezava se konča pri Cloudflaru. Cloudflare je
        certificiran po okviru EU-ZDA za zasebnost podatkov (sklep o ustreznosti, člen 45 GDPR).
        Pravna podlaga: naš zakoniti interes za varno in razpoložljivo delovanje (člen 6(1)(f)
        GDPR). Več:
        <a href="https://www.cloudflare.com/privacypolicy/">politika zasebnosti Cloudflare</a>.
      </p>

      <h2>3. Strežniški dnevniki</h2>
      <p>
        Spletni strežnik zabeleži vsako zahtevo: čas, skrajšan naslov IP (IPv4 na /24, IPv6 na /48 –
        celoten naslov se ne shrani), metodo, zahtevani naslov s parametri (npr. številke postaj),
        statusno kodo, velikost in trajanje. Glave brskalnika in piškotki se ne beležijo. Dnevniki
        se hranijo v sistemskem dnevniku strežnika (systemd), uporabljajo se samo za odpravljanje
        napak in preprečevanje zlorab ter se samodejno prepišejo glede na velikost, običajno po
        nekaj tednih. Pravna podlaga: člen 6(1)(f) GDPR.
      </p>

      <h2>4. Poizvedbe po voznem redu</h2>
      <p>
        Iskanja odhodov, povezav, vlakov in motenj naš strežnik posreduje načrtovalniku poti družbe
        ÖBB-Personenverkehr AG (fahrplan.oebb.at). Pošlje se samo vsebina poizvedbe (npr. postaje,
        datum, čas, številka vlaka). Vaš naslov IP, piškotki in glave brskalnika se
        <strong>ne</strong> posredujejo – ÖBB vidi samo naš strežnik. Iskanje postaj najprej poteka
        lokalno v vašem brskalniku. Pravna podlaga: člen 6(1)(b) in (f) GDPR (zagotavljanje
        zahtevanih informacij).
      </p>

      <h2>5. Zemljevidi</h2>
      <p>
        Ko je prikazan zemljevid (radar, zemljevidi vlakov in povezav, načrt postaje), vaš brskalnik
        naloži ploščice zemljevida neposredno s teh storitev, ki prejmejo vaš naslov IP, območje
        zemljevida in identifikacijo brskalnika:
      </p>
      <ul>
        <li>
          OpenFreeMap (tiles.openfreemap.org) – osnovni zemljevid,
          <a href="https://openfreemap.org/">openfreemap.org</a>
        </li>
        <li>
          OpenStreetMap Foundation, St John’s Innovation Centre, Cowley Road, Cambridge, CB4 0WS,
          Združeno kraljestvo (tile.openstreetmap.org) – načrt postaje,
          <a href="https://osmfoundation.org/wiki/Privacy_Policy">politika zasebnosti</a> (sklep o
          ustreznosti za Združeno kraljestvo)
        </li>
        <li>
          OpenRailwayMap (a.tiles.openrailwaymap.org) – železniški sloj, ki ga je mogoče na
          zemljevidu izklopiti, <a href="https://www.openrailwaymap.org/">openrailwaymap.org</a>
        </li>
      </ul>
      <p>Pravna podlaga: naš zakoniti interes za prikaz zemljevidov (člen 6(1)(f) GDPR).</p>

      <h2>6. Shranjevanje v brskalniku</h2>
      <p>
        zugx shranjuje vaše nastavitve (jezik, barvna shema, možnosti zemljevida, država) ter
        nedavno iskane in priljubljene postaje in povezave v <em>localStorage</em> vašega
        brskalnika. Za uporabo brez povezave service worker hrani datoteke aplikacije v
        predpomnilniku brskalnika. Ti podatki ostanejo na vaši napravi in se nam ne pošiljajo.
        Shranjevanje je nujno potrebno za funkcije, ki jih uporabljate (§ 165(3) avstrijskega zakona
        o telekomunikacijah 2021). Kadar koli ga lahko odstranite v nastavitvah brskalnika (»izbriši
        podatke spletnega mesta«).
      </p>

      <h2>7. Lokacija</h2>
      <p>
        Samo če izberete »V bližini«, brskalnik vpraša za vašo lokacijo. Uporabi se izključno v
        vašem brskalniku za iskanje najbližje postaje in se ne prenaša ne shranjuje. Pravna podlaga:
        vaša privolitev (člen 6(1)(a) GDPR), ki jo lahko prekličete v nastavitvah brskalnika.
      </p>

      <h2>8. Koledar in deljenje</h2>
      <p>
        Vnosi v koledar (.ics) in povezave za deljenje nastanejo lokalno v vašem brskalniku. Sami
        odločite, kaj posredujete naprej.
      </p>

      <h2>9. Vaše pravice</h2>
      <p>
        Imate pravico do dostopa, popravka, izbrisa, omejitve obdelave, prenosljivosti podatkov in
        ugovora (členi 15–21 GDPR). Ker hranimo le skrajšane naslove IP, vnosov v dnevnikih običajno
        ne moremo povezati z osebo. Zahteve pošljite na
        <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>. Pritožbo lahko vložite tudi pri avstrijskem
        organu za varstvo podatkov: Barichgasse 40–42, 1030 Dunaj,
        <a href="https://www.dsb.gv.at/">dsb.gv.at</a>.
      </p>
      <p><RouterLink to="/imprint">Kolofon</RouterLink></p>
    </template>
    <template v-else-if="locale === 'es'">
      <h1>Política de privacidad</h1>
      <p class="muted">
        Versión de noviembre de 2026. La
        <a href="#" @click.prevent="setLocale('de')">versión alemana</a> es la vinculante.
      </p>
      <p>
        zugx no utiliza cookies, seguimiento, herramientas de análisis ni publicidad. No hay cuentas
        de usuario. A continuación se indica qué datos se generan, aun así, por motivos técnicos.
      </p>

      <h2>1. Responsable</h2>
      <p>
        Simon Legner, Innsbruck, Austria –
        <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>
      </p>

      <h2>2. Alojamiento y Cloudflare</h2>
      <p>
        El sitio web funciona en un servidor propio en Austria (servidor web Caddy). El servidor
        está conectado a Internet mediante un <em>Cloudflare Tunnel</em>: todas las peticiones pasan
        por Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, EE. UU. Cloudflare trata su
        dirección IP y los datos de la petición (dirección solicitada, identificación del navegador,
        hora) para servir la página y protegerla frente a ataques; la conexión cifrada termina en
        Cloudflare. Cloudflare está certificada en el marco EU-US Data Privacy Framework (decisión
        de adecuación, art. 45 RGPD). La base jurídica es nuestro interés legítimo en un
        funcionamiento seguro y accesible (art. 6.1.f RGPD). Más información:
        <a href="https://www.cloudflare.com/privacypolicy/">política de privacidad de Cloudflare</a
        >.
      </p>

      <h2>3. Registros del servidor</h2>
      <p>
        El servidor web registra cada petición: hora, dirección IP abreviada (IPv4 a /24, IPv6 a /48
        – la dirección completa no se guarda), método, dirección solicitada con sus parámetros (p.
        ej. números de estación), código de estado, tamaño y duración. Las cabeceras del navegador y
        las cookies no se registran. Los registros se guardan en el diario del sistema (systemd) del
        servidor, solo se utilizan para depurar errores y prevenir abusos y se sobrescriben
        automáticamente según su tamaño, normalmente al cabo de pocas semanas. Base jurídica: art.
        6.1.f RGPD.
      </p>

      <h2>4. Consultas de horarios</h2>
      <p>
        Las búsquedas de salidas, conexiones, trenes e incidencias las reenvía nuestro servidor al
        planificador de viajes de ÖBB-Personenverkehr AG (fahrplan.oebb.at). Solo se transmite el
        contenido de la consulta (p. ej. estaciones, fecha, hora, número de tren). Su dirección IP,
        sus cookies y las cabeceras del navegador <strong>no</strong> se transmiten – ÖBB solo ve
        nuestro servidor. La búsqueda de estaciones se realiza primero localmente en el navegador.
        Base jurídica: art. 6.1.b y f RGPD (prestación de la información solicitada).
      </p>

      <h2>5. Mapas</h2>
      <p>
        Cuando se muestra un mapa (radar, mapas de trenes y de conexiones, plano de la estación), su
        navegador carga las teselas directamente de estos servicios, que reciben así su dirección
        IP, la zona del mapa mostrada y la identificación del navegador:
      </p>
      <ul>
        <li>
          OpenFreeMap (tiles.openfreemap.org) – mapa base,
          <a href="https://openfreemap.org/">openfreemap.org</a>
        </li>
        <li>
          OpenStreetMap Foundation, St John’s Innovation Centre, Cowley Road, Cambridge, CB4 0WS,
          Reino Unido (tile.openstreetmap.org) – plano de la estación,
          <a href="https://osmfoundation.org/wiki/Privacy_Policy">política de privacidad</a>
          (decisión de adecuación para el Reino Unido)
        </li>
        <li>
          OpenRailwayMap (a.tiles.openrailwaymap.org) – capa de líneas ferroviarias, desactivable en
          el mapa,
          <a href="https://www.openrailwaymap.org/">openrailwaymap.org</a>
        </li>
      </ul>
      <p>La base jurídica es nuestro interés legítimo en mostrar mapas (art. 6.1.f RGPD).</p>

      <h2>6. Almacenamiento en el navegador</h2>
      <p>
        zugx guarda sus ajustes (idioma, esquema de colores, opciones del mapa, país) así como las
        estaciones y conexiones buscadas recientemente y favoritas en el <em>localStorage</em> de su
        navegador. Para el uso sin conexión, un service worker guarda los archivos de la aplicación
        en la caché del navegador. Estos datos permanecen en su dispositivo y no se nos transmiten.
        El almacenamiento es estrictamente necesario para las funciones que usted utiliza (§ 165.3
        de la Ley austriaca de telecomunicaciones de 2021, TKG). Puede eliminarlos en cualquier
        momento en los ajustes del navegador («borrar datos del sitio»).
      </p>

      <h2>7. Ubicación</h2>
      <p>
        Solo si elige «Cerca de mí», el navegador le pide su ubicación. Se utiliza exclusivamente en
        el navegador para encontrar la estación más cercana y no se transmite ni se guarda. Base
        jurídica: su consentimiento (art. 6.1.a RGPD), que puede revocar en los ajustes del
        navegador.
      </p>

      <h2>8. Calendario y compartir</h2>
      <p>
        Las entradas de calendario (.ics) y los enlaces para compartir se generan localmente en el
        navegador. Usted decide qué comparte con ellos.
      </p>

      <h2>9. Sus derechos</h2>
      <p>
        Tiene derecho de acceso, rectificación, supresión, limitación del tratamiento, portabilidad
        de los datos y oposición (arts. 15–21 RGPD). Como solo guardamos direcciones IP abreviadas,
        por lo general no podemos asociar las entradas de los registros a ninguna persona. Envíe sus
        solicitudes a
        <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>. También puede presentar una reclamación ante
        la autoridad austriaca de protección de datos (Datenschutzbehörde): Barichgasse 40–42, 1030
        Viena, <a href="https://www.dsb.gv.at/">dsb.gv.at</a>.
      </p>
      <p><RouterLink to="/imprint">Aviso legal</RouterLink></p>
    </template>
    <template v-else>
      <h1>Privacy policy</h1>
      <p class="muted">
        As of November 2026. The
        <a href="#" @click.prevent="setLocale('de')">German version</a> is authoritative.
      </p>
      <p>
        zugx uses no cookies, no tracking, no analytics and no advertising. There are no user
        accounts. This page lists the data that is still processed for technical reasons.
      </p>

      <h2>1. Controller</h2>
      <p>
        Simon Legner, Innsbruck, Austria –
        <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>
      </p>

      <h2>2. Hosting and Cloudflare</h2>
      <p>
        The website runs on its own server in Austria (Caddy web server). The server is connected to
        the internet through a <em>Cloudflare Tunnel</em>: all requests pass through Cloudflare,
        Inc., 101 Townsend St., San Francisco, CA 94107, USA. Cloudflare processes your IP address
        and the request data (address, browser identification, time) to deliver the site and protect
        it from attacks; the encrypted connection ends at Cloudflare. Cloudflare is certified under
        the EU-US Data Privacy Framework (adequacy decision, Art. 45 GDPR). Legal basis: our
        legitimate interest in secure and available operation (Art. 6(1)(f) GDPR). More:
        <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a>.
      </p>

      <h2>3. Server logs</h2>
      <p>
        The web server logs each request: time, shortened IP address (IPv4 to /24, IPv6 to /48 – the
        full address is not stored), method, requested address including parameters (e.g. station
        numbers), status code, size and duration. Browser headers and cookies are not logged. The
        logs are kept in the server's system journal (systemd), used only for troubleshooting and
        abuse prevention, and overwritten automatically depending on their size, usually after a few
        weeks. Legal basis: Art. 6(1)(f) GDPR.
      </p>

      <h2>4. Timetable queries</h2>
      <p>
        Searches for departures, connections, trains and disruptions are forwarded by our server to
        the journey planner of ÖBB-Personenverkehr AG (fahrplan.oebb.at). Only the content of the
        query is sent (e.g. stations, date, time, train number). Your IP address, cookies and
        browser headers are <strong>not</strong> passed on – ÖBB only sees our server. Station
        search runs locally in your browser first. Legal basis: Art. 6(1)(b) and (f) GDPR (providing
        the requested information).
      </p>

      <h2>5. Maps</h2>
      <p>
        When a map is shown (radar, train and connection maps, station map), your browser loads the
        map tiles directly from these services, which receive your IP address, the map area and your
        browser identification:
      </p>
      <ul>
        <li>
          OpenFreeMap (tiles.openfreemap.org) – base map,
          <a href="https://openfreemap.org/">openfreemap.org</a>
        </li>
        <li>
          OpenStreetMap Foundation, St John’s Innovation Centre, Cowley Road, Cambridge, CB4 0WS,
          United Kingdom (tile.openstreetmap.org) – station map,
          <a href="https://osmfoundation.org/wiki/Privacy_Policy">privacy policy</a> (UK adequacy
          decision)
        </li>
        <li>
          OpenRailwayMap (a.tiles.openrailwaymap.org) – railway layer, can be switched off on the
          map, <a href="https://www.openrailwaymap.org/">openrailwaymap.org</a>
        </li>
      </ul>
      <p>Legal basis: our legitimate interest in showing maps (Art. 6(1)(f) GDPR).</p>

      <h2>6. Storage in your browser</h2>
      <p>
        zugx stores your settings (language, colour scheme, map options, country) and recently
        searched and favourite stations and connections in your browser's <em>localStorage</em>. For
        offline use, a service worker keeps the app files in the browser cache. This data stays on
        your device and is not sent to us. The storage is strictly necessary for the features you
        use (§ 165(3) Austrian Telecommunications Act 2021). You can remove it at any time in your
        browser settings ("clear site data").
      </p>

      <h2>7. Location</h2>
      <p>
        Only if you choose "near me" does the browser ask for your location. It is used solely in
        your browser to find the nearest station and is neither transmitted nor stored. Legal basis:
        your consent (Art. 6(1)(a) GDPR), which you can withdraw in your browser settings.
      </p>

      <h2>8. Calendar and sharing</h2>
      <p>
        Calendar entries (.ics) and share links are created locally in your browser. You decide what
        you pass on.
      </p>

      <h2>9. Your rights</h2>
      <p>
        You have the right of access, rectification, erasure, restriction of processing, data
        portability and objection (Art. 15–21 GDPR). As we only store shortened IP addresses, we
        usually cannot link log entries to a person. Please send requests to
        <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>. You can also lodge a complaint with the
        Austrian Data Protection Authority: Barichgasse 40–42, 1030 Vienna,
        <a href="https://www.dsb.gv.at/">dsb.gv.at</a>.
      </p>
      <p><RouterLink to="/imprint">Imprint</RouterLink></p>
    </template>
  </article>
</template>
