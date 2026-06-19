# GUIDE DE DÉPLOIEMENT DE PRODUCTION AVEC DOCKER & SQLITE — SERVEUR DEBIAN
### Rédigé pour ZARA GALLERY

Ce guide complet détaille les instructions étape par étape pour déployer l'application de point de vente et gestion de boutique **ZARA GALLERY** sur un serveur Debian (Debian 11 / Debian 12 ou tout autre serveur Linux) en utilisant **Docker Compose** et la base de données robuste **SQLite**.

---

## 📋 Table des Matières
1. [Pourquoi SQLite & Comment sont protégées vos données ?](#-pourquoi-sqlite--comment-sont-protégées-vos-données-)
2. [Étape 1 : Préparation & Sécurisation de l'OS Debian](#étape-1--préparation--sécurisation-de-los-debian)
3. [Étape 2 : Installation du moteur Docker d'entreprise](#étape-2--installation-du-moteur-docker-dentreprise)
4. [Étape 3 : Déploiement & Configuration du Code Source](#étape-3--déploiement--configuration-du-code-source)
5. [Étape 4 : Lancement de l'Application via Docker Compose](#étape-4--lancement-de-lapplication-via-docker-compose)
6. [Étape 5 : Où se trouve mon fichier de base de données SQLite sur le serveur ?](#étape-5--où-se-trouve-mon-fichier-de-base-de-données-sqlite-sur-le-serveur-)
7. [Étape 6 : Comment mettre à jour l'application sans perdre mes données ?](#étape-6--comment-mettre-à-jour-lapplication-sans-perdre-mes-données-)
8. [Étape 7 : Configuration Reverse Proxy Nginx & HTTPS (SSL Certbot)](#étape-7--configuration-reverse-proxy-nginx--https-ssl-certbot)
9. [Étape 8 : Sauvegardes Automatiques Automatisées (Cron)](#étape-8--sauvegardes-automatiques-automatisées-cron)

---

## 🛠 Pourquoi SQLite & Comment sont protégées vos données ?

Contrairement à Firebase ou MySQL qui requièrent des connexions internet ou des serveurs distants lourds, l'application utilise désormais **SQLite (avec le mode journalisé ultra-rapide WAL)**. 

### Sécurité absolue contre les pertes d'updates :
1. **Dossier Persistant (`/app_data` vers `./data`)** : La base de données n'est **PAS** stockée à l'intérieur du conteneur Docker éphémère. Elle est montée sur le disque dur de votre serveur Debian dans le dossier `./data/zara_database.sqlite`.
2. **Aucune perte lors d'un Update** : Lorsque vous mettez à jour votre code ou recompilez votre conteneur Docker, Docker préserve intact le dossier `./data`. Vos ventes, stocks et utilisateurs restent conservés à 100%.
3. **Double Redondance de Sauvegarde** : En plus de la base SQLite active, l'application maintient continuellement une sauvegarde au format JSON dans `zara_database.json` pour une sécurité optimale.

---

## Étape 1 : Préparation & Sécurisation de l'OS Debian

Connectez-vous à votre serveur Linux Debian en SSH :
```bash
ssh root@IP_DE_VOTRE_SERVEUR
```

Mettez à jour le système d'exploitation :
```bash
apt update && apt upgrade -y
apt install -y curl git ufw build-essential htop
```

Configurez le Pare-feu UFW pour autoriser uniquement SSH (22), HTTP (80), HTTPS (443) et le port de l'application (8000) :
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp
ufw --force enable
```

---

## Étape 2 : Installation du moteur Docker d'entreprise

Pour simplifier le déploiement et isoler l'application, nous installons Docker et Docker Compose :

```bash
# Désinstaller les vieux paquets non officiels s'ils existent
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do apt-get remove $pkg; done

# Installer les dépendances de clé HTTPS de Docker
apt install -y ca-certificates gnupg

# Ajouter la clé GPG officielle de Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Ajouter le dépôt apt stable
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installer Docker Engine et Docker Compose
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Vérifier que docker fonctionne
docker --version
docker compose version
```

---

## Étape 3 : Déploiement & Configuration du Code Source

Rendez-vous dans le dossier de votre application sur le serveur :
```bash
cd /var/www/zara-gallery/zaragallery
```

Assurez-vous que les fichiers indispensables sont présents (ils le sont déjà sur votre serveur d'après votre commande `ls`) :
*   `Dockerfile` (qui sert à empaqueter l'application Node + React)
*   `docker-compose.yml` (qui définit le démarrage de l'application)
*   `server.ts` (notre serveur d'API connecté à SQLite)

### Configuration des variables d'environnement
Créez le fichier de configuration de production `.env` pour stocker les secrets :
```bash
nano .env
```
Ajoutez les définitions suivantes :
```env
PORT=3000
NODE_ENV=production
# Si vous possédez une clé API Gemini pour l'assistance intelligente :
GEMINI_API_KEY=votre_cle_api_securisee
```

---

## Étape 4 : Lancement de l'Application via Docker Compose

À partir du répertoire `/var/www/zara-gallery/zaragallery`, lancez la construction et le démarrage du serveur en tâche de fond (daemonized mode) :

```bash
docker compose up -d --build
```

### Vérifier le statut de l'application :
Vérifiez que le conteneur tourne correctement :
```bash
docker compose ps
```
Vous devriez voir `zara_app` avec le statut `running` ou `up` redirigeant le trafic du port externe `8000` vers le port interne `3000`.

Lisez les logs de l'application en direct pour vous assurer que SQLite est correctement connecté :
```bash
docker compose logs -f
```
Vous devriez voir la ligne :
`✅ Connected to SQLite database successfully!`

---

## Étape 5 : Où se trouve mon fichier de base de données SQLite sur le serveur ?

### 💻 Sur la machine hôte (votre serveur Debian principal) :
Parce que nous avons configuré un volume persistant de sécurité dans le fichier `docker-compose.yml`, Docker crée automatiquement un dossier nommé `data` dans votre dossier courant.

Tapez les commandes de vérification suivantes depuis `/var/www/zara-gallery/zaragallery` :
```bash
# Lister le répertoire complet pour voir le dossier data créé par Docker
ls -la

# Lister le dossier data pour localiser votre base SQLite
ls -la data/
```
**Vous verrez les fichiers suivants apparaître instantanément :**
*   `data/zara_database.sqlite` (Votre base de données active principale !)
*   `data/zara_database.sqlite-wal` (Fichier temporaire d'écriture rapide de SQLite)
*   `data/zara_database.sqlite-shm` (Fichier de mémoire partagée pour la concurrence)

Ces fichiers contiennent l'intégralité de vos ventes, clients, produits et stocks en local !

### 📥 Comment télécharger ou faire un Backup de la Base SQLite ?
Trois solutions s'offrent à vous :

1. **Via l'URL d'Administration (Téléchargement direct en un clic depuis votre navigateur)** :
   Naviguez simplement sur votre navigateur vers :
   *   `http://VOTRE_IP:8000/api/db/download` -> Télécharge le fichier brut **.sqlite** compatible avec n'importe quel visualiseur DB comme *DBeaver* ou *DB Browser for SQLite*.
   *   `http://VOTRE_IP:8000/api/db/dump` -> Génère et télécharge un **SQL Dump complet au format .sql** lisible avec toutes les tables et données prêtes à être injectées ou migrées si besoin !

2. **Copier le fichier directement en SSH localement** :
   Pour rapatrier la base de données sur votre ordinateur :
   ```bash
   scp root@IP_DE_VOTRE_SERVEUR:/var/www/zara-gallery/zaragallery/data/zara_database.sqlite ~/Downloads/
   ```

3. **Inspecter la base directement en SSH** :
   Installez le client SQLite sur votre serveur Debian et connectez-vous :
   ```bash
   apt install -y sqlite3
   sqlite3 data/zara_database.sqlite
   ```
   *Une fois dans l'interpreteur sqlite3, vous pouvez exécuter des SQL (ex: `.tables` pour voir les tables ou `SELECT * FROM app_state;` puis `.exit` pour quitter).*

---

## Étape 6 : Comment mettre à jour l'application sans perdre mes données ?

C'est l'un des avantages cruciaux de SQLite combiné à Docker Compose. Lorsque vous mettez à jour votre code (par exemple, si vous récupérez la dernière version de notre travail ou effectuez des modifications), suivez cette procédure simple de mise à jour sécurisée :

```bash
# 1. Arrêter provisoirement le conteneur applicatif
docker compose down

# 2. Récupérer le nouveau code (via Git ou transfert de fichiers)
git pull

# 3. Recompiler le conteneur et le relancer en arrière-plan
docker compose up -d --build
```
**Résultat** : Votre application est mise à jour avec le nouveau code, tandis que vos données SQLite situées dans `./data/zara_database.sqlite` restent intouchées et instantanément rechargées !

---

## Étape 7 : Configuration Reverse Proxy Nginx & HTTPS (SSL Certbot)

Pour accéder à votre magasin de manière sécurisée et rapide sur le port standard **80** (HTTP) ou **443** (HTTPS) au lieu du port `8000`, configurez Nginx :

Installez Nginx sur le serveur Debian de l'hôte :
```bash
apt install -y nginx
```

Désactivez la page d'accueil d'origine :
```bash
rm /etc/nginx/sites-enabled/default
```

Créez un hôte virtuel dédié pour Zara Gallery :
```bash
nano /etc/nginx/sites-available/zara-gallery
```

Collez la configuration proxy optimisée pour transférer le trafic du port 80 vers le conteneur Docker (port 8000) :
```nginx
server {
    listen 80;
    server_name caisse.zara-gallery.com; # Remplacez par votre vrai nom de domaine ou l'adresse IP de votre serveur

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Autoriser l'envoi de photos de produits lourdes
    client_max_body_size 50M;
}
```

Activez l'hôte virtuel et redémarrez Nginx :
```bash
ln -s /etc/nginx/sites-available/zara-gallery /etc/nginx/sites-enabled/
nginx -t     # Doit retourner syntax is ok
systemctl restart nginx
```

### Installation du certificat HTTPS auto-renouvelable Let's Encrypt :
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d caisse.zara-gallery.com
```

---

## Étape 8 : Sauvegardes Automatiques Automatisées (Cron)

Pour faire des sauvegardes régulières tous les jours de votre base SQLite :

Créez le script de sauvegarde :
```bash
nano /usr/local/bin/backup-sqlite.sh
```

Ajoutez ce code de sauvegarde (qui copie le fichier de base de données à chaud vers un sous-dossier sécurisé avec horodatage) :
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/zara-gallery-sqlite"
DATE=$(date +'%Y-%m-%d_%Hh%M')
mkdir -p "$BACKUP_DIR"

# Sauvegarder la base de données SQLITE active
cp /var/www/zara-gallery/zaragallery/data/zara_database.sqlite "$BACKUP_DIR/zara_backup_$DATE.sqlite"

# Optionnel : Faire aussi un dump SQL texte au même moment
curl -s http://127.0.0.1:8000/api/db/dump > "$BACKUP_DIR/zara_dump_$DATE.sql"

# Conserver uniquement les 30 dernières sauvegardes pour ne pas saturer l'espace disque
find "$BACKUP_DIR" -type f -mtime +30 -delete

echo "[$(date)] Sauvegarde auto SQLite effectuée avec succès." >> /var/log/zara-backups.log
```

Rendez le script de sauvegarde exécutable :
```bash
chmod +x /usr/local/bin/backup-sqlite.sh
```

Automatisez le script avec Cron pour qu'il s'exécute automatiquement tous les soirs à 21h00 :
```bash
(crontab -l 2>/dev/null; echo "0 21 * * * /usr/local/bin/backup-sqlite.sh >/dev/null 2>&1") | crontab -
```

---

### 🎉 Succès ! Votre application ZARA GALLERY utilise à présent l'architecture ultra-stable SQLite. Vos données sont persistées sur le disque de l'hôte, modifiables et consultables directement en local.
