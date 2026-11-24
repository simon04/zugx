<script setup lang="ts">
// Impressum / Offenlegung (§ 25 MedienG, § 5 ECG). German is authoritative; English, Slovenian and Spanish as a courtesy.
import { useI18n } from "../i18n/index.ts";
import { setLocale } from "../i18n/index.ts";
const { locale } = useI18n();
const EMAIL = "simon.legner@gmail.com";
</script>

<template>
  <article class="legal max-w-3xl">
    <template v-if="locale === 'de'">
      <h1>Impressum</h1>
      <p>Offenlegung gemäß § 25 Mediengesetz und Informationen gemäß § 5 E-Commerce-Gesetz</p>
      <h2>Medieninhaber und Betreiber</h2>
      <p>
        Simon Legner<br />
        Innsbruck, Österreich<br />
        E-Mail: <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>
      </p>
      <h2>Grundlegende Richtung</h2>
      <p>
        zugx ist eine private, nicht-kommerzielle Website mit Fahrplan- und Echtzeitinformationen zu
        Zügen in Österreich, Deutschland, Slowenien und Spanien. Es gibt keine Werbung und keine
        Bezahlfunktionen.
      </p>
      <h2>Keine Verbindung zur ÖBB</h2>
      <p>
        zugx ist kein Angebot der ÖBB-Personenverkehr AG oder anderer Verkehrsunternehmen. Die Daten
        stammen aus der Fahrplanauskunft der ÖBB (inoffizielle Schnittstelle) und aus offenen
        Fahrplandaten (<a href="https://data.oebb.at/">data.oebb.at</a>, CC BY 4.0;
        <a href="https://www.nap.si/">NAP Slovenija</a>, CC BY-SA 4.0;
        <a href="https://data.renfe.com/">data.renfe.com</a>, CC BY 4.0; DELFI e.V. (<a
          href="https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite"
          >opendata-oepnv.de</a
        >), CC BY 4.0). Angaben ohne Gewähr – verbindlich sind die Informationen des jeweiligen
        Verkehrsunternehmens.
      </p>
      <h2>Haftung für Links</h2>
      <p>
        Für die Inhalte verlinkter externer Websites sind ausschließlich deren Betreiber
        verantwortlich.
      </p>
      <h2>Quellcode</h2>
      <p>
        Der Quellcode ist unter der AGPL-3.0 auf
        <a href="https://github.com/simon04/zugx">GitHub</a> veröffentlicht.
      </p>
      <p><RouterLink to="/privacy">Datenschutzerklärung</RouterLink></p>
    </template>
    <template v-else-if="locale === 'sl'">
      <h1>Kolofon</h1>
      <p>
        Razkritje po § 25 avstrijskega zakona o medijih (MedienG) in § 5 avstrijskega zakona o
        elektronskem poslovanju (ECG). Zavezujoča je
        <a href="#" @click.prevent="setLocale('de')">nemška različica</a>.
      </p>
      <h2>Lastnik in upravljavec</h2>
      <p>
        Simon Legner<br />
        Innsbruck, Avstrija<br />
        E-pošta: <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>
      </p>
      <h2>Namen</h2>
      <p>
        zugx je zasebna, nekomercialna spletna stran z informacijami o voznem redu in podatki v
        realnem času za vlake v Avstriji, Nemčiji, Sloveniji in Španiji. Ni oglasov in ničesar ni
        mogoče kupiti.
      </p>
      <h2>Ni povezave z ÖBB ali SŽ</h2>
      <p>
        zugx ni storitev družbe ÖBB-Personenverkehr AG, Slovenskih železnic ali drugega prevoznika.
        Podatki izvirajo iz načrtovalnika poti ÖBB (neuradni vmesnik) in iz odprtih podatkov voznega
        reda (<a href="https://data.oebb.at/">data.oebb.at</a>, CC BY 4.0;
        <a href="https://www.nap.si/">NAP Slovenija</a>, CC BY-SA 4.0;
        <a href="https://data.renfe.com/">data.renfe.com</a>, CC BY 4.0; DELFI e.V. (<a
          href="https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite"
          >opendata-oepnv.de</a
        >), CC BY 4.0). Brez jamstva za točnost – zavezujoče so informacije prevoznika.
      </p>
      <h2>Zunanje povezave</h2>
      <p>
        Za vsebino povezanih zunanjih spletnih strani so odgovorni izključno njihovi upravljavci.
      </p>
      <h2>Izvorna koda</h2>
      <p>
        Izvorna koda je objavljena pod licenco AGPL-3.0 na
        <a href="https://github.com/simon04/zugx">GitHubu</a>.
      </p>
      <p><RouterLink to="/privacy">Varstvo zasebnosti</RouterLink></p>
    </template>
    <template v-else-if="locale === 'es'">
      <h1>Aviso legal</h1>
      <p>
        Información conforme al § 25 de la Ley austriaca de medios (MedienG) y al § 5 de la Ley
        austriaca de comercio electrónico (ECG). La
        <a href="#" @click.prevent="setLocale('de')">versión alemana</a> es la vinculante.
      </p>
      <h2>Titular y responsable</h2>
      <p>
        Simon Legner<br />
        Innsbruck, Austria<br />
        Correo electrónico: <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>
      </p>
      <h2>Finalidad</h2>
      <p>
        zugx es un sitio web privado y sin ánimo de lucro con información de horarios y en tiempo
        real sobre trenes en Austria, Alemania, Eslovenia y España. No hay publicidad ni nada que
        comprar.
      </p>
      <h2>Sin vinculación con ÖBB</h2>
      <p>
        zugx no es un servicio de ÖBB-Personenverkehr AG ni de ningún otro operador de transporte.
        Los datos proceden del planificador de viajes de ÖBB (interfaz no oficial) y de datos
        abiertos de horarios (<a href="https://data.oebb.at/">data.oebb.at</a>, CC BY 4.0;
        <a href="https://www.nap.si/">NAP Slovenija</a>, CC BY-SA 4.0;
        <a href="https://data.renfe.com/">data.renfe.com</a>, CC BY 4.0; DELFI e.V. (<a
          href="https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite"
          >opendata-oepnv.de</a
        >), CC BY 4.0). Sin garantía de exactitud – la información vinculante es la del operador
        correspondiente.
      </p>
      <h2>Enlaces externos</h2>
      <p>
        Los operadores de los sitios web externos enlazados son los únicos responsables de su
        contenido.
      </p>
      <h2>Código fuente</h2>
      <p>
        El código fuente está publicado bajo la licencia AGPL-3.0 en
        <a href="https://github.com/simon04/zugx">GitHub</a>.
      </p>
      <p><RouterLink to="/privacy">Política de privacidad</RouterLink></p>
    </template>
    <template v-else>
      <h1>Imprint</h1>
      <p>
        Disclosure according to § 25 Austrian Media Act (MedienG) and § 5 Austrian E-Commerce Act
        (ECG). The <a href="#" @click.prevent="setLocale('de')">German version</a> is authoritative.
      </p>
      <h2>Owner and operator</h2>
      <p>
        Simon Legner<br />
        Innsbruck, Austria<br />
        Email: <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>
      </p>
      <h2>Purpose</h2>
      <p>
        zugx is a private, non-commercial website with timetable and realtime information on trains
        in Austria, Germany, Slovenia and Spain. There is no advertising and nothing to buy.
      </p>
      <h2>Not affiliated with ÖBB</h2>
      <p>
        zugx is not a service of ÖBB-Personenverkehr AG or any other transport operator. Data comes
        from the ÖBB journey planner (unofficial interface) and open timetable data (<a
          href="https://data.oebb.at/"
          >data.oebb.at</a
        >, CC BY 4.0; <a href="https://www.nap.si/">NAP Slovenija</a>, CC BY-SA 4.0;
        <a href="https://data.renfe.com/">data.renfe.com</a>, CC BY 4.0; DELFI e.V. (<a
          href="https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite"
          >opendata-oepnv.de</a
        >), CC BY 4.0). No guarantee of accuracy – the operator's information is binding.
      </p>
      <h2>External links</h2>
      <p>The operators of linked external websites are solely responsible for their content.</p>
      <h2>Source code</h2>
      <p>
        The source code is published under the AGPL-3.0 on
        <a href="https://github.com/simon04/zugx">GitHub</a>.
      </p>
      <p><RouterLink to="/privacy">Privacy policy</RouterLink></p>
    </template>
  </article>
</template>
