# AlpenFinder MVP

Mobile PWA zur Vorprüfung alpiner Grundstücke. Funktionen: Orts- und Kartensuche, Satellit/Topografie, Standortanalyse, lokale Hangschätzung, Ausrichtung, Höhenlage, Sonnenzeiten, Wege/Gebäude/Wasserhinweise, Favoriten und Routenprüfung vom aktuellen Standort.

## Sofort lokal testen
Ein einfacher statischer Webserver ist nötig (nicht direkt per file:// öffnen):

```bash
python3 -m http.server 8080
```
Dann `http://localhost:8080` öffnen.

## Ohne Mac auf iPhone/iPad nutzen
Die Dateien in ein GitHub-Repository legen und als statische Seite auf Cloudflare Pages, GitHub Pages, Netlify oder Vercel veröffentlichen. Kein Build-Schritt nötig; Ausgabeordner ist das Projektverzeichnis.

## Installation auf iPhone/iPad
In Safari öffnen → Teilen → „Zum Home-Bildschirm“.

## Grenzen
- Öffentliche APIs können zeitweise gedrosselt sein.
- Hangneigung ist eine Näherung aus fünf Höhenpunkten.
- Sonnenstunden sind zunächst astronomisch und berücksichtigen noch keine vollständige Horizontabschattung.
- OSM-Wege beweisen weder Befahrbarkeit, privates Wegerecht noch Winterdienst.
- Quellen/Wasser sind nur kartierte Hinweise.
- Vor Besichtigung sind amtliche Naturgefahrenkarten, Kataster, Baurecht und Eigentümerzustimmung separat zu prüfen.
