# Garaj

Aplicație web self-hosted pentru administrarea mașinilor personale sau a unei flote mici: documente cu termen de valabilitate, cheltuieli, rate, revizii, anvelope, șoferi și notificări înainte de expirare.

Rulează într-un singur container Docker, cu o bază de date SQLite inclusă. Nu ai nevoie de un server de baze de date separat.

## Funcționalități

- **Panou** cu toate mașinile sau cu mașina selectată: șoferul cu poză, următorul termen, activitatea recentă și rubrici care se deschid sub bară.
- **Date generale și dotări**: specificații, echipament de fabrică, accesorii adăugate, echipament obligatoriu.
- **Registru**: ITP, RCA, CASCO, rovinietă, extinctor, trusă medicală, garanție, cu istoric și mementouri automate.
- **Costuri** pe categorii configurabile (culoare și iconiță), plus **rate recurente** pentru credit, leasing sau asigurări în rate.
- **Statistici**: cost total de deținere, cost pe km, grafic pe 12 luni, evoluția kilometrajului.
- **Combustibil**: alimentări și încărcări cu cantitate, preț, procent baterie și consum; **import din CSV / Excel** (exportul „Charges” din My Renault e recunoscut automat), fără dubluri la reimport.
- **Anvelope** și **baterie** (capacitate, garanție, bateria de 12V din revizii).
- **Alerte** în listă sau calendar, inclusiv pentru permisele și buletinele șoferilor și pentru revizia după kilometraj.
- **Rapoarte** pe an, pe mașini și categorii, cu export CSV.
- **Șoferi** cu carduri în stilul permisului; fiecare șofer are cont în aplicație și vede doar mașina alocată.
- **Notificări pe Telegram**, la ora aleasă.
- **Backup** într-o arhivă .zip (JSON pentru restaurare + CSV pentru Excel) și import din .zip sau din backup-urile mai vechi .grj / .json.

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

Notificările se configurează din **Setări → Notificări Telegram**.

1. Creează un bot cu [@BotFather](https://t.me/BotFather) și copiază tokenul.
2. Trimite un mesaj botului și află chat ID-ul (de exemplu cu @userinfobot).
3. Completează tokenul și chat ID-ul, apoi apasă „Trimite mesaj de test”.

Ora notificărilor și pragurile de prioritate se setează din **Setări → Mementouri**; mementourile se pot opri pentru o anumită mașină din rubrica ei **Setări**.

## Actualizare

```bash
docker compose pull
docker compose up -d
```

Modificările de structură ale bazei de date se aplică automat la pornire. Pentru producție e recomandat să fixezi o versiune concretă în loc de `latest` (de exemplu `romeolazar/garaj:5634572`). Tagurile disponibile sunt pe [Docker Hub](https://hub.docker.com/r/romeolazar/garaj/tags).

## Backup și restaurare

**Din aplicație:** în **Setări → Backup & export** descarci o arhivă `.zip` cu toate datele (`garaj.json` pentru restaurare, folderul `fisiere/` cu pozele și documentele încărcate, `costuri.csv` și `documente.csv` pentru Excel) și o poți importa înapoi, cu tot cu fișiere. Parolele utilizatorilor și tokenul Telegram nu sunt incluse. Conturile create la import primesc o parolă aleatorie, pe care administratorul o schimbă din **Șoferi → Editează**.

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
