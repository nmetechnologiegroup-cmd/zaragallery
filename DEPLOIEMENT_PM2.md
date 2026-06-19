# GUIDE DE DÉPLOIEMENT NATIF AVEC PM2 & SQLITE — SERVEUR DEBIAN
### Rédigé pour ZARA GALLERY (Sans Docker)

Ce guide décrit de manière exhaustive comment déployer votre application Zara Gallery directement sur l'hôte Debian en utilisant **PM2** (Process Manager) et **SQLite**. 

---

## 📋 Avantages de PM2 + SQLite
* **Léger** : Pas de couche de virtualisation Docker, consommation minimale de RAM et de CPU.
* **Haute visibilité** : Le fichier `zara_database.sqlite` est directement visible dans le dossier racine du projet lorsque vous tapez `ls`.
* **Persistance à 100%** : Les fichiers de base de données sont situés à la racine du projet, en dehors du dossier de build `dist/`. Vos mises à jour et recompilations de l'application n'écrasent **jamais** vos données.

---

## 🛠 Étape 1 : Préparation du Système Debian

Connectez-vous à votre machine Debian en SSH :
```bash
ssh root@IP_DE_VOTRE_SERVEUR
```

Mettez à jour les dépôts de paquets :
```bash
apt update && apt upgrade -y
```

