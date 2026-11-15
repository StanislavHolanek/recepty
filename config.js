// Edice „Martinčina kuchařka“ – dárek pro Martinku, vydává se na https://stanislavholanek.github.io/recepty/
// Publishable klíč Supabase (projekt martinka-kucharka) je určený k veřejnému použití – data chrání přihlášení a pravidla v databázi.
window.EDICE = {
  id: 'martinka',
  nazev: 'Martinčina kuchařka',
  kratky: 'Martinka',
  prihlaseni: 'Přihlaste se, recepty uvidíte jen vy dva.',
  supabase: {
    url: 'https://mjzqgecbnygjtpjdmlrt.supabase.co',
    key: 'sb_publishable_4NSYnWX4ijHGU8Z8n7zqZQ_LOcJS4BR',
  },
  // Převod papírků: 'claude' = Martinka jen nafotí, recept přepíše Claude přes /cms-recepty (dočasně, než bude AI v aplikaci)
  prevod: 'claude',
  // Jazyky, do kterých se recepty překládají (při sdílení). Aplikace sama zůstává česky.
  jazykyReceptu: ['vi'],
  sdileni: {
    cs: { brand: 'Martinčina kuchařka', footer: '— z Martinčiny kuchařky 🌸' },
    vi: { brand: 'Sổ nấu ăn của Martinka', footer: '— từ Sổ nấu ăn của Martinka 🌸' },
  },
};

// Pro starší app.js v mezipaměti telefonů (před spojením edic četl RECEPTY_CONFIG)
window.RECEPTY_CONFIG = { supabaseUrl: window.EDICE.supabase.url, supabaseKey: window.EDICE.supabase.key };
