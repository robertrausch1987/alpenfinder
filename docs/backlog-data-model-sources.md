# Backlog, Data Model, Data Sources

Stand: 2026-07-23

## Priorisiertes Product Backlog

### P0: Ehrlicher stabiler Prototyp

1. Audit-Dokumentation im Repository.
2. Strukturiertes Suchprofil.
3. Manuelle Objektaufnahme fuer Marktangebote.
4. Geodatenanreicherung aus aktueller Kartenregion.
5. Erklaerbarer Objekt-Score.
6. Lokales Feedback fuer beide Personen.
7. Klarer Hinweis, welche Daten geschaetzt oder ungeklaert sind.

### P1: Backend-Grundlage

1. FastAPI-Service.
2. PostgreSQL/PostGIS.
3. Datenmodell und Migrationen.
4. Authentifizierung.
5. Objekt- und Feedback-API.
6. Quellenkatalog.
7. Audit-Log.

### P2: Oeffentliche Immobilienquellen

1. Connector-Registry.
2. Erste rechtssichere Quellen mit API/Feed/strukturierter Suche.
3. Import-Normalisierung.
4. Dubletten-Erkennung.
5. Ranking nach Suchprofil.
6. Benachrichtigungen.

### P3: Geospatial Intelligence

1. PostGIS-Analyse.
2. DGM/DOM-Integration.
3. Hang, Exposition, Hoehenband, Wegnaehe, Wassernaehe.
4. Wintersonne.
5. Panorama-/Viewshed-Prototyp.
6. Heatmap fuer Mikroregionen.

### P4: Off-Market Detection

1. Gebaeude- und Parzellenlayer.
2. Kandidatenerkennung aus Dichte, Lage, Weg, Wasser, Flachflaechen.
3. Orthofoto-Review.
4. Computer-Vision-Hinweise mit Konfidenz.
5. manuelle Validierung.

### P5: Recht, Wert, Akquise

1. Kataster-/Grundbuch-Workflow.
2. Fachpartner-Auftraege.
3. Baurechts-Checklisten.
4. Preis-Spannenmodell.
5. Kontaktentwuerfe.
6. Freigabe- und Kontakthistorie.

## Endgueltiges Datenmodell, erste Fassung

Kernentitaeten:

- `user`
- `household`
- `search_profile`
- `preference_signal`
- `region`
- `search_area`
- `micro_region_candidate`
- `property`
- `property_source_record`
- `listing`
- `off_market_candidate`
- `building`
- `parcel`
- `geospatial_analysis`
- `scorecard`
- `valuation`
- `risk_assessment`
- `legal_check`
- `ownership_research_task`
- `contact`
- `outreach_draft`
- `approval`
- `deal_pipeline_item`
- `document`
- `source_connector`
- `source_fetch_log`
- `data_provenance`

Wichtige Statusfelder:

- Faktenstatus: `confirmed`, `likely`, `unclear`, `requires_professional_review`.
- Kandidatentyp: `market_listing`, `off_market`, `development_potential`.
- Pipeline: `discovered`, `auto_scored`, `interesting`, `manual_review`, `identify_contact`, `draft_contact`, `approved_to_contact`, `contacted`, `waiting`, `visited`, `due_diligence`, `offer_prepared`, `offer_sent`, `negotiation`, `rejected`, `acquired`.
- Kontaktfreigabe: `not_requested`, `drafted`, `approved`, `sent`, `blocked`.

## Datenquellen-Katalog

### Bereits vorhanden im Prototyp

- OpenStreetMap Tiles: Basiskarte.
- OpenTopoMap: Topografische Karte.
- Esri World Imagery: Satelliten-/Luftbild-Hintergrund.
- Nominatim: Ortssuche und Reverse Geocoding.
- Photon/Komoot: Fallback-Ortssuche.
- Open-Meteo Elevation: Hoehenwerte.
- Overpass API: OSM-Wege, Gewaesser, Quellen, Gebaeude.
- OSRM Demo Router: Autoroute.

### Direkt integrierbar, rechtlich/lizenzseitig zu pruefen

- GeoBrowser/GeoKatalog Suedtirol: Geodaten des Landes und der Gemeinden.
- OGC-Dienste Suedtirol: WMS, WMTS, WFS, WCS fuer Geodaten.
- Orthofoto 2023 Suedtirol: 20 cm Aufloesung, laut Geokatalog CC BY 4.0.
- Digitale Hoehenmodelle Suedtirol: DGM/DOM mit 2,5 m Raster laut Landesverwaltung.
- Nationale/regionale Geodienste fuer Naturgefahren, Schutzgebiete, Geologie.

