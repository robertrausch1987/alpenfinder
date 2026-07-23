# Alpenfinder Private Real Estate Agent Audit

Stand: 2026-07-23

## Ergebnis der Bestandsaufnahme

Alpenfinder ist aktuell eine statische, mobile PWA auf GitHub Pages. Sie ist als schneller Standort- und Objektprototyp brauchbar, aber noch kein belastbares Private Real Estate Intelligence System. Der bestehende Code sollte nicht verworfen werden: Kartenbedienung, Gebietsauswahl, erste Standortanalyse, lokale Objektaufnahme und Lernfeedback sind wertvolle Grundlagen. Nicht belastbar sind derzeit echte Objektbeschaffung, Off-Market-Erkennung, Eigentümerrecherche, Katasterprozesse, Preisermittlung, Deal-Pipeline, Datenschutz und gemeinsame Nutzung durch zwei Personen.

## Aktuelle Architektur

- Hosting: GitHub Pages, statische Auslieferung.
- Frontend: `index.html`, `styles.css`, `app.js`.
- Karten: Leaflet, Leaflet.draw, OpenStreetMap, OpenTopoMap, Esri World Imagery.
- Standort- und Geodaten: Nominatim, Photon, Open-Meteo Elevation, Overpass, OSRM, SunCalc.
- Speicherung: Browser-`localStorage`.
- PWA: `manifest.webmanifest`, `sw.js`.
- Build/Test: kein Buildsystem, keine Paketverwaltung, keine automatisierte Testsuite.
- Backend/Datenbank/Auth: nicht vorhanden.

## Was funktioniert bereits

- Mobile PWA mit HTTPS-Veröffentlichung.
- Suche nach Orten und Adressen.
- Auswahl per Punkt, Marker, Rechteck, Polygon, Radius und mehreren Suchgebieten.
- A/B-Segmentierung:
  - A: automatische Vorschlagsregionen.
  - B: vordefinierte eigene Regionen.
- Topografie-, Straßen- und Satellitenkarte.
- Höhenabfrage, Hang- und Expositionsschätzung.
- Wasser-, Wege- und Gebäudehinweise aus OSM/Overpass.
- Standortanalyse und Autorouting.
- Navigation in Google Maps.
- Manuelle Objektaufnahme per Link.
- Lokale Objektkandidaten mit Score, Risiken, nächsten Prüfungen.
- Lokales Lernprofil aus Kommentaren.
- Dossier-Export als JSON.

## Was nur teilweise funktioniert

- Automatische Regionsvorschläge sind kuratierte Startpunkte, noch keine berechneten Heatmaps.
- Marktangebote sind Live-Suchlinks und manuell importierte Objekte, noch keine echten Connectoren.
- Off-Market ist eine Recherche- und Kandidatenspur, noch keine Satelliten- oder Katastererkennung.
- Standortscore ist heuristisch, nicht rasterbasiert und ohne qualifizierte Viewshed-/Panorama-Analyse.
- Feedback lernt lokal im Browser, nicht zentral und nicht sauber nach Robert/Partnerin getrennt.
- Datenqualität wird grob geschätzt, nicht pro Datenpunkt versioniert.
- Pipeline ist rudimentär, nicht als vollständiger Akquiseprozess abgebildet.

## Was sichtbar ist, aber nicht als fertig gelten darf

- "Alle Quellen" bedeutet derzeit portalübergreifende Google-Suche, kein vollständiger Web-Crawler.
- "Live" bedeutet externer Suchlink oder Kartenlink, kein geprüfter Angebotsdatensatz.
- "Kataster-/Flurstückspur" erzeugt nur einen legalen Prüfauftrag, keine Eigentümerdaten.
- "Off-Market merken" legt einen Suchauftrag an, erkennt aber noch keine konkreten Gebäude automatisch.
- Preis- und Wertlogik ist nur ein Plausibilitätssignal, keine belastbare Wertermittlung.

## Gap-Analyse zum Zielbild

Fehlende Produktbausteine:

