# Garaj

Garaj este o aplicatie web pentru administrarea masinilor personale: registru documente, cheltuieli, rate recurente, soferi, notificari si rapoarte.

Aplicatia este publicata si ca imagine Docker:

```bash
docker pull romeolazar/garaj:latest
```

## Deploy Cu Docker

Aplicatia ruleaza intr-un singur container: serverul web, mementourile (Telegram/email) si baza de date SQLite. Toate datele stau in volumul montat la `/app/data`.

Varianta cea mai simpla:

```bash
docker run -d --name garaj --restart unless-stopped \
  -p 5001:5001 \
  -v garaj_data:/app/data \
  romeolazar/garaj:latest
```

Sau cu Docker Compose, intr-un fisier `compose.yaml`:

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

```bash
docker compose up -d
```

Deschide `http://localhost:5001`. La prima accesare, aplicatia te trimite la `/setup`, unde creezi contul initial de administrator.

Variabile optionale:

| Variabila | Implicit | Rol |
| --- | --- | --- |
| `NEXTAUTH_URL` | `http://localhost:5001` | URL-ul public al aplicatiei; seteaza-l cand o expui in retea/internet. |
| `NEXTAUTH_SECRET` | generat automat | Daca lipseste, se genereaza o data si se salveaza in `/app/data/.nextauth_secret`. |
| `REMINDER_POLL_SECONDS` | `300` | Cat de des se verifica mementourile. |
| `TZ` | `Europe/Bucharest` | Fusul orar pentru ora notificarilor. |

## Update

```bash
docker compose pull
docker compose up -d
```

Migrarile bazei de date se aplica automat la pornire.

## Backup

Exportul datelor se poate face din aplicatie, in `Setari -> Export / Import`. Parolele utilizatorilor si secretele de notificare nu sunt incluse.

Pentru o copie completa, copiaza baza SQLite din container:

```bash
docker compose stop garaj
docker compose cp garaj:/app/data/garaj.db ./garaj-backup.db
docker compose start garaj
```

Pentru restaurare, opreste containerul, copiaza fisierul inapoi la `/app/data/garaj.db` si reporneste.

## Migrare De La Versiunea Cu PostgreSQL

Versiunile anterioare foloseau 3 containere (aplicatie, worker, PostgreSQL). Pentru a trece pe varianta cu un singur container:

1. In versiunea veche, exporta datele din `Setari -> Export / Import` si noteaza setarile de notificare (Telegram, Gmail).
2. Opreste stack-ul vechi: `docker compose down` (volumul PostgreSQL ramane pe disc).
3. Porneste noua versiune, creeaza administratorul in `/setup`, apoi importa fisierul exportat din `Setari`.
4. Reseteaza parolele soferilor din `Utilizatori` si completeaza din nou setarile de notificare.
5. Dupa ce ai verificat datele, poti sterge volumul vechi: `docker volume rm garaj_postgres_data_v2`.

## Rulare Locala Pentru Dezvoltare

Aplicatia nu include parole, token-uri sau date reale in repository.

1. Copiaza `.env.example` in `.env`.
2. `npm install && npx prisma migrate deploy`
3. `npm run dev`

Sau construieste imaginea local: `docker compose up -d --build`.

Seed-ul demo este optional. Ruleaza `npm run prisma:seed` doar daca ai setat explicit `SEED_ADMIN_PASSWORD` in mediul local.

## Functionalitati

- Panou principal cu masini, costuri, registru si activitate recenta.
- Registru pentru ITP, RCA, CASCO, rovinieta, extinctor si trusa medicala.
- Cheltuieli pe masina, inclusiv kilometraj si note.
- Rate recurente pentru credit auto, CASCO, RCA, leasing sau alte obligatii.
- Soferi cu roluri: administrator si sofer.
- Acces limitat pentru sofer la masina alocata.
- Profil sofer cu permis si memento CI.
- Notificari Telegram si email prin Gmail SMTP.
- Export si import JSON.
- Rapoarte pe baza datelor introduse.

## Configurare Notificari

Telegram:

- seteaza `Telegram bot token`
- seteaza `Telegram chat ID`
- foloseste butonul de test din Setari

Email:

- aplicatia foloseste Gmail SMTP
- seteaza utilizatorul Gmail
- seteaza o App Password Gmail
- foloseste butonul de test din Setari

## Note De Securitate

- Nu publica fisierul `.env`.
- Daca setezi manual `NEXTAUTH_SECRET`, foloseste o valoare lunga si random (`openssl rand -base64 32`).
- Pentru deploy public, seteaza `NEXTAUTH_URL` la URL-ul real al aplicatiei.
- Datele reale introduse in aplicatie raman in volumul `/app/data`, nu in imaginea Docker.
