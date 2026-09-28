# Mailbook

Piccola web app locale per raccogliere, modificare, ordinare ed esportare in Word testi di mail e ticket.

## Funzioni

- Creazione e modifica testi
- Editor rich-text
  - grassetto
  - corsivo
  - sottolineato
  - barrato
  - evidenziatore
  - elenchi puntati e numerati
  - allineamento
  - link
  - undo / redo
- Autosalvataggio nel browser
- Ricerca
- Duplicazione
- Eliminazione
- Riordino drag & drop
- Numerazione romana automatica
- Anteprima documento
- Export `.docx`
- Sommario iniziale con tutti i titoli

## Avvio

È necessario avere Node.js installato.

Aprire un terminale nella cartella `mailbook` ed eseguire:

```bash
npm install
npm run dev
```

Vite mostrerà un indirizzo locale, normalmente:

```text
http://localhost:5173
```

Aprirlo nel browser.

## Build

Per creare la versione di produzione:

```bash
npm run build
```

I file saranno generati nella cartella `dist`.

## Dove vengono salvati i testi?

Per questa prima versione i dati sono salvati nel `localStorage` del browser.

Questo significa che:

- non serve un database;
- i testi restano sul PC/browser dove vengono inseriti;
- cancellare i dati del browser può cancellare l'archivio.

Per un utilizzo più importante conviene aggiungere una funzione di backup/import JSON o passare a IndexedDB/backend.

## Scorciatoie

- `Ctrl + S` salva
- `Ctrl + N` nuovo testo
- `Ctrl + B` grassetto
- `Ctrl + I` corsivo
- `Ctrl + U` sottolineato

## Export Word

Il pulsante **Esporta Word** genera:

1. pagina `SOMMARIO`;
2. sezione `1. TESTI MAIL E TICKET`;
3. elenco dei titoli in numeri romani;
4. una pagina per ciascun testo;
5. formattazione rich-text compatibile con Word per le funzioni principali.

## Struttura

```text
mailbook/
├─ index.html
├─ package.json
├─ README.md
└─ src/
   ├─ main.js
   ├─ style.css
   ├─ storage.js
   ├─ roman.js
   └─ docxExport.js
```