- Zentrale Datenbank mit PostGIS.
- Authentifizierung, Rollen, Familien- und Partnerzugänge.
- Strukturierte Objekt-, Listing-, Parcel-, Building- und Contact-Modelle.
- Source-Connector-Registry mit rechtlicher Freigabe je Quelle.
- Importnormalisierung, Dubletten, Historien und Monitoring.
- Automatische Mikroregionen-Erkennung aus Geodaten.
- DGM/DOM/Orthofoto-Integration Südtirol.
- Viewshed, Horizontverschattung, Panoramaqualität.
- Naturgefahren-, Schutzgebiets-, Widmungs- und Baurechtslayer.
- Off-Market-Erkennung mit Konfidenz und manueller Validierung.
- Legal Workflow für Kataster, Grundbuch, Eigentümer und Fachpartner.
- Valuation mit Spannen, Datenbasis und Unsicherheit.
- Vollständige Deal-Pipeline mit Fristen, Kontakten und Dokumenten.
- Kontaktentwürfe mit Freigabeprozess.
- Audit-Log, Datenschutz, Backups, Lösch- und Exportkonzept.

## Zielarchitektur

Frontend:

- Kurzfristig: bestehende PWA modularisieren, keine unnötige Migration.
- Mittelfristig: Next.js/TypeScript oder vergleichbare modulare Struktur.
- Karten: Leaflet kann bleiben; MapLibre GL prüfen, sobald eigene Geodatenlayer und Heatmaps dominieren.

Backend:

- Python FastAPI für Geodaten, Objekt-API, Scoring, Connector-Orchestrierung und KI-Ausgaben.
- REST/OpenAPI mit validierten Schemas.
- Job-System für Quellenabruf, Geodatenanreicherung, Scoring, Dedupe, Benachrichtigungen.

Daten:

- PostgreSQL/PostGIS.
- Objekt- und Dokumentenspeicher für Bilder, Exposes, Registerauszüge und Prüfunterlagen.
- Vektorindex für semantische Ähnlichkeit, Feedbacklernen und Dublettenhinweise.
- Provenance pro Datenpunkt: Quelle, Lizenz, Abrufdatum, Konfidenz, Status.

KI:

- Deterministische Berechnungen für Geo, Distanzen, Sonne, Scoring.
- LLM nur für Beschreibungsauswertung, Zusammenfassungen, Aufgabenformulierung und Kontaktentwürfe.
- Computer Vision nur mit Konfidenz und menschlicher Validierung.

## Datenmodell, verbindliche erste Fassung

Kernentitäten:

- `household`
- `user`
- `search_profile`
- `preference_signal`
- `region`
- `search_area`
- `micro_region_candidate`
- `property`
- `listing`
- `property_source_record`
- `off_market_candidate`
- `building`
- `parcel`
- `geospatial_analysis`
- `scorecard`
- `valuation`
- `risk_assessment`
- `legal_check`
- `ownership_research_task`
- `partner`
- `contact`
- `outreach_draft`
- `approval`
- `deal_pipeline_item`
- `document`
- `source_connector`
- `source_fetch_log`
- `data_provenance`

Pflichtstatus:

- Faktenstatus: `confirmed`, `likely`, `estimated`, `unclear`, `requires_professional_review`.
- Kandidatentyp: `market_listing`, `off_market`, `development_potential`, `region_watch`.
- Pipeline: `discovered`, `auto_scored`, `interesting`, `manual_review`, `identify_contact`, `draft_contact`, `approved_to_contact`, `contacted`, `waiting`, `conversation`, `documents_requested`, `visit_planned`, `visited`, `due_diligence`, `offer_prepared`, `offer_sent`, `negotiation`, `rejected`, `acquired`.
- Kontaktfreigabe: `not_requested`, `drafted`, `approved`, `sent`, `blocked`.

## Agenten- und Workflowarchitektur

Keine frei laufende Agentenwolke. Stattdessen orchestrierte Komponenten:

