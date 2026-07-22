# Alpenfinder Current-State Audit

Stand: 2026-07-22

## Kurzfazit

Alpenfinder ist aktuell eine statische, clientseitige PWA. Sie eignet sich als mobiler Prototyp zur manuellen Standortvorpruefung, ist aber noch kein professionelles Private Real Estate Intelligence System. Es gibt keine Datenbank, kein Backend, keine echten Crawler, keine Authentifizierung, keine rollenbasierte Datenhaltung und keine belastbaren Kataster-, Eigentums-, Bewertungs- oder Outreach-Prozesse.

## Aktuelle Systemarchitektur

- Hosting: GitHub Pages als statische Website.
- Laufzeit: Browser-only PWA mit Service Worker und lokalem Cache.
- Datenhaltung: `localStorage` im jeweiligen Browser/Geraet.
- Build: kein Build-Schritt, keine Paketverwaltung, keine Testsuite.
- Offline: statische Kern-Dateien werden gecacht; externe Karten- und API-Dienste brauchen Netzwerk.
- Deployment: Commit auf `main` im Repository `robertrausch1987/alpenfinder`.

## Sprachen und Frameworks

- HTML: `index.html`
- CSS: `styles.css`
- JavaScript: `app.js`
- Kartenbibliothek: Leaflet 1.9.4
- Zeichenwerkzeug: Leaflet.draw 1.0.4
- Sonne: SunCalc 1.9.0
- PWA: `manifest.webmanifest`, `sw.js`

## Bestehende Karten- und Geodatenfunktionen

Funktioniert:

- Leaflet-Karte mit OSM-Strassenkarte, OpenTopoMap und Esri World Imagery.
- Ortssuche ueber Nominatim, Fallback Photon.
- Auswahl per Punkt, Marker-Drag, Polygon, Rechteck und Radius.
- Mehrere gezeichnete Suchgebiete.
- Hoehenabfrage ueber Open-Meteo Elevation.
- Lokale Hang- und Expositionsschaetzung aus fuenf Hoehenpunkten.
- OSM/Overpass-Abfrage fuer Wege, Wasser, Quellen, Gebaeude.
- Route vom aktuellen Standort ueber OSRM.
- Google-Maps-Navigationslink.
- Lokale Favoriten und lokales Lernprofil.

Nur teilweise belastbar:

- Hangneigung ist eine grobe Naeherung, kein hochaufgeloestes DGM.
- Sonnenstunden sind astronomisch; Horizontverschattung durch Berge, Wald und Gebaeude fehlt.
- Wege/Wasser/Gebaeude sind nur so gut wie OSM/Overpass-Daten.
- Gezeichnete Flaechen werden ueber Stichpunkte analysiert, nicht vollflaechig gerastert.
- Off-Market-Funktion ist aktuell nur eine Such- und Pruefspur, keine automatische Erkennung.

## Bestehende Immobilienquellen

Vorhanden sind Suchlinks, keine echten Datenimporte:

- Google-Suche ueber Immobilienportale wie immobiliare.it, idealista.it, casa.it, subito.it.
- AT/CH-Suchlink ueber immoscout24.at, willhaben.at, immoscout24.ch.
- Off-Market-Suchlinks zu Google Maps und Suchbegriffen fuer Kataster/Flurstuecke.

Nicht vorhanden:

- Keine Connectoren.
- Keine offiziellen Portal-APIs.
- Kein Scraping.
- Keine Dublettenerkennung.
- Keine Preishistorie.
- Keine Objektpersistenz ausser lokalen Favoriten/Feedback.

## Bestehende Bewertungslogik

Vorhanden:

- Standortscore aus Hangneigung, Wegnaehe, Wintersonne, Exposition, Gebaeudeumfeld.
- Bergrefugium-Modus mit positiven Suchbegriffen und Ausschluessen fuer Luxus/Prestige/Neubau.
- Einfaches Lernprofil aus Nutzerkommentaren.

Grenzen:

