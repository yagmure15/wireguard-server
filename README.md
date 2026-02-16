
# 🛡️ WireGuard VPN Server & Supabase Automation

Bu depo (repository), **WireGuard** tabanlı, kendi kendini yöneten akıllı bir VPN sunucu altyapısını barındırır.

Standart bir VPN kurulumundan farklı olarak; kullanıcı oluşturma, silme, kota takibi (Download/Upload) ve sunucu sağlık durumu gibi işlemler **Supabase** veritabanı ile tam senkronize çalışır. Mobil uygulama ile sunucu arasındaki köprüyü kurar.

---

## 🌟 Özellikler

- **Dockerize Altyapı:** `wg-easy` imajı kullanılarak tek komutla ayağa kalkan, Web arayüzlü VPN sunucusu.
- **Otomatik Veri Takibi (`sync.js`):** Kullanıcıların anlık veri kullanımını (MB/GB) WireGuard API'sinden okur ve Supabase veritabanına işler.
- **Hayalet Kullanıcı Temizliği (`cleanup.js`):** Veritabanından silinen, süresi biten veya kaydı olmayan kullanıcıları sunucudan otomatik olarak atar (Garbage Collection).
- **Sunucu Sağlık Durumu (`bridge.py`):** Sunucunun doluluk oranını (% Load) ve aktif bağlantı sayısını canlı olarak raporlar.
- **Tam Güvenlik:** Tüm hassas veriler `.env` dosyasında saklanır ve asla GitHub reposuna dahil edilmez.

---

## 📂 Proje Yapısı

```
wireguard-server/
├── docker-compose.yml
├── package.json
├── sync.js
├── cleanup.js
├── bridge.py
├── .env
└── .gitignore
```

---

## 🚀 Kurulum

### 1. Docker Kurulumu

```bash
curl -sSL https://get.docker.com | sh
```

### 2. Node.js ve Python Kurulumu

```bash
sudo apt update
sudo apt install -y nodejs npm python3-venv
```

### 3. Projeyi İndirin

```bash
git clone https://github.com/yagmure15/wireguard-server.git
cd wireguard-server
```

### 4. Bağımlılıkları Kurun

```bash
npm install
```

### 5. Python Sanal Ortamı

```bash
python3 -m venv venv
./venv/bin/pip install python-dotenv supabase
```

---

## ⚠️ .env Dosyasını Oluşturun

```bash
nano .env
```

```
WG_PASSWORD=Guclu_Bir_Sifre_Belirle
WG_HOST=SUNUCU_IP_ADRESINI_YAZ
WG_API=http://127.0.0.1:51821

SUPABASE_URL=https://senin-projen.supabase.co
SUPABASE_KEY=eyJh...
SERVER_ID=sunucu-uuid-buraya-gelecek
```

---

## ▶️ VPN Sunucusunu Başlatın

```bash
docker compose up -d
```

VPN: **UDP 51820**  
Panel: **TCP 51821**

---

## 🤖 Otomasyon (Cronjobs)

```bash
crontab -e
```

```
* * * * * /usr/bin/node /home/ubuntu/wireguard-server/sync.js >> sync.log 2>&1
* * * * * /home/ubuntu/wireguard-server/venv/bin/python bridge.py >> bridge.log 2>&1
5 * * * * /usr/bin/node /home/ubuntu/wireguard-server/cleanup.js >> cleanup.log 2>&1
```

---

## 🛠️ Script Görevleri

### 🔄 sync.js
WireGuard API'den veri çeker ve `vpn_clients` tablosuna yazar.

### 🧹 cleanup.js
Veritabanında olmayan kullanıcıları sunucudan siler.

### 🌉 bridge.py
Sunucu doluluk oranını hesaplar ve `vpn_servers` tablosunu günceller.

---

## 📝 Troubleshooting

```bash
tail -f sync.log
tail -f bridge.log
docker logs -f wg-easy
node sync.js
./venv/bin/python bridge.py
```

---

## 🔒 Güvenlik

- `wg0.conf` dosyasını paylaşmayın.
- `.env` dosyasını Git'e eklemeyin.
- Supabase Service Role Key yalnızca sunucuda kalmalıdır.
