# Garaj

Garaj este o aplicatie web pentru administrarea masinilor personale: registru documente, cheltuieli, rate recurente, soferi, notificari si rapoarte.

Aplicatia este publicata si ca imagine Docker:

```bash
docker pull romeolazar/garaj:latest
```

## Deploy Cu Docker Compose

Ai nevoie de Docker si Docker Compose.

1. Creeaza un folder pentru deploy:

```bash
mkdir garaj
cd garaj
```

2. Creeaza fisierul `.env`:

```env
POSTGRES_USER=garaj
POSTGRES_PASSWORD=schimba-cu-o-parola-puternica
POSTGRES_DB=garaj
NEXTAUTH_URL=http://localhost:5001
NEXTAUTH_SECRET=schimba-cu-un-secret-lung-random
```

Pentru `NEXTAUTH_SECRET`, foloseste o valoare lunga si random, de exemplu generata cu:

```bash
openssl rand -base64 32
```

3. Creeaza fisierul `compose.yaml`:

```yaml
name: garaj

services:
  postgres:
    image: postgres:16-alpine
    container_name: garaj-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-garaj}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: ${POSTGRES_DB:-garaj}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-garaj} -d ${POSTGRES_DB:-garaj}"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    image: romeolazar/garaj:latest
    container_name: garaj
    restart: unless-stopped
    command: ["sh", "-c", "npx prisma db push && npm run start -- -p 5001"]
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-garaj}:${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}@postgres:5432/${POSTGRES_DB:-garaj}?schema=public
      NEXTAUTH_URL: ${NEXTAUTH_URL:-http://localhost:5001}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?Set NEXTAUTH_SECRET in .env}
      UPLOAD_DIR: /app/uploads
    ports:
      - "5001:5001"
    volumes:
      - uploads_data:/app/uploads

volumes:
  postgres_data:
  uploads_data:
```

4. Porneste aplicatia:

```bash
docker compose up -d
```

5. Deschide aplicatia:

```text
http://localhost:5001
```

La prima accesare, aplicatia te trimite la `/setup`, unde creezi contul initial de administrator.

## Update

Pentru actualizarea aplicatiei la ultima imagine publicata:

```bash
docker compose pull app
docker compose up -d
```

## Backup

Exportul datelor se poate face din aplicatie, in `Setari -> Export / Import`.

Pentru backup complet al bazei PostgreSQL:

```bash
docker compose exec postgres pg_dump -U garaj garaj > garaj-backup.sql
```

Pentru restaurare:

```bash
docker compose exec -T postgres psql -U garaj garaj < garaj-backup.sql
```

## Rulare Locala Pentru Dezvoltare

Aplicatia nu include parole, token-uri sau date reale in repository.

1. Copiaza `.env.example` in `.env`.
2. Inlocuieste valorile placeholder pentru `POSTGRES_PASSWORD` si `NEXTAUTH_SECRET`.
3. Porneste stack-ul local:

```bash
docker compose up -d --build
```

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
- Schimba mereu `POSTGRES_PASSWORD` si `NEXTAUTH_SECRET` in productie.
- Pentru deploy public, seteaza `NEXTAUTH_URL` la URL-ul real al aplicatiei.
- Datele reale introduse in aplicatie raman in volumul PostgreSQL, nu in imaginea Docker.
