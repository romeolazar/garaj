Numele aplicatiei: garaj

## Rulare locala

Aplicatia nu include parole, token-uri sau date reale in repository. Pentru rulare locala:

1. Copiaza `.env.example` in `.env`.
2. Inlocuieste valorile placeholder pentru `POSTGRES_PASSWORD` si `NEXTAUTH_SECRET`.
3. Porneste aplicatia cu Docker Compose:

```bash
docker compose up -d --build
```

La prima accesare, aplicatia deschide pagina `/setup`, unde se creeaza contul initial de administrator.

Seed-ul demo este optional. Ruleaza `npm run prisma:seed` doar daca ai setat explicit `SEED_ADMIN_PASSWORD` in mediul local.

Descriere: Aplicatia functioneaza precum un asistent personal si reprezinta un instrument extrem de util proprietariilor de masini din Romania.
Este simplu de utilizat, trebuie doar introduse datele masinii si aplicatia va trimite notificari din timp atunci cand urmeaza sa expire:
- Autorizatia ITP
- RCA
- CASCO
- Rovinieta
- Trusa Medicala
- Extinctor

Daca ai de platit rate la masina, aplicatia iti va aminti si cand e termenul de plata.

Workflow:

Aplicatia la prima accesare te va invita sa iti faci un cont.
Acesta va fi contul de administrator, care va permite sa se stearga sau sa se adauge utilizatori.
Daca se introduc mai multe masini, se pot aloca soferi, iar acesta poate avea contului cu masina alocata de administrato. El va putea vedea toate informatii vehiculului alocat.

Dupa setarea contului de admin, se adauga vehicul.
La introducere se vor cere urmatoarele date:
- Nr. inmatriculare
- Marca, Model. Aici daca exita o baza de date cu toate modele se poate implenta, daca nu utilizatorul va introduce manual Marca si modelul.
- Nr. Identificare
- Serie CIV
- Serie Certificat de inmatriculare
- Capacitate cilindrica
- Putere (kW dar si conversie in CP)
- Culoare
- Masa totala
- Combustibil (Electric, Diesel, GPL, Benzina, Hyrid)
- Nr. locuri
- An de fabricatie
- Garantie.
- Nota, unde sa se poate trece nivelul de dotari a masinii, sau alte specificatii.
- Imagine png/jpg fie cu masina fie cu logo-ul masinii.
- ITP (Se afiseaza un calendar dar si posibilitatea introducerii manuale a datei. Poate fi si o selectie de tip roll pe zi/luna/an ca pe iPhone). Se va introduce si se va mentiona sa se introduca urmatoarea inspectie technica. se va selecta un reminder predefinit cu 30,7,3,1 zi inainte.
- RCA, valabil pana la: (Se afiseaza un calendar dar si posibilitatea introducerii manuale a datei. Poate fi si o selectie de tip roll pe zi/luna/an ca pe iPhone). Se va introduce si se va mentiona sa se introduca urmatoarea inspectie technica. se va selecta un reminder predefinit cu 30,7,3,1 zi inainte.
- CASCO (aceeasi logica)
- Rovinieta
- Extinctor
- Trusa medicala
- Rata Masina (lunar, trimestrial, semestrial)
- Rata Casco (luna, trimestrial, semestrial, anual)
- Pret de achizitie, pentru vehicul nou.

Astea sunt datele masinii si se vor crea automat Mementouri/reminder care vor aparea in dashboard.

Dupa care pe fiecare masina se pot adauga si contoriza:

- Revizii. (data, kilometraj, cost.) Un camp de nota in care se vor trece operatiile facute de service. Se va adauga si un memento de la ultima revizie. Ele sunt anuale.
- Alte cheltuieli (Se vor face diverse). Alimentare, Incarcare, Spalatorie, Parcare, Accesorii, Reparatii infara reviziei, Subscriptii).
- Anvelope (tip, marca, model, dimensiuni, cost,) ca data vom trece data achizitiei si cat timp a trecut de la achizite.

In dashboard vreau Numarul de Masini, Urmtorul memento, cel mai aproape.
Activitate recenta
Total cheltuieli pe masina.

Important:

Unele masini au istoric, unele sunt noi, deci trebuie sa existe si posibilitatea adaugarii in trecut, pentru a putea cuantifica toate costurile.
tot in dashboard, vreau total cost revizii.

La setarile utilizatorului, vreau:
nume, prenume, poza de profil.
Permis: categorie, data obtinere, data expirare.
CI: data obtinere, data expirare

La setari vreau:

- Modul Dark/Light/System
- Telegram notification: Add telegram bot and chatid:
- Email notification. smtp (usuallyu google)
- Data export (Download JSON, csv)
- Import csv based on Data Export CSV.

Orice altceva ce consideri util.

- Next step va fi implementarea consumului cu grafice si statistici.

Implementare:

- docker app with docker compose:
- latest technology for a better look with icons.
