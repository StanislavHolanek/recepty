# Naše recepty: jak aplikaci zprovoznit

Provoz je zdarma: web běží na GitHub Pages, data (recepty, fotky, nákupní seznam) v Supabase.

## 1. Databáze Supabase (asi 10 minut, uděláte vy)
1. Na https://supabase.com si založte účet (třeba přes GitHub) a dejte **New project**.
   Název `recepty`, region **Central EU (Frankfurt)**, heslo databáze si uložte.
2. Vlevo otevřete **SQL Editor → New query**, vložte celý obsah souboru `supabase/schema.sql` a klikněte na **Run**.
3. **Authentication → Users → Add user → Create new user**: vytvořte účet pro sebe a pro manželku
   (e-mail, heslo, zaškrtněte *Auto Confirm User*).
4. **Authentication → Sign In / Providers**: vypněte **Allow new users to sign up**.
   Od té chvíle se do aplikace nikdo další nezaregistruje.
5. **Project Settings → API Keys**: zkopírujte **Project URL** a **publishable key**
   (případně *anon public* key) a pošlete mi je do chatu. Já je doplním do `config.js`.
   Tenhle klíč je určený k veřejnému použití. **Nikdy** neposílejte *secret* ani *service_role* klíč.

## 2. Zveřejnění na GitHub Pages (udělám já)
- Nový **veřejný** repozitář `StanislavHolanek/recepty`, Pages z větve `main`.
- Adresa: **https://stanislavholanek.github.io/recepty/**
- Ostatních repozitářů ani nastavení účtu se to nedotkne (domluveno se sezením, které nasazuje CMS; viz `KOORDINACE-NASAZENI.md`).
- V repozitáři je jen kód. Recepty a fotky jsou v Supabase a bez přihlášení se k nim nikdo nedostane.

## 3. Do telefonu
- **iPhone:** otevřete adresu v Safari → tlačítko Sdílet → **Přidat na plochu**.
- **Android:** otevřete adresu v Chrome → menu ⋮ → **Přidat na plochu / Instalovat aplikaci**.
- Při prvním spuštění se každý přihlásí svým e-mailem a heslem. Přihlášení vydrží, dokud se neodhlásíte.

## 4. Recepty z papírků
1. Nafoťte papírky, stránky ze sešitu nebo z knížky. Recepty z telefonu stačí poslat jako text nebo screenshot.
2. Pošlete mi je v Claude a napište: *„Převeď na recepty do importu“*.
3. Ode mě dostanete soubor `recepty-….json`. Ten v aplikaci nahrajete přes **Více → Import receptů**.
   Pokud budete chtít, přiložím k receptu i fotku původního papírku.
4. Recepty se stejným názvem se při importu přeskočí, takže import omylem dvakrát nevadí.

## Dobré vědět
- **Uspání databáze:** bezplatný projekt Supabase se po **7 dnech bez používání** uspí.
  Data zůstanou. Stačí se přihlásit na supabase.com a u projektu kliknout na **Restore**.
  Když aplikaci aspoň jednou týdně otevřete, k uspání nedojde.
  Uložené recepty jdou i tak číst offline z paměti telefonu.
- **Záloha:** v aplikaci **Více → Stáhnout zálohu** stáhne všechny recepty do jednoho souboru (bez fotek).
- **Limity zdarma:** 500 MB databáze a 1 GB fotek, tedy tisíce receptů.
- **Co je doma:** na hlavní stránce zadáte suroviny, které máte, a aplikace ukáže recepty seřazené podle toho, co chybí.
  Chybějící suroviny jdou jedním ťuknutím poslat do nákupu.
- **Nevypínat displej:** v detailu receptu je tlačítko, které při vaření nechá displej rozsvícený.

## Formát importu (pro Claude)
```json
{
  "recipes": [
    {
      "title": "Svíčková na smetaně",
      "categories": ["Obědy"],
      "tags": ["neděle"],
      "servings": 4,
      "time_minutes": 180,
      "ingredients": ["Maso:", "800 g hovězí svíčkové", "Zelenina:", "2 mrkve", "1 cibule"],
      "steps": ["První krok…", "Druhý krok…"],
      "notes": "Poznámky z okraje papírku",
      "source": "Sešit od maminky",
      "photo_data": ["data:image/jpeg;base64,…"]
    }
  ]
}
```
Položky ingrediencí jsou ve tvaru „množství jednotka název“. Řádek končící dvojtečkou je nadpis skupiny.
`photo_data` je nepovinné (nejvýš 3 fotky).
Kategorie: Snídaně, Polévky, Obědy, Večeře, Přílohy, Omáčky, Saláty, Zákusky, Pečivo, Nápoje, Zavařování, Ostatní.
Recept může mít víc kategorií a jdou přidat i vlastní.

## Soubory
| Soubor | K čemu |
|---|---|
| `index.html`, `styles.css`, `app.js` | aplikace |
| `config.js` | připojení k Supabase (URL a publishable klíč) |
| `sw.js`, `manifest.webmanifest`, `icons/` | instalace na plochu a offline režim |
| `supabase/schema.sql` | tabulky, přístupová práva a úložiště fotek |