### Recherche notwendig

- lokale Maklerseiten in Suedtirol.
- Banken, Versteigerungs- und Insolvenzportale.
- Gemeinden und oeffentliche Verkaufsseiten.
- Spezialplattformen fuer Hoefe, Almen, historische Gebaeude.
- regionale Kleinanzeigen und Newsletter.
- Transaktionsdaten und Bodenrichtwerte.

### Kostenpflichtig oder zugangsbeschraenkt

- Grundbuch- und Katasterauszuege.
- Eigentuemerdaten.
- professionelle Kataster-/Register-APIs.
- hochaufgeloeste kommerzielle Satellitenbilder.
- Marktpreisdatenbanken.

### Rechtlich zu pruefen

- Scraping von Makler- und Portalwebsites.
- Verarbeitung personenbezogener Eigentuemerdaten.
- Speicherung von Grundbuch-/Katasterauszuegen.
- automatisierte Kontaktaufnahme.
- Nutzung von Orthofotos fuer Computer Vision und derivative Daten.

### Nicht voll automatisierbar ohne Freigabe/Partner

- Eigentuemerkontakt bei Off-Market-Objekten.
- Grundbuch-/Katastereinsicht fuer Dritte.
- baurechtliche verbindliche Einschatzung.
- Bewertung von Dienstbarkeiten, Wegerechten, Wasserrechten.
- serioese Kontaktaufnahme an Eigentuemern ohne lokale Pruefung.

## Quellenhinweise fuer die Datenlage

- Autonome Provinz Bozen: GeoBrowser MapView enthaelt geografische Daten des Landes und der Gemeinden: https://natur-raum.provinz.bz.it/de/geobrowser-maps
- Autonome Provinz Bozen: Geodienste stellen Metadaten und OGC-Dienste wie WMS, WMTS, WFS, WCS bereit: https://natur-raum.provinz.bz.it/de/geodienste-nutzen
- Autonome Provinz Bozen: Orthofoto 2023 mit 20 cm Aufloesung und CC BY 4.0 laut GeoKatalog: https://geonetwork1.civis.bz.it/geonetwork/srv/api/records/p_bz%3AOrthoimagery%3AAerial-2023-RGB?language=ger
- Autonome Provinz Bozen: digitale Hoehenmodelle DGM/DOM mit 2,5 m Raster: https://natur-raum.provinz.bz.it/de/digitale-hohenmodelle
- Autonome Provinz Bozen: Grundbuch- und Katastereinsicht online via SPID/CIE/Buergerkarte: https://kataster-grundbuch.provinz.bz.it/de/grundbuch-und-katastereinsicht
- Agenzia delle Entrate: Visura catastale und Online-Katasterdienste fuer Italien; autonome Provinzen Trient/Bozen haben Sonderwege: https://www.agenziaentrate.gov.it/portale/schede/fabbricatiterreni/visura-catastale/visura-catastale-online

## Naechste drei Entwicklungsphasen

### Phase 1: Stabilisierung und Suchprofil

- Dokumentation abschliessen.
- Objektmodell im Frontend einfuehren.
- Marktobjekt manuell/importnah erfassen.
- Geodaten anreichern.
- erklaerbaren Score anzeigen.
- Feedback speichern.

Aktueller Prototyp-Stand:

- Diese Phase ist teilweise clientseitig umgesetzt: Ein oeffentliches Angebot kann manuell erfasst, mit der zuletzt analysierten Kartenlage gespeichert, erklaerbar bewertet, in eine lokale Kandidatenliste aufgenommen und per Status sowie Robert/Partnerin-Feedback weiterqualifiziert werden.
- Noch nicht umgesetzt: zentraler Objektbestand, echter Quellenimport, Backend-API, gemeinsame Nutzung durch zwei Personen, Dubletten, Preis-/Baurechts-/Eigentumsdaten und belastbare Off-Market-Erkennung.

### Phase 2: Quellen und Persistenz

- Backend und Datenbank.
- Quellenconnector-Registry.
- erste legale Importquelle.
- Dubletten- und Aenderungshistorie.
- zentrale Feedbackdaten.

### Phase 3: Geospatial Intelligence

- Suedtiroler DGM/DOM und Orthofoto integrieren.
- PostGIS-Analysen.
- Mikroregionen/Heatmap.
- Viewshed-/Panorama-Prototyp.
- Risiko- und Schutzgebietslayer.