Installez les outils de compilation essentiels (requis pour compiler les modules d'écriture rapide de SQLite `better-sqlite3`) et autres dépendances système :
```bash
apt install -y curl git build-essential htop ufw
```

Configurez les accès réseau via le pare-feu :
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp # Port par défaut de l'application Node
ufw --force enable
```

---

## 📦 Étape 2 : Installation de Node.js, NPM et PM2

Installez la version LTS recommandée de Node.js (v20) sur votre système :

```bash
# Ajouter le dépôt de clés NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Installer Node.js et NPM d'entreprise
apt install -y nodejs

# Vérifier les versions installées
node -v
npm -v
```

Installez ensuite **PM2** de manière globale pour gérer l'exécution permanente de votre serveur node en arrière-plan :
```bash
npm install -g pm2
```

---

## 🚀 Étape 3 : Installation des Dépendances et Build du Projet

Rendez-vous dans le dossier de votre projet sur le serveur :
```bash
cd /var/www/zara-gallery/zaragallery
```

Installez l'ensemble des dépendances Node.js (ce processus va automatiquement compiler les liaisons binaires SQLite ultra rapides pour l'architecture matérielle de votre serveur) :
```bash
npm install
```

Compilez l'application cliente (Vite) et le bundle serveur (esbuild) d'une seule traite :
```bash
npm run build
```
*(Le code compilé est placé dans le dossier `dist/` sous la forme d'un fichier compressé d'exécution unique `dist/server.cjs`).*

---

## ⚙ Étape 4 : Fichier de Variable d'Environnement (.env)

Créez un fichier `.env` à la racine pour indiquer que l'application tourne en production :
```bash
nano .env
```

Collez-y les lignes suivantes :
```env
PORT=3000
NODE_ENV=production
# Si vous configurez l'IA Gemini d'assistance :
GEMINI_API_KEY=votre_cle_api_securisee
```
*Enregistrez avec `Ctrl+O` puis quittez avec `Ctrl+X`.*

---

## 📈 Étape 5 : Lancement et Autorun de l'Application via PM2

Pour démarrer votre application de manière permanente, lancez la commande suivante depuis `/var/www/zara-gallery/zaragallery` :

```bash
pm2 start dist/server.cjs --name "zara-gallery"
```

### Commandes utiles pour inspecter l'état :
* Pour voir la liste des applications en route :
  ```bash
  pm2 list
  ```
* Pour voir l'utilisation CPU et RAM en temps réel :
  ```bash
  pm2 monit
  ```
* Pour lire l'historique et les logs d'activité ou de connexion SQLite :
  ```bash
  pm2 logs zara-gallery
  ```

### Configuration du démarrage automatique après un redémarrage du serveur :
Pour que Debian redémarre l'application après une coupure d'électricité ou une maintenance matérielle locale :
```bash
# Générer le script système de démarrage automatique de PM2
pm2 startup systemd
```
*Cette commande va afficher une ligne à copier/coller dans votre terminal commençant par `sudo env PATH=...`. Copiez-la et exécutez-la.*

Une fois le daemonisé configuré :
```bash
# Sauvegarder la configuration PM2 active pour les prochains démarrages
pm2 save
```

---

## 💾 Étape 6 : Où se trouve mon fichier de base de données SQLite ?

Il est exactement là où vous l'attendez ! Puisque nous utilisons PM2 en natif, l'application crée et consulte le fichier de base de données directement dans le répertoire de travail principal.

Faites l'expérience directement en SSH :
```bash
cd /var/www/zara-gallery/zaragallery
ls -la
```

**Vous verrez instantanément apparaître les fichiers suivants :**
1. **`zara_database.sqlite`** : Votre base SQLite active.
2. **`zara_database.sqlite-wal`** : Le journal de transactions WAL ultra rapide.
3. **`zara_database.sqlite-shm`** : Le fichier d'index d'accès concurrent.
4. **`zara_database.json`** : Votre fichier de sauvegarde JSON redondant.
5. **`zara_messages.json`** : S'occupe de la messagerie instantanée hors-ligne.

### Comment sauvegarder ou consulter la base de données SQLite :
* **Télécharger le fichier physique (`.sqlite`)** : 
  Depuis votre navigateur, allez sur `http://IP_DE_VOTRE_SERVEUR:3000/api/db/download` (pour le fichier SQLite complet).
* **Télécharger un Dump SQL lisible (`.sql`)** :
  Depuis votre navigateur, allez sur `http://IP_DE_VOTRE_SERVEUR:3000/api/db/dump` pour obtenir les scripts de création des tables et des lignes.
* **Inspecter localement en ligne de commande** :
  ```bash
  apt install -y sqlite3
  sqlite3 zara_database.sqlite
  ```
  *(Une fois à l'intérieur, tapez `.tables` pour voir vos ventes et produits ou `.quit` pour sortir).*

---

## 🔄 Étape 7 : Faire une Mise à l'Échelle ou Mise à Jour (Update) sans Perdre de Données

Puisque les fichiers de bases de données (`*.sqlite`, `*.json`) sont situés à la racine du projet de travail et les scripts compilés dans `/dist`, vous pouvez faire autant d'updates du code que vous le souhaitez, vos données ne bougeront jamais !

Procédure de mise à jour sécurisée :
```bash
cd /var/www/zara-gallery/zaragallery

# 1. Récupérer les nouveaux fichiers de code (Git ou transfert réseau)
git pull

# 2. Installer de nouvelles dépendances s'il y en a
npm install

# 3. Re-compiler l'application de production
npm run build

# 4. Redémarrer le service PM2 pour activer la nouvelle version
pm2 restart zara-gallery
```
**Et voilà ! Vos modifications de style ou fonctionnelles sont appliquées, et SQLite a conservé 100% de vos ventes et stocks actuels.**

---

## 🌐 Étape 8 : Proxy Nginx & HTTPS (Sécurisation SSL Let's Encrypt)

Pour que vos tablettes et smartphones puissent se connecter au POS de manière fluide sur les ports internet standard (80 et 443), installez un serveur Web Nginx en mode inverse Proxy :

```bash
apt install -y nginx
rm /etc/nginx/sites-enabled/default
nano /etc/nginx/sites-available/zara-gallery
```

Collez la configuration de production :
```nginx
server {
    listen 80;
    server_name caisse.zara-gallery.com; # Modifiez avec votre nom de domaine ou l'IP locale de votre serveur

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    location / {
        proxy_pass http://127.0.0.1:3000; # Redirige vers PM2 sur le port 3000
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 50M; # Autorise le téléversement d'images de produits de haute qualité
}
```

Activez l'hôte virtuel et redémarrez Nginx :
```bash
ln -s /etc/nginx/sites-available/zara-gallery /etc/nginx/sites-enabled/
nginx -t     # Vérifier la syntaxe
systemctl restart nginx
```

### Activer le chiffrement SSL (HTTPS) :
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d caisse.zara-gallery.com
```

---

## 🛡 Étape 9 : Sauvegardes Automatiques par Script (Cron)

Créez un script de backup automatique de sécurité chaque nuit pour prévenir d'une panne du matériel local de votre serveur :

```bash
nano /usr/local/bin/backup-zara.sh
```

Ajoutez le script automatique :
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/zara-gallery"
DATE=$(date +'%Y-%m-%d_%Hh%M')
mkdir -p "$BACKUP_DIR"

# Copie sécurisée de la base SQLite
cp /var/www/zara-gallery/zaragallery/zara_database.sqlite "$BACKUP_DIR/zara_db_$DATE.sqlite"

# Copie de la base redondante JSON
cp /var/www/zara-gallery/zaragallery/zara_database.json "$BACKUP_DIR/zara_backup_$DATE.json"

# Optionnel : Conserver également un fichier dump text SQL
curl -s http://127.0.0.1:3000/api/db/dump > "$BACKUP_DIR/zara_dump_$DATE.sql"

# Conserver uniquement les versions des 30 derniers jours pour économiser l'espace disque
find "$BACKUP_DIR" -type f -mtime +30 -delete

echo "[$(date)] Sauvegarde native SQLite effectuée avec succès." >> /var/log/zara-backup-native.log
```

Rendez le script de sauvegarde exécutable :
```bash
chmod +x /usr/local/bin/backup-zara.sh
```

Automatisez-le pour chaque nuit à 21h00 :
```bash
(crontab -l 2>/dev/null; echo "0 21 * * * /usr/local/bin/backup-zara.sh >/dev/null 2>&1") | crontab -
```
