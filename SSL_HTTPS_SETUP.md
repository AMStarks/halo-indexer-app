# SSL/HTTPS SETUP - HALO INDEXER

## 🔒 **HTTPS Overview**

### **Why HTTPS is Critical**
- **Security**: Encrypts all data between client and server
- **Trust**: Users see the padlock icon in browsers
- **SEO**: Google favors HTTPS sites
- **Compliance**: Required for modern web applications
- **Performance**: HTTP/2 and HTTP/3 support

### **SSL Certificate Types**
1. **Let's Encrypt** (Free, automated)
2. **Self-Signed** (Development only)
3. **Commercial Certificates** (Paid, extended validation)

## 🚀 **Let's Encrypt Setup (Recommended)**

### **1. Prerequisites**
```bash
# Domain must be configured
# DNS must point to your server
# Port 80 and 443 must be open
# Certbot must be installed
```

### **2. Install Certbot**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# CentOS/RHEL
sudo yum install certbot

# macOS
brew install certbot
```

### **3. Obtain SSL Certificate**
```bash
# For single domain
sudo certbot certonly --standalone -d halo.runonflux.io

# For multiple domains
sudo certbot certonly --standalone \
  -d halo.runonflux.io \
  -d www.halo.runonflux.io \
  -d api.halo.runonflux.io
```

### **4. Certificate Files Location**
```bash
# Certificate files are stored in:
/etc/letsencrypt/live/halo.runonflux.io/
├── cert.pem          # Certificate
├── chain.pem         # Certificate chain
├── fullchain.pem     # Full certificate chain
└── privkey.pem       # Private key
```

## 🔧 **Nginx Configuration**

### **1. Nginx SSL Configuration**
```nginx
# /etc/nginx/sites-available/halo-indexer
server {
    listen 80;
    server_name halo.runonflux.io;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name halo.runonflux.io;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/halo.runonflux.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/halo.runonflux.io/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Proxy to Halo Indexer
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/api/health;
        access_log off;
    }
    
    # Metrics endpoint (internal only)
    location /metrics {
        allow 127.0.0.1;
        deny all;
        proxy_pass http://localhost:3000/api/metrics;
    }
}
```

### **2. Enable Site**
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/halo-indexer /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## 🔄 **Auto-Renewal Setup**

### **1. Test Auto-Renewal**
```bash
# Test the renewal process
sudo certbot renew --dry-run
```

### **2. Set Up Cron Job**
```bash
# Add to crontab
sudo crontab -e

# Add this line for daily renewal check
0 12 * * * /usr/bin/certbot renew --quiet
```

### **3. Renewal Hook Script**
```bash
#!/bin/bash
# /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh

# Reload nginx after certificate renewal
systemctl reload nginx
```

## 🐳 **Docker SSL Configuration**

### **1. Docker Compose with SSL**
```yaml
# docker-compose-ssl.yml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    depends_on:
      - halo-indexer
    restart: unless-stopped

  halo-indexer:
    build: .
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - CASSANDRA_CONTACT_POINTS=cassandra
    depends_on:
      - redis
      - cassandra
    restart: unless-stopped

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email admin@halo.runonflux.io --agree-tos --no-eff-email -d halo.runonflux.io
```

### **2. Nginx Configuration for Docker**
```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream halo_indexer {
        server halo-indexer:3000;
    }

    server {
        listen 80;
        server_name halo.runonflux.io;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            return 301 https://$host$request_uri;
        }
    }

    server {
        listen 443 ssl http2;
        server_name halo.runonflux.io;
        
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;
        
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        
        location / {
            proxy_pass http://halo_indexer;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## ☸️ **Kubernetes SSL Configuration**

### **1. SSL Certificate Secret**
```yaml
# ssl-secret.yml
apiVersion: v1
kind: Secret
metadata:
  name: halo-ssl-cert
  namespace: halo-indexer
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-certificate>
  tls.key: <base64-encoded-private-key>
```

### **2. Ingress with SSL**
```yaml
# ingress-ssl.yml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: halo-ingress
  namespace: halo-indexer
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - halo.runonflux.io
    secretName: halo-ssl-cert
  rules:
  - host: halo.runonflux.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: halo-indexer-service
            port:
              number: 3000
```

### **3. Cert-Manager Setup**
```yaml
# cert-manager.yml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@halo.runonflux.io
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

## 🔧 **Halo Indexer HTTPS Configuration**

### **1. Update Environment Variables**
```bash
# .env
NODE_ENV=production
PORT=3000
SSL_ENABLED=true
SSL_CERT_PATH=/etc/ssl/certs/halo-indexer.crt
SSL_KEY_PATH=/etc/ssl/private/halo-indexer.key
TRUST_PROXY=true
```

### **2. HTTPS Server Configuration**
```javascript
// src/index.js (HTTPS version)
const https = require('https');
const fs = require('fs');

// SSL configuration
const sslOptions = {
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/ssl/certs/halo-indexer.crt'),
  key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/ssl/private/halo-indexer.key'),
  ca: fs.readFileSync('/etc/ssl/certs/ca-bundle.crt')
};

// Create HTTPS server
const server = https.createServer(sslOptions, app);

server.listen(process.env.PORT || 3000, () => {
  logger.info(`Halo Indexer HTTPS server running on port ${process.env.PORT || 3000}`);
});
```

### **3. Security Headers Middleware**
```javascript
// src/middleware/security.js
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://telestai.cryptoscope.io"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## 🚨 **Security Best Practices**

### **1. SSL Configuration**
```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

### **2. Security Headers**
```nginx
# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### **3. Rate Limiting**
```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;
```

## 🔍 **SSL Testing**

### **1. SSL Labs Test**
```bash
# Test SSL configuration
curl -I https://halo.runonflux.io
```

### **2. Certificate Information**
```bash
# View certificate details
openssl s_client -connect halo.runonflux.io:443 -servername halo.runonflux.io
```

### **3. Security Headers Test**
```bash
# Test security headers
curl -I https://halo.runonflux.io
```

## 🎯 **Benefits of HTTPS Setup**

### **1. Security**
- **Data Encryption**: All traffic is encrypted
- **Authentication**: Verifies server identity
- **Integrity**: Prevents data tampering

### **2. Performance**
- **HTTP/2 Support**: Faster page loads
- **HTTP/3 Support**: Latest protocol features
- **Compression**: Better bandwidth usage

### **3. Trust**
- **Browser Trust**: Green padlock icon
- **User Confidence**: Professional appearance
- **SEO Benefits**: Google ranking boost

### **4. Compliance**
- **GDPR**: Required for data protection
- **PCI DSS**: Required for payment processing
- **Industry Standards**: Best practice compliance

This SSL/HTTPS setup provides **complete security** for the Halo Indexer with automatic certificate renewal! 🔒 