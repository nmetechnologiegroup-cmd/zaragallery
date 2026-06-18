# GUIDE DE DÉPLOIEMENT DE PRODUCTION — SERVEUR DEBIAN
### Rédigé par un Ingénieur Systèmes & Réseaux

Ce guide complet détaille les instructions étape par étape pour déployer l'application de point de vente et gestion de stock **ZARA GALLERY** sur un serveur Debian (Debian 11 / Bullseye ou Debian 12 / Bookworm).

---

## 📋 Table des Matières
1. [Spécifications Techniques Requises](#1-spécifications-techniques-requises)
2. [Étape 1 : Initialisation & Sécurisation de Debian](#étape-1--initialisation--sécurisation-de-debian)
3. [Étape 2 : Installation de Node.js LTS et Utilitaires](#étape-2--installation-de-nodejs-lts-et-utilitaires)
4. [Étape 3 : Déploiement du Code Source sur le Serveur](#étape-3--déploiement-du-code-source-sur-le-serveur)
5. [Étape 4 : Gestion de Processus avec PM2 (Production Daemon)](#étape-4--gestion-de-processus-avec-pm2-production-daemon)
6. [Étape 5 : Configuration Reverse Proxy Nginx](#étape-5--configuration-reverse-proxy-nginx)
7. [Étape 6 : Sécurisation SSL / HTTPS avec Let's Encrypt Certbot](#étape-6--sécurisation-ssl--https-avec-lets-encrypt-certbot)
8. [Étape 7 : Scripting Automisé de Sauvegardes](#étape-7--scripting-automatisé-de-sauvegardes-cron)

---

## 1. Spécifications Techniques Requises

*   **Instance Serveur** : VPS ou Serveur Dédié Debian installé (1 vCPU, 1 Go RAM minimum, 2 Go recommandés pour les builds esbuild/vite).
*   **Accès** : Privilèges `root` ou accès via l'utilitaire `sudo`.
*   **Domaine** : Un nom de domaine configuré (ex: `caisse.zara-gallery.com` ou adresse IP avec enregistrement DNS de type A pointant vers le serveur Debian).

---

## Étape 1 : Initialisation & Sécurisation de Debian

Connectez-vous à votre serveur par SSH :
```bash
ssh root@IP_DE_VOTRE_SERVEUR
```

Mettez à jour le système de paquets et installez les dépendances système initiales :
```bash
apt update && apt upgrade -y
apt install -y curl git ufw build-essential
```

Saisissez les règles initiales de pare-feu UFW pour protéger l'OS et ouvrir le port de secours 8085 de Nginx :
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 8085/tcp
ufw --force enable
```

---

## Étape 2 : Installation de Node.js LTS et Utilitaires

Nous installons la version **Node.js 20.x LTS** via le dépôt officiel NodeSource :

```bash
# Installation du dépôt NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Installation effective de Node.js
apt install -y nodejs

# Vérification des versions installées
node -v
npm -v
```

Installez globalement **PM2** (Process Manager 2) qui s'assurera que l'application tourne en permanence en arrière-plan et redémarre automatiquement en cas de crash :
```bash
npm install --global pm2
```

---

## Étape 3 : Déploiement du Code Source sur le Serveur

Créez le répertoire de destination dans `/var/www/` :
```bash
mkdir -p /var/www/zara-gallery
cd /var/www/zara-gallery
```

Transférez vos fichiers via Git, ou copiez vos fichiers locaux vers le serveur en utilisant `rsync`/`sftp` :
```bash
# Si vous utilisez Git
git clone <votre_repo> .

# Ou si vous copiez à la main, assurez-vous que les fichiers soient présents.
```

Installez les dépendances du projet :
```bash
npm install
```

### Configuration des variables d'environnement
Créez le fichier de configuration de production `.env` :
```bash
nano .env
```
Ajoutez les variables requises (ajustez selon vos secrets) :
```env
PORT=3005
NODE_ENV=production
# Si une clé API Gemini est utilisée en arrière-plan
GEMINI_API_KEY=votre_cle_api_securisee
```

Configurez les scripts et lancez la compilation complète de l'application :
```bash
npm run build
```
Cette étape produit le bundle Web statique optimisé dans le dossier `/dist`.

---

## Étape 4 : Gestion de Processus avec PM2 (Production Daemon)

Démarrez votre serveur Node en utilisant PM2 sous l'égide de variables optimisées de production :

```bash
# Lancer l'application avec PM2
pm2 start dist/server.cjs --name "zara-gallery-pos"

# Configurer Service Systemd pour persister après un reboot de Debian
pm2 startup systemd
```
*Note : PM2 affichera une commande `sudo env PATH=...` à exécuter. Copiez et collez cette commande affichée dans votre terminal Debian pour finaliser la persistance systémique.*

Enregistrez l'état actuel de PM2 :
```bash
pm2 save
```

Pour visualiser l'état de l'application :
```bash
pm2 status
pm2 logs "zara-gallery-pos"
```

---

## Étape 5 : Configuration Reverse Proxy Nginx

Si le port standard **80** est déjà occupé sur votre serveur Debian par un autre service (ex: Apache ou un autre site), nous configurons Nginx pour écouter sur le port **8085**. Tout le trafic sera retransmis de manière transparente vers l'application s'exécutant sur le port interne `3005` (ou `3006` en cas d'occupation).

> ⚠️ **ATTENTION : N'utilisez PAS le port 6000 !**
> Tous les navigateurs web modernes (Firefox, Chrome, Safari, Edge) bloquent le port `6000` par mesure de sécurité (car il est réservé au protocole X11). Tenter d'accéder à `http://votre-ip:6000` déclenchera systématiquement l'erreur *"Cette adresse est interdite"* (Firefox) ou `ERR_UNSAFE_PORT` (Chrome). Le port **8085** est totalement sécurisé, autorisé par les navigateurs et libre d'utilisation.

Installez Nginx :
```bash
apt install -y nginx
```

Désactivez la configuration par défaut :
```bash
rm /etc/nginx/sites-enabled/default
```

Créez un nouveau fichier de configuration Nginx dédié :
```bash
nano /etc/nginx/sites-available/zara-gallery
```

Collez la configuration d'ingénierie optimisée suivante :

```nginx
# Pool de serveurs backend avec basculement automatique
upstream zara_backend {
    server 127.0.0.1:3005 max_fails=1 fail_timeout=10s;
    server 127.0.0.1:3006 backup; # Port de repli automatique si 3005 est déjà occupé
}

server {
    listen 8085;
    server_name _; # Écoute sur toutes les requêtes arrivant sur le port 8085

    # Gzip Compression active pour accélérer le chargement sur mobile (Ouagadougou / Réseaux lents)
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # Correction de l'erreur "400 Bad Request - Request Header Or Cookie Too Large"
    client_header_buffer_size 16k;
    large_client_header_buffers 4 32k;

    # Serveur proxy vers le backend Express / Node s'exécutant sur le port 3005
    # (Ou port 3006 si le port 3005 de votre serveur Debian était déjà occupé)
    location / {
        proxy_pass http://zara_backend;
        
        # En cas d'erreur de connexion ou de Bad Gateway sur le port 3005, Nginx essaie gracieusement le port de repli 3006
        proxy_next_upstream error timeout invalid_header http_502 http_503 http_504;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Configuration du cache pour les images et assets lourds
    location ~* \.(?:ico|css|js|gif|jpe?g|png|woff2?|eot|otf|ttf|svg)$ {
        proxy_pass http://zara_backend;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    error_log  /var/log/nginx/zara-gallery-error.log error;
    access_log /var/log/nginx/zara-gallery-access.log;
}
```

Activez la configuration et redémarrez Nginx :
```bash
ln -s /etc/nginx/sites-available/zara-gallery /etc/nginx/sites-enabled/
nginx -t # Test syntaxique - Doit être OK
systemctl restart nginx
```

---

## Étape 6 : Sécurisation SSL / HTTPS avec Let's Encrypt Certbot

Pour crypter les codes PIN, les informations financières, et l'accès administrateur, HTTPS est obligatoire en production.

Installez Certbot pour Nginx :
```bash
apt install -y certbot python3-certbot-nginx
```

Lancez la génération de certificats SSL (Certbot détectera automatiquement la configuration de votre serveur Nginx et modifiera les règles pour rediriger automatiquement tout le trafic HTTP vers HTTPS de manière sécurisée) :

```bash
certbot --nginx -d caisse.zara-gallery.com
```

Répondez aux invites interactives (votre e-mail, acceptation des conditions d'utilisation). Certbot configurera automatiquement le renouvellement planifié (cron quotidien).

Testez le renouvellement automatique :
```bash
certbot renew --dry-run
```

---

## Étape 7 : Scripting Automatisé de Sauvegardes (Cron)

En tant qu'ingénieur informatique, la sécurité et la traçabilité des données sont capitales. Nous allons automatiser l'export régulier de la base de données.

Créez un script de sauvegarde automatique dans `/usr/local/bin/backup-pos.sh` :
```bash
nano /usr/local/bin/backup-pos.sh
```

Injectez le code d'archivage automatique suivant :
```bash
#!/bin/bash
# Script de sauvegarde automatique de la Base de Données

BACKUP_DIR="/var/backups/zara-gallery"
DATE=$(date +'%Y-%m-%d_%Hh%M')
mkdir -p "$BACKUP_DIR"

# Si l'application dispose d'une API locale d'extraction, sauvegardez le fichier JSON généré
# Sinon, sauvegardez les fichiers de base du dossier .env ou dossiers persistants locaux
curl -s http://127.0.0.1:3005/api/backup > "$BACKUP_DIR/backup_$DATE.json"

# Conserver uniquement les 15 dernières sauvegardes pour préserver l'espace disque
find "$BACKUP_DIR" -type f -name "backup_*.json" -mtime +15 -delete

echo "[$(date)] Sauvegarde ZARA GALLERY effectuée avec succès." >> /var/log/pos-backups.log
```

Rendez le script exécutable :
```bash
chmod +x /usr/local/bin/backup-pos.sh
```

Ajoutez une règle `cron` pour déclencher la sauvegarde automatiquement tous les soirs à 21h00 :
```bash
(crontab -l 2b/dev/null; echo "0 21 * * * /usr/local/bin/backup-pos.sh >/dev/null 2>&1") | crontab -
```

---

### 🎉 FÉLICITATIONS ! Votre application d'encaissement et de gestion de stock Zara Gallery est maintenant déployée, démonisée par PM2, proxifiée sous Nginx avec chiffrement SSL (HTTPS) d'entreprise et sauvegardée chaque jour sur votre serveur Debian actif !
