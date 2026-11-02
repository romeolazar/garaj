# Garaj

Aplicație web self-hosted pentru administrarea mașinilor personale sau a unei flote mici: documente cu termen de valabilitate, cheltuieli, rate, revizii, anvelope, șoferi și notificări înainte de expirare.

Rulează într-un singur container Docker, cu o bază de date SQLite inclusă. Nu ai nevoie de un server de baze de date separat.

## Funcționalități

- **Panou principal** cu mașinile, costurile, documentele care expiră și activitatea recentă.
- **Registru de documente**: ITP, RCA, CASCO, rovinietă, extinctor, trusă medicală, garanție.
- **Cheltuieli** pe mașină, cu categorie, kilometraj și note.
- **Rate recurente** pentru credit auto, leasing, CASCO, RCA sau alte obligații, cu evidența plăților.
- **Revizii și anvelope** pentru fiecare mașină.
- **Alerte** pentru documentele care expiră, cu notificări pe Telegram și pe email (Gmail).
- **Rapoarte** de costuri pe baza datelor introduse.
- **Utilizatori** cu două roluri: administratorul vede tot, iar șoferul vede doar mașina alocată lui.
- **Profil șofer** cu datele permisului și ale cărții de identitate, plus mementouri de expirare.
- **Export și import JSON** pentru backup, plus export CSV.

## Pornire rapidă

```bash
docker run -d --name garaj --restart unless-stopped \
  -p 5001:5001 \
  -v garaj_data:/app/data \
  romeolazar/garaj:latest
```

Deschide `http://localhost:5001`. La prima pornire ești redirecționat la `/setup`, unde creezi contul de administrator.

## Docker Compose

Creează un fișier `compose.yaml`:

```yaml
name: garaj

services:
  garaj:
    image: romeolazar/garaj:latest
    container_name: garaj
    restart: unless-stopped
    environment:
      NEXTAUTH_URL: http://localhost:5001
    ports:
      - "5001:5001"
    volumes:
      - garaj_data:/app/data

volumes:
  garaj_data:
```

Apoi pornește aplicația:

```bash
docker compose up -d
```

## Configurare

Toate variabilele sunt opționale.

| Variabilă | Implicit | Descriere |
| --- | --- | --- |
| `NEXTAUTH_URL` | `http://localhost:5001` | Adresa la care accesezi aplicația. Trebuie să fie exact URL-ul din browser, inclusiv `https://` dacă folosești un reverse proxy. |
| `NEXTAUTH_SECRET` | generat automat | Cheia pentru sesiunile de login. Dacă lipsește, se generează la prima pornire și se salvează în `/app/data/.nextauth_secret`. |
| `REMINDER_POLL_SECONDS` | `300` | La câte secunde se verifică dacă sunt notificări de trimis. |
| `TZ` | `Europe/Bucharest` | Fusul orar folosit pentru date și notificări. |

Toate datele (baza de date și cheia de sesiune) stau în volumul montat la `/app/data`. Imaginea Docker nu conține date.

### Notificări

Notificările se configurează din aplicație, în **Setări**.

**Telegram**
1. Creează un bot cu [@BotFather](https://t.me/BotFather) și copiază tokenul.
2. Află chat ID-ul conversației în care vrei să primești mesajele.
3. Completează `Telegram bot token` și `Telegram chat ID`, apoi apasă butonul de test.

**Email (Gmail)**
1. Activează verificarea în doi pași pe contul Google și creează o [App Password](https://myaccount.google.com/apppasswords).
2. Completează adresa Gmail și App Password, apoi apasă butonul de test.

Emailurile pleacă spre șoferul mașinii și spre utilizatorul care a adăugat-o.

## Actualizare

```bash
docker compose pull
docker compose up -d
```

Modificările de structură ale bazei de date se aplică automat la pornire. Pentru producție e recomandat să fixezi o versiune concretă în loc de `latest` (de exemplu `romeolazar/garaj:5634572`). Tagurile disponibile sunt pe [Docker Hub](https://hub.docker.com/r/romeolazar/garaj/tags).

## Backup și restaurare

**Din aplicație:** în **Setări** poți exporta toate datele într-un fișier JSON și le poți importa înapoi. Parolele utilizatorilor și setările de notificare nu sunt incluse în export.

**Copie completă a bazei de date:**

```bash
docker compose stop garaj
docker compose cp garaj:/app/data/garaj.db ./garaj-backup.db
docker compose start garaj
```

**Restaurare:**

```bash
docker compose stop garaj
docker compose cp ./garaj-backup.db garaj:/app/data/garaj.db
docker compose start garaj
```

## Securitate

- Dacă expui aplicația pe internet, pune-o în spatele unui reverse proxy cu HTTPS (Caddy, Nginx, Traefik) și setează `NEXTAUTH_URL` la adresa publică.
- Dacă setezi manual `NEXTAUTH_SECRET`, folosește o valoare lungă și aleatoare: `openssl rand -base64 32`.
- Fă backup regulat la volumul `/app/data`.

## Dezvoltare

Ai nevoie de Node.js 22.

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev
```

Aplicația pornește pe `http://localhost:3000`. Pentru a testa imaginea Docker local:

```bash
docker compose up -d --build
```

Date demo (opțional): setează `SEED_ADMIN_PASSWORD` (și, opțional, `SEED_ADMIN_EMAIL`) în `.env`, apoi rulează `npm run prisma:seed`.

**Tehnologii:** Next.js 15, React 19, Prisma, SQLite, NextAuth, Tailwind CSS.
