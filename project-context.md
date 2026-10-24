---
project_name: 'nodebb-plugin-ieu-cancel-subscription'
user_name: 'kadir'
date: '2026-06-03'
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - code_quality_rules
  - workflow_rules
  - critical_rules
status: 'complete'
optimized_for_llm: true
---

# Project Context for AI Agents

_Bu dosya, projeye kod yazan AI agent'ların kaçırmaması gereken **belirgin olmayan** kuralları, pattern'leri ve sapmaları içerir. Genel JS/NodeBB bilgisi tekrar yazılmaz — sadece bu repo'ya özgü kararlar dokümante edilir._

---

## Technology Stack & Versions

| Katman | Teknoloji | Sürüm/Not |
|--------|-----------|-----------|
| Platform | NodeBB plugin | `nbbpm.compatibility: ^4.0.0` (PRD'de v3.x yazılı ama gerçek hedef v4) |
| Runtime | Node.js | v18+ (native `fetch`, `AbortController` kullanılıyor — polyfill YOK) |
| Dil | JavaScript | Plain JS, `'use strict'`, **TypeScript YOK**, build step YOK |
| Frontend | jQuery + Bootstrap 5 | NodeBB tarafından sağlanır — repo'ya eklenmez |
| Template | Benchpress | `<!-- IF foo -->`, `{foo.bar}` — Handlebars/Mustache DEĞİL |
| Settings | `meta.settings` | `meta.settings.get('ieu-cancel-subscription')` üzerinden |
| HTTP client | Native `fetch` | Hiçbir HTTP kütüphanesi (axios/got/node-fetch) eklenmedi |
| Dependencies | **Sıfır** | `package.json` boş `scripts`, harici dependency yok — yeni dep eklemeden önce iki kez düşün |

**Upstream servis (harici):** `ieu-forum-subscription` — `https://forum.ieu.app/pay` base, **IP-restricted**, NodeBB sunucusu allowlist'te olmalı.

---

## Critical Implementation Rules

### Language-Specific Rules (JavaScript)

- **Daima** `'use strict';` ile dosya başlat.
- NodeBB internals'a erişim: `require.main.require('./src/meta')` pattern'i — relative path veya direct `require('nodebb')` çalışmaz.
- `module.exports = plugin` — plugin tek bir object olarak expose edilir; hook handler'ları bu object'in property'sidir ve `plugin.json`'daki `method` adlarıyla **birebir** eşleşmelidir.
- Async/await tercih edilir; Promise zinciri kullanılmaz.
- `fetch` çağrıları **mutlaka** `AbortController` + timeout pattern'iyle korunur (bkz. `library.js:fetchFromService`). Çıplak `fetch()` kabul edilmez.
- HTML escape için `escapeHtml(str)` helper'ı zorunlu — string concatenation ile HTML üretirken kullanıcı/API verisi mutlaka geçer.
- Tarih hesabı: `Math.max(0, Math.ceil(diffMs / 86400000))` — negatif gün yok, kesir yukarı yuvarlanır.

### Framework-Specific Rules (NodeBB Plugin)

- **PRD'den sapma — kritik:** `filter:account/profile.build` hook'u **kullanılmadı**; NodeBB v4'te beklendiği gibi çalışmadığı için **widget + client-side DOM injection** hibrit pattern'ine geçildi. Agent bu hook'a geri dönmemeli.
- Aktif hook seti (`plugin.json`):
  - `static:app.load` → `plugin.init` (route registration)
  - `filter:widgets.getWidgets` → `plugin.defineWidgets`
  - `filter:widget.render:ieu-cancel-subscription` → `plugin.renderWidget`
  - `filter:admin.header.build` → `plugin.addAdminNavigation`
- Plan tespiti **artık** grup üyeliğine **dayanmıyor**. Tek doğruluk kaynağı subscription service'in API yanıtı (`data.planName` / `data.plan`). ACP'deki `lite/premium/vipGroupName` ayarları runtime'da kullanılmıyor (legacy — silinmedi ama referans alma).
- API response zarfı NodeBB convention: `{ status: { code: 'ok' | 'error', message }, response: {...} }` — düz JSON döndürme.
- Hook handler'lar **daima** ilk parametreyi mutate edip aynı objeyi geri döndürür (`return hookData`, `return header`, `return widget`, `return widgets`).
- API route handler içinde uid kaynağı **yalnızca** `req.uid` (session). Query/body uid kabul edilmez — güvenlik kuralı, istisnasız.
- Authentication middleware: `middleware.ensureLoggedIn` — özel auth yazılmaz.
- CSRF: POST endpoint'leri için frontend `'x-csrf-token': config.csrf_token` header'ı **zorunlu**.
- Client-side route prefix: `config.relative_path + '/api/...'` — çıplak `/api/...` subpath deployment'larda kırılır.
- Profil sayfası kart injection: `action:ajaxify.end` event'inde, `ajaxify.data.url.startsWith('/user/')` + `ajaxify.data.isSelf` + idempotency check (`#ieu-subscription-card` zaten varsa atla). SPA navigation destekli olmak zorunda.
- DOM injection fallback chain (`static/lib/main.js:injectCard`): widget area → `[component="aboutme"]` → profile stat row → `#content`. Bu sıra korunmalı.

### Testing Rules

- **Mevcut test infrastructure yok.** `test.js` repo'da var ama kapsamlı suite değil. Otomatik test framework (Jest/Mocha/Vitest) eklenmedi.
- Doğrulama manuel: NodeBB ACP'den plugin aktifleştirilip profil sayfası gözlemlenir.
- Yeni feature'lar için test eklemek istiyorsan **önce kullanıcıya sor** — keyfi olarak Jest/Mocha eklenmemeli (zero-dep politikası).
- Manuel test senaryoları PRD bölüm 12'de listeli; regression check için referans.

### Code Quality & Style Rules

- Indentation: **tab** (mevcut tüm `.js` ve `.tpl` dosyalarında).
- String quote: tek tırnak (`'`) JS için; HTML/template attribute'larında çift tırnak (`"`).
- Naming:
  - Dosya: `kebab-case` (`ieu-cancel-subscription.tpl`, `library.js`, `main.js`)
  - Plugin slug / setting key: `ieu-cancel-subscription`
  - JS function: `camelCase`
  - DOM id/class: `kebab-case`, `ieu-` prefix'i UI element'leri için (`#ieu-cancel-btn`, `#ieu-subscription-card`)
- Console log prefix: `[ieu-cancel-sub]` — **her** debug log'da; NodeBB log akışında filtrelenmek için.
- ESLint/Prettier config **yok** — manuel olarak mevcut stile uyum sağla.
- README yok; dokümantasyon `PRD-NODEBB-PLUGIN.md` (Türkçe) + bu dosya.

### Development Workflow Rules

- Single-branch: `main`. Feature branch convention dokümante edilmedi — küçük scope, doğrudan main'e commit normal.
- Commit message stili (mevcut tek commit): Conventional Commits (`feat:`, `fix:`) — devam ettir.
- Deploy: NodeBB `node_modules/nodebb-plugin-ieu-cancel-subscription/` altına symlink/copy → `./nodebb activate` → `./nodebb build` → `./nodebb restart`. Build step zorunludur (client-side script'ler/template'ler için).
- ACP ayarları runtime'da `meta.settings.get` ile okunur — değişiklik için NodeBB restart gerekmez.

### Critical Don't-Miss Rules

**ASLA yapma:**

- ❌ Client'tan uid kabul etme (query/body) — daima `req.uid`.
- ❌ Subscription service'e doğrudan client'tan istek atma — IP-restricted; proxy mutlaka NodeBB üzerinden.
- ❌ HTML string concatenation'da kullanıcı/API verisini `escapeHtml`'siz embed etme.
- ❌ NodeBB'nin sağladığı kütüphaneleri (`jquery`, `bootstrap`) `package.json`'a ekleme — zaten global.
- ❌ Yeni harici dependency ekleme — projenin zero-dep ilkesi var; istisna gerekiyorsa kullanıcıya sor.
- ❌ TypeScript veya build tool (webpack/vite/rollup) ekleme — plain JS politikası.
- ❌ `filter:account/profile.build` hook'unu yeniden kullanmaya çalışma — denenmiş, çalışmıyor.
- ❌ `console.log` prefix'siz log atma — `[ieu-cancel-sub]` zorunlu.
- ❌ API response'unu düz JSON olarak döndürme — NodeBB zarfı (`{ status, response }`) kullan.
- ❌ Plan/abonelik durumu için grup üyeliğine güvenme — API yanıtı tek kaynak.
- ❌ `config.relative_path` olmadan `/api/...` çağırma.

**Mutlaka yap:**

- ✅ `fetch` her kullanımda timeout (AbortController) ile.
- ✅ Profil kartı injection idempotent (`getElementById('ieu-subscription-card')` ön-kontrol).
- ✅ İptal butonu disable + spinner pattern'iyle double-submit koruması.
- ✅ Hata durumunda sessiz fallback (profil load) vs. açık modal (cancel action) ayrımı: profil yüklenirken kullanıcı taraflı hata göstermek **yok**; iptal aksiyonunda göster.
- ✅ Türkçe locale: tarih `toLocaleDateString('tr-TR', ...)`, label'lar Türkçe (`Aylık`, `Yıllık`, `Bitiş Tarihi`).
- ✅ `daysRemaining ≤ 3` → uyarı stili (`text-danger`, `alert-warning`).

**PRD ↔ Kod sapması — agent için kural:**

PRD bazı tasarımları (örn. `filter:account/profile.build` hook, iki aşamalı grup+API tespiti, `addRoutes`/`addSubscriptionData` method adları, `partials/ieu-subscription-cancel.tpl` server-render) içeriyor; **gerçek implementasyon farklı** (widget + client-side DOM injection). **Kod kaynaktır, PRD değil.** PRD planlanan davranışın referansı olarak kalır ama implementasyon detayları için `library.js` + `static/lib/main.js` esas alınmalı. Mevcut `partials/ieu-subscription-cancel.tpl` artık kullanılmıyor (legacy) — silinmemiş, render yolu üzerinde değil.

---

## Usage Guidelines

**AI Agent için:**

- Kod yazmadan önce bu dosyayı oku.
- Tüm kuralları **istisnasız** uygula; tereddüt halinde daha kısıtlayıcı seçeneği tercih et.
- Yeni pattern ortaya çıkarsa bu dosyayı güncelle.
- PRD ile kod çelişirse **kod kazanır** — PRD niyet beyanı, repo gerçek.

**Geliştirici için:**

- Dosyayı yalın tut — agent context window'unu israf etme.
- Teknoloji yığını değişince güncelle (özellikle NodeBB sürümü, upstream service URL'i, ACP ayar key'leri).
- Yeni hook eklersen `plugin.json` ile method adı eşleştirmesini buraya yansıt.
- Eski/legacy kararları silmeden önce **neden** legacy olduğunu kaydet — yeniden denenmesini engeller (örn. `filter:account/profile.build` notu).
