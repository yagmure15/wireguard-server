import os
import subprocess
import time
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# .env dosyasını yükle
load_dotenv()

# --- AYARLAR ---
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
SERVER_ID = os.getenv('SERVER_ID')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("HATA: .env dosyasında SUPABASE bilgileri eksik!")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_wg_stats():
    try:
        # --- DÜZELTME BURADA ---
        # "wg" yerine "docker exec wg-easy wg" komutunu kullanıyoruz.
        # Eğer docker konteyner ismin 'wg-easy' değilse burayı güncellemelisin.
        output = subprocess.check_output([
            "docker", "exec", "wg-easy", "wg", "show", "all", "dump"
        ]).decode("utf-8")
        
        stats = []
        for line in output.strip().split("\n"):
            parts = line.split("\t")
            if len(parts) >= 8:
                stats.append({
                    "public_key": parts[1],
                    "rx_bytes": int(parts[6]),
                    "tx_bytes": int(parts[7]),
                    "handshake": int(parts[5])
                })
        return stats
    except Exception as e:
        # Hata olursa ekrana bas ama programı kırma
        print(f"Docker Hatasi: {e}", file=sys.stderr)
        return []

def sync():
    stats = get_wg_stats()
    active_count = 0
    now = int(time.time())

    for peer in stats:
        # 3 dakika (180 sn) içinde handshake varsa aktif say
        if (now - peer['handshake']) < 180:
            active_count += 1

    try:
        # Sunucu Yükünü Hesapla (% olarak)
        load = min(100, int((active_count / 100) * 100))
        
        supabase.table("vpn_servers").update({
            "active_connections": active_count,
            "load_percentage": load,
            "last_heartbeat": "now()"
        }).eq("id", SERVER_ID).execute()
        
        # Test çıktısı (İstersen silebilirsin)
        print(f"Sunucu Guncellendi -> Aktif: {active_count} | Yuk: %{load}")
        
    except Exception as e:
        print(f"Supabase Update Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    print("Bridge Servisi Baslatildi (Docker Modu)...")
    # İlk açılışta bir kez çalıştır, sonra döngüye gir
    sync()
    while True:
        time.sleep(60)
        try:
            sync()
        except Exception as e:
            print(f"Genel Dongu Hatasi: {e}", file=sys.stderr)