- Preference Agent: Suchprofil, Robert/Partnerin-Feedback, Gewichtungen.
- Region Discovery Agent: Mikroregionen, Heatmaps, Begründungen.
- Geospatial Analysis Agent: Höhe, Hang, Sonne, Wasser, Wege, Risiken, Panorama.
- Listing Discovery Agent: legale Quellenconnectoren und Suchaufträge.
- Off-Market Detection Agent: Gebäude- und Grundstückshinweise mit Konfidenz.
- Deduplication Agent: gleiche Objekte über Quellen hinweg.
- Planning & Zoning Agent: Widmung, Schutz, Denkmalschutz, offene Fachfragen.
- Risk Analysis Agent: Naturgefahren, Lärm, Erreichbarkeit, Infrastruktur.
- Valuation Agent: Preisspannen und Kostenunsicherheit.
- Ownership Research Agent: legale Kataster-/Grundbuch- und Partneraufträge.
- Outreach Preparation Agent: individuelle Entwürfe, nie Versand ohne Freigabe.
- Deal Pipeline Agent: Status, Frist, nächste Aktion, Historie.

## Quellenstatus

Bereits im Prototyp:

- OpenStreetMap, OpenTopoMap, Esri World Imagery.
- Nominatim, Photon.
- Open-Meteo Elevation.
- Overpass API.
- OSRM Demo Router.

Direkt integrierbar, Lizenz/Technik je Layer zu prüfen:

- GeoBrowser/GeoKatalog Südtirol.
- OGC-Dienste Südtirol.
- Digitale Höhenmodelle DGM/DOM Südtirol.
- Orthofotos Südtirol.
- Naturgefahren, Schutzgebiete, Geologie, Raumplanungslayer.

Recherche notwendig:

- Südtiroler Maklerseiten, Banken, Versteigerungen, Gemeinden, Höfe/Sonderimmobilien, lokale Marktplätze, Newsletter, strukturierte Daten.

Kostenpflichtig oder zugangsbeschränkt:

- Grundbuch-/Katasterauszüge, Eigentümerdaten, professionelle Bewertungsdaten, kommerzielle Satellitendaten.

Nicht automatisch ohne Freigabe/Partner:

- Eigentümeridentifikation, rechtsverbindliche Baurechtsauskunft, Dienstbarkeiten, Wasserrechte, Kontaktaufnahme.

## Priorisiertes Backlog

P0: Ehrliche, stabile End-to-End-Strecke

1. Audit und Gap-Analyse im Repository aktualisieren.
2. Suchprofil realistischer auf das Zielobjekt setzen.
3. Objektaufnahme mit Datenstatus und Quelle.
4. Score in erklärbare Teilbereiche zerlegen.
5. Robert/Partnerin-Feedback getrennt speichern.
6. Pipeline-Schritte sichtbarer machen.
7. Export um Datenmodellfelder erweitern.

P1: Persistenz und Quellenbasis

1. Backend-API.
2. PostgreSQL/PostGIS-Schema.
3. Authentifizierung.
4. Quellenconnector-Registry.
5. Erste legale Importquelle.
6. Dedupe und Änderungsverlauf.

P2: Geospatial Intelligence

1. DGM/DOM Südtirol.
2. Orthofoto- und Layerkatalog.
3. Mikroregionen-Raster.
4. Wintersonne und Horizontverschattung.
5. Viewshed-/Panorama-Prototyp.
6. Risiko- und Schutzgebietslayer.

## Nächste drei Entwicklungsphasen

Phase 1, jetzt:

- PWA stabilisieren.
- Suchprofil, Objektaufnahme, Geodaten, Score, Paar-Feedback, Pipeline lokal konsistent machen.
- Keine erfundenen Daten.

Phase 2:

- Backend, Datenbank und Quellenregistry.
- Erste echte, rechtlich saubere Quelle.
- Zentrale Objektliste und gemeinsames Feedback.

Phase 3:

- Südtiroler Geodaten integrieren.
- Automatische Mikroregionen und Heatmaps.
- Vorbereitung Off-Market-Erkennung mit Konfidenzmodell.

