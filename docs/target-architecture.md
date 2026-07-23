# Alpenfinder Target Architecture

Stand: 2026-07-23

## Zielbild

Alpenfinder soll ein Private Real Estate Intelligence System werden, das wenige, aussergewoehnlich passende Chancen identifiziert:

- Marktangebote.
- Off-Market-Kandidaten.
- Objekte mit verborgenem Entwicklungs- oder Umnutzungspotenzial.

Kritische Prinzipien:

- Keine erfundenen Fakten.
- Keine illegalen Datenzugriffe.
- Keine Nachricht ohne Freigabe.
- Fakten, Schaetzungen und Annahmen getrennt speichern.
- Jede Datenquelle mit Herkunft, Abrufdatum, Lizenz, Genauigkeit und Konfidenz.

## Empfohlene Zielarchitektur

### Frontend

- Next.js, React, TypeScript.
- MapLibre GL oder Leaflet/MapLibre-Hybrid.
- PWA-Unterstuetzung.
- Views: Dashboard, Karte, Objektliste, Objektansicht, Vergleich, Pipeline, Partner/Kontakte.
- Offline nur fuer Lesen/Notizen, nicht fuer Datenimport.

### Backend

- Python FastAPI fuer Geodaten, Scoring, Crawler-Orchestrierung und KI-Aufrufe.
- REST API mit OpenAPI-Schemas.
- Hintergrundjobs fuer Crawler, Geodatenanalyse, Bilderkennung und Wiedervorlagen.

### Datenhaltung

- PostgreSQL + PostGIS.
- Objekt-/Dokumentspeicher fuer Bilder, PDFs, Exposes, Registerauszuege.
- Vektorsuche fuer semantische Aehnlichkeit von Beschreibungen und Praeferenzlernen.
- Historientabellen fuer Preise, Quellen, Status und Feedback.

### Aufgabenverarbeitung

- Queue-System mit Retry, Prioritaet, Kostenlimit und Protokollierung.
- Jobs: Quellenimport, Normalisierung, Geocoding, Geodatenanreicherung, Scoring, Bildanalyse, Dubletten, Benachrichtigungen.

### KI und Analyse

- Deterministisch: Geodaten, Distanzen, Raster, Scoring, Regeln.
- KI: Beschreibungsauswertung, Bild-/Satellitenhinweise, Zusammenfassungen, Outreach-Entwuerfe.
- Alle KI-Ausgaben mit Schema, Konfidenz und Begruendung.

## Agenten- und Workflowarchitektur

Keine freie Agenten-Sammlung. Stattdessen orchestrierte Komponenten:

- Preference Agent: Suchprofil, Paar-Feedback, Gewichtungen.
- Region Discovery Agent: geeignete Mikroregionen und Heatmaps.
- Geospatial Analysis Agent: Hoehe, Hang, Sonne, Sicht, Risiken.
- Listing Discovery Agent: legale Quellenconnectoren.
- Off-Market Detection Agent: Gebaeude/Grundstueck-Kandidaten aus Geodaten und Bildern.
- Deduplication Agent: gleiche Objekte ueber Quellen hinweg.
- Planning & Zoning Agent: Widmung, Baurecht, Schutzgebiete, offene Pruefpunkte.
- Risk Analysis Agent: Naturgefahren, Laerm, Erreichbarkeit, Infrastruktur.
- Valuation Agent: Preisspannen mit Unsicherheiten.
- Ownership Research Agent: legale Kataster-/Grundbuch-Workflows und Fachpartneraufgaben.
- Outreach Preparation Agent: Anschreiben und Freigabeprozess.
- Deal Pipeline Agent: Status, naechste Aktion, Fristen, Historie.

Jede Komponente braucht:

- Eingabeschema.
- Ausgabeschema.
- Datenquellen.
- Konfidenz.
- Kostenlimit.
- Fehlerbehandlung.
- Audit-Log.
- menschliche Freigabepunkte.

## End-to-End-Zielstrecke

1. Suchprofil anlegen.
2. Region auf Karte waehlen.
3. Objekt importieren oder Kandidat erkennen.
4. Geodaten anreichern.
5. Objekt bewerten.
6. Datenqualitaet und offene Fragen anzeigen.
7. Paar-Feedback speichern.
8. Objekt in Pipeline uebernehmen.
9. Rechtliche/Eigentumspruefung als Workflow starten.
10. Kontakt vorbereiten.
11. Kontakt nur nach expliziter Freigabe senden.

## Scoring-Modell

Scores getrennt ausweisen:

- Harte Standortkriterien: Hoehe, Hang, Erreichbarkeit, Strasse, Wasser, Risiken.
- Qualitative Kriterien: Panorama, Refugium-Charakter, Authentizitaet, Privatsphaere, Ankunftsgefuehl.
- Objektkriterien: Wohnflaeche, Grundstueck, Baujahr, Nebengebaeude, Zustand, Entwicklungspotenzial.
- Prozesskriterien: Preis, Erwerbswahrscheinlichkeit, Datenqualitaet, offene Rechtsfragen.

Jeder Score muss erklaerbar sein:

- Wert.
- Datenbasis.
- Konfidenz.
- staerkste Argumente.
- groesste Risiken.
- naechste Aktion.

## Datenschutz und Freigaben

- Authentifizierung mit 2FA.
- Rollen fuer Familie, Berater, lokale Partner.
- personenbezogene Daten getrennt und verschluesselt speichern.
- Opt-outs und Kontaktverbote.
- keine personenbezogenen Daten in Logs.
- keine Kontaktaufnahme ohne Objekt- und Empfaengerfreigabe.
- Loesch- und Exportfunktion.
