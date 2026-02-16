require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// --- GÜVENLİ AYARLAR (.env'den gelir) ---
const WG_API = process.env.WG_API;
const WG_PASSWORD = process.env.WG_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!WG_PASSWORD || !SUPABASE_KEY) {
    console.error("❌ HATA: .env dosyası okunamadı veya şifreler eksik!");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncData() {
  try {
    // 1. Veritabanı Kontrolü (Debug amaçlı kalabilir)
    const { data: dbClients, error: dbError } = await supabase
      .from('vpn_clients')
      .select('app_user_id, public_key');

    if (dbError) {
        console.error("❌ Veritabanı Okuma Hatası:", dbError.message);
        return;
    }
    
    // 2. WireGuard API'ye Bağlan
    const sessionRes = await fetch(`${WG_API}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: WG_PASSWORD }),
    });

    const cookie = sessionRes.headers.get('set-cookie');
    if (!cookie) throw new Error('WireGuard giriş başarısız!');

    const clientsRes = await fetch(`${WG_API}/api/wireguard/client`, {
      headers: { Cookie: cookie },
    });
    const clients = await clientsRes.json();
    
    // 3. Eşleştirme ve Güncelleme
    for (const client of clients) {
      const cleanPublicKey = (client.publicKey || '').trim();
      
      const totalDownload = client.transferRx || 0;
      const totalUpload = client.transferTx || 0;
      
      let lastActive = null;
      let isActive = false;

      if (client.latestHandshakeAt) {
          lastActive = new Date(client.latestHandshakeAt).toISOString();
          const timeDiff = Date.now() - new Date(client.latestHandshakeAt).getTime();
          if (timeDiff < 180000) isActive = true; // 3 dakika kuralı
      }

      const { data, error } = await supabase
        .from('vpn_clients')
        .update({
          total_download: totalDownload,
          total_upload: totalUpload,
          last_connected_at: lastActive,
          is_active: isActive
        })
        .eq('public_key', cleanPublicKey)
        .select();

      if (error) {
        console.error(`❌ Hata:`, error.message);
      } else if (data.length === 0) {
        // Veritabanında yoksa sessizce geç veya logla
        // console.log(`⚠️ EŞLEŞMEDİ: ${cleanPublicKey.substring(0, 10)}...`);
      } else {
        if (isActive || totalDownload > 0) {
            console.log(`✅ GÜNCELLENDİ: ${client.name} (DL: ${(totalDownload/1024/1024).toFixed(2)} MB)`);
        }
      }
    }

  } catch (err) {
    console.error('KRİTİK HATA:', err.message);
  }
}

syncData();