- Scoring ist heuristisch und nicht als Datenmodell versioniert.
- Gewichtungen sind nur teilweise einstellbar.
- Keine getrennten Scores fuer Panorama, Risiko, Baurecht, Preis, Erwerbswahrscheinlichkeit.
- Keine Datenqualitaets- oder Konfidenzberechnung pro Datenpunkt.

## Bestehende Benutzeroberflaeche

Vorhanden:

- Mobile Kartenansicht.
- Seitenpanel fuer Standortanalyse.
- Kriterien und Wunschobjektprofil.
- Lernprofil.
- Ergebnis-Karten.
- Favoriten.

Nicht vorhanden:

- Dashboard.
- Objektliste.
- Objekt-Detailansicht.
- Vergleichsansicht.
- Deal-Pipeline.
- Dokumentenbereich.
- Kontaktverlauf.
- Rollen/Rechte.

## KI- oder Agentenfunktionen

Nicht vorhanden. Das aktuelle System nutzt keine LLMs, keine Embeddings, keine Computer Vision und keine orchestrierten Agenten. Die vorhandene Lernfunktion ist regelbasiert und lokal.

## Technische Schulden

- Monolithische `app.js` mit UI, Geodaten, Persistenz und Scoring in einer Datei.
- Keine Typisierung.
- Keine Tests.
- Keine strukturierte Datenmodelle oder Schemas.
- Browser-`localStorage` ist nicht multi-user- oder geraeteuebergreifend.
- Externe APIs werden direkt aus dem Browser aufgerufen.
- Keine API-Key-/Secret-Strategie.
- Keine Fehlertelemetrie.
- Keine Barrierefreiheits- oder Performance-Pruefung ausser manueller Mobile-Tests.

## Sicherheits- und Datenschutzrisiken

- Kein Login; jede gespeicherte Information liegt ungeschuetzt im Browserprofil.
- Keine Verschluesselung personenbezogener oder sensibler Daten.
- Kein Audit-Log.
- Kein Loesch- oder Exportkonzept ausser Browserdaten loeschen.
- Keine kontrollierten Freigabeschritte fuer kuenftigen Outreach.
- Keine rechtliche Pruefung fuer automatisierte Eigentumsdatenverarbeitung.

## Sichtbare, aber nicht belastbare Funktionen

- `A) Am Markt angebotene Objekte`: derzeit nur vorqualifizierte Suchlinks, keine echten importierten Angebote.
- `B) Off-Market-Kandidaten`: derzeit nur Recherchelinks, keine automatische Satelliten-/Katastererkennung.
- `Gelerntes Suchprofil`: dauerhaft pro Geraet, nicht zentral, nicht robust genug fuer Paar-Feedback.
- `Bergrefugium-Modus`: wirkt auf Suchbegriffe, aber noch nicht auf echtes Ranking importierter Objekte.

## Gap-Analyse

Funktioniert bereits:

- Mobile PWA.
- Kartenauswahl und gezeichnete Suchgebiete.
- Basis-Geodatenanalyse fuer einen Punkt oder ein Gebiet.
- Lokales Feedback-Lernen.
- Lokale Favoriten.

Funktioniert nur teilweise:

- Geospatial Intelligence.
- Immobilienquellen.
- Off-Market-Suche.
- Scoring.
- PWA-Offlineverhalten.

Fehlt fuer das Zielbild:

- Backend, Datenbank, PostGIS, Objektmodell, Quellenconnectoren, Pipeline, zentrale Nutzer- und Feedbackdaten, echte Objektimporte, Eigentums-/Kataster-Workflows, Preisbewertung, Deal-Management, Kontaktfreigaben, Dokumentenmanagement, Audit und Datenschutz.

Ueberarbeiten statt neu bauen:

- Karteninteraktion, PWA-Grundgeruest, manuelle Gebietsauswahl, bestehende Geodatenabfragen und Lernfeedback koennen bleiben.
- Scoring, Persistenz, Quellenlogik und Objektverwaltung muessen strukturiert neu gefasst werden.

Langfristig tragfaehig:

- Frontend als PWA ja, aber mit modularer App-Struktur.
- Statisches GitHub Pages alleine nein. Erforderlich ist eine Backend- und Datenplattform.
