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

async function cleanGhosts() {
  try {
    console.log("🧹 TEMİZLİKÇİ BAŞLADI...");

    // 1. Veritabanındaki GEÇERLİ Anahtarları Çek
    const { data: dbClients, error } = await supabase
      .from('vpn_clients')
      .select('public_key');

    if (error || !dbClients) {
      console.error("❌ Veritabanı okunamadı! Temizlik iptal.", error?.message);
      return;
    }

    const validKeys = new Set(dbClients.map(c => (c.public_key || '').trim()));
    console.log(`✅ Veritabanında ${validKeys.size} geçerli kullanıcı var.`);

    // 2. WireGuard API'ye Bağlan
    const sessionRes = await fetch(`${WG_API}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: WG_PASSWORD }),
    });

    const cookie = sessionRes.headers.get('set-cookie');
    if (!cookie) throw new Error('WireGuard girişi başarısız!');

    // 3. Sunucudaki Kullanıcıları Çek
    const wgRes = await fetch(`${WG_API}/api/wireguard/client`, {
      headers: { Cookie: cookie },
    });
    const wgClients = await wgRes.json();
    console.log(`📡 Sunucuda ${wgClients.length} kullanıcı mevcut.`);

    // 4. Karşılaştır ve Sil
    let deletedCount = 0;

    for (const client of wgClients) {
      const serverKey = (client.publicKey || '').trim();

      if (!validKeys.has(serverKey)) {
        console.log(`🗑️ SİLİNİYOR: ${client.name} (Key: ${serverKey.substring(0, 10)}...)`);
        
        const deleteRes = await fetch(`${WG_API}/api/wireguard/client/${client.id}`, {
          method: 'DELETE',
          headers: { Cookie: cookie },
        });

        if (deleteRes.ok) {
          console.log(`   -> Başarıyla silindi.`);
          deletedCount++;
        } else {
          console.error(`   -> Silinemedi! Hata kodu: ${deleteRes.status}`);
        }
      }
    }

    if (deletedCount === 0) {
      console.log("✨ Sunucu tertemiz! Silinecek hayalet kullanıcı bulunamadı.");
    } else {
      console.log(`🏁 Temizlik Bitti. Toplam ${deletedCount} hayalet kullanıcı uçuruldu.`);
    }

  } catch (err) {
    console.error('KRİTİK HATA:', err.message);
  }
}

cleanGhosts();
