<div dir="rtl" align="center">

<img src="assets/logo.svg" width="96" height="96" alt="شعار Obsidian Prism" />

# Obsidian Prism (الإصدار ثنائي اللغة: الإنجليزية والعربية)

**حزمة واجهة بصرية أصلية لتطبيق Google Antigravity — بدعم كامل للإنجليزية (`en`) والعربية (`ar` مع اتجاه RTL)**

أربع سمات داكنة ونهارية · أنبوب سياق حي بسعة 512K · شريط تحكم في جهد الاستدلال · مرافقون بكسليون · خلفية ثابتة / فيديو مخصصة (تجريبي) · وضع الدردشة (تجريبي)

[**English**](./README.md) · [**العربية**](./README.ar.md) · [**سجل التغييرات**](./CHANGELOG.md) · [**الإصدارات**](https://github.com/omarallsharkawy/obsidian-prism/releases) · [**البلاغات**](https://github.com/omarallsharkawy/obsidian-prism/issues)

<p>
  <a href="https://github.com/omarallsharkawy/obsidian-prism/releases"><img src="https://img.shields.io/github/v/release/omarallsharkawy/obsidian-prism?style=flat-square&color=3186ff&label=Release" alt="أحدث إصدار" /></a>
  <img src="https://img.shields.io/badge/Version-1.0.8--beta.2-0f172a?style=flat-square" alt="الإصدار 1.0.8-beta.2" />
  <img src="https://img.shields.io/badge/Languages-English%20%7C%20Arabic%20(RTL)-0ea5e9?style=flat-square" alt="اللغات: الإنجليزية والعربية" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20Universal%20%7C%20Linux-1e293b?style=flat-square" alt="المنصات" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-2563eb?style=flat-square" alt="الترخيص: GPL-3.0" /></a>
  <a href="./NOTICE"><img src="https://img.shields.io/badge/Attribution-Required%20(NOTICE)-8b5cf6?style=flat-square" alt="الإسناد مطلوب" /></a>
</p>

<sub>اللقطات مُصيَّرة إطاراً بإطار عبر منصة عرض محلية تشغّل الكود المصدري لواجهة هذا المستودع مباشرة. جميع مساحات العمل والمحادثات المعروضة افتراضية.</sub>

</div>

<div dir="rtl">

> **إشعار التفريع والإسناد (`GPL-3.0-only` + `NOTICE`)**
>
> هذا المستودع (`omarallsharkawy/obsidian-prism`) هو تفريع مجتمعي مبني على [**Obsidian Prism**](https://github.com/RMvdesi/obsidian-prism) من تطوير [@RMvdesi](https://github.com/RMvdesi) ومرخّص بموجب **[GPL-3.0](./LICENSE)**.
> يوحّد هذا التفريع الحزمة بالكامل — الواجهة، الإعدادات، تعريب التطبيق المضيف، مترجم سلاسل التفكير، مثبّتات سطح المكتب، منصة المعاينة، والوثائق — لتكون **ثنائية اللغة بالإنجليزية (`en`) والعربية (`ar` مع دعم كامل لاتجاه RTL)**. جميع إشعارات حقوق النشر الأصلية محفوظة بالكامل في [`NOTICE`](./NOTICE) و[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

> **إخلاء مسؤولية عدم الارتباط والعلامات التجارية**
>
> **مشروع Obsidian Prism هو مشروع مفتوح المصدر مستقل وغير تابع لشركة Google LLC أو معتمد منها.**
> تُستخدم الإشارات إلى “Antigravity” و“Google” لأغراض التوافق والوصف فقط.

---

## أبرز المزايا

- **ثنائية اللغة: الإنجليزية والعربية (RTL)**: دعم أصيل وكامل للغتين الإنجليزية (`en`) والعربية (`ar`) مع تخطيط من اليمين إلى اليسار (`dir="rtl"`) عبر لوحة الإعدادات والمثبّتات ومنصة المعاينة والتعريب الاختياري للواجهة المضيفة.
- **أربع سمات بنقرة واحدة**: «الأوبسيديان الداكن» و«الفحم الدافئ»، بالإضافة إلى «بلّور النهار» و«المرمر الدافئ» — مع تتبّع تلقائي لوضع النظام الفاتح والداكن.
- **سياق مرئي لحظياً**: أنبوب زجاجي صغير بجانب مربع الإدخال يعرض استهلاك السياق بسعة 512K مباشرة؛ انقر عليه لاستعراض تفاصيل الاستهلاك وتوقعات الحصص.
- **تحكم دقيق بجهد الاستدلال**: شريط نجوم تفاعلي داخل قائمة النماذج؛ وعند اختيار Orchestrator يتحول إلى قضيب كريستالي مقطوع يكسر الضوء بواقعية WebGL2.
- **ترجمة سلاسل التفكير والعناوين**: ترجمة فورية لأفكار النموذج إلى العربية أو الإنجليزية (وضع غامر أو ثنائي اللغة متراص) مع أداة التشخيص بنقرة واحدة، ودعم بروكسي HTTP/SOCKS5 يدوي، وترجمة اختيارية لملخصات الأدوات وعناوين المحادثات.
- **خلفية ثابتة / فيديو حي مخصصة (تجريبي)**: متوفرة ضمن **الإعدادات ← تجريبي (Beta)**، معطّلة افتراضياً بصفر عبء؛ تقرأ الصور المحلية ومقاطع MP4/WebM بوضع القراءة فقط.
- **مرافقون بكسليون**: Clawd والقط البنفسجي الصغير والتنين الأبيض والحوت الأزرق وثلاث سرطانات صغيرة تتكدس فوق مربع الإدخال — مع تأثير قوس قزح سري وتوقف تلقائي عند الخمول.
- **مساحة عمل أذكى**: متصفح جانبي مدمج وعارض ملفات ضخمة، قائمة سياق بالنقر الأيمن، طيّ كتل الشيفرات الطويلة، وفهرس تنقّل سريع بين الأدوار.
- **وضع الدردشة (تجريبي)**: مساحة مستقلة للمحادثات اليومية والملاحظات، مفصولة بالكامل عن مساحة البرمجة وإعداداتها العامة.
- **خفيف وسريع ومحترم للنظام**: تهدأ الرسوم المتحركة إلى `0fps` عند الخمول، وتعمل الخدمات المحلية على `127.0.0.1` فقط، وتُطبَّق الإعدادات في أقل من 10 مللي ثانية، مع إزالة نظيفة بالكامل.

---

## نظرة بصرية سريعة

### 1. السمات الأربع

| السمة | مفتاح الإعداد | الشريط الجانبي | لوحة العرض | الوصف |
| :--- | :--- | :--- | :--- | :--- |
| **الأوبسيديان الداكن (Obsidian Dark)** | `palette: "obsidian"` | `#09090B` | `#0E0E11` | لوحة ألوان أردوازية داكنة باردة لقراءة الشيفرات بتباين عالٍ |
| **الفحم الدافئ (Warm Charcoal)** | `palette: "warm"` | `#10100F` | `#141413` | سمة داكنة دافئة تقلل وهج الضوء الأزرق |
| **بلّور النهار (Daylight Crystal)** | `lightPreset: "crystal"` | `#E8EEF6` | `#F4F7FB` | شريط جانبي أزرق أردوازي بارد مع مساحة عمل نهارية مشرقة |
| **المرمر الدافئ (Warm Alabaster)** | `lightPreset: "alabaster"` | `#EBE6DC` | `#F6F4EE` | سمة نهارية بلون الورق الدافئ وتباين مريح للعين |

### 2. التفاصيل البصرية: أنبوب السياق · شريط الجهد · الكريستال المقطوع

انقر على الأنبوب لفتح بطاقة الاستخدام التي تعرض شرائح السياق وحصة الـ 5 ساعات وهامش مجمّع النماذج. يضيء شريط جهد الاستدلال بحقل نجوم متدرج، ويظهر Orchestrator كقضيب كريستالي مقطوع.

### 3. المرافقون البكسليون

اسحب المرافقين فوق مربع الإدخال وكدّسهم في برج من خمسة طوابق؛ وعند تحقق الشروط يرتدي القط البنفسجي عباءة شفق قوس قزح. ينامون تلقائياً عند الخمول ويمكن تعطيلهم في أي وقت من الإعدادات.

### 4. وضع الدردشة (تجريبي)

معطّل افتراضياً — فعّله من **الإعدادات ← المظهر ← تجريبي (Beta)**. يضيف مبدّلاً أعلى الشريط الجانبي للتنقل بين وضع البرمجة (Code) ووضع الدردشة (Chat) مع مجلدات منظّمة وصلاحيات معزولة لكل مشروع لا تمس إعدادات البرمجة العامة.

### 5. قدرات إضافية

- **مركز التحكم بالمظهر**: ضمن **الإعدادات ← المظهر** — نافذة من عمودين، **واجهة ثنائية اللغة (الإنجليزية `en` والعربية `ar` بوضع RTL)**، **36** إعداداً موثّقاً بالكامل، ثلاثة أوضاع مشهدية جاهزة (بصريات كاملة / تركيز عميق / توفير صامت)، النسخ الاحتياطي والاستعادة، والتحديث بنقرة واحدة.
- **مترجم التفكير والعناوين**: وحدة تُحمّل عند الطلب (`0 B` عند التعطيل)؛ تدعم الترجمة الآلية الفورية أو نقاط النهاية المحلية/المتوافقة مع OpenAI للبث المباشر (نحو العربية أو الإنجليزية)، كشف بروكسي النظام تلقائياً + بروكسي HTTP/SOCKS5 يدوي، ترجمة ملخصات الأدوات وعناوين المحادثات، وشريط تشخيص بنقرة واحدة.
- **خلفية ثابتة / فيديو حي مخصصة (تجريبي)**: وحدة تجريبية معطّلة افتراضياً؛ بث محلي للقراءة فقط لملفات الصور (JPG/PNG/WebP/GIF/AVIF) والفيديو (MP4/WebM) مع تحكم بالشفافية والتمويه والتعتيم وإيقاف تلقائي عند فقدان التركيز (`0fps`).
- **متصفح Omni وعارض الملفات ومعاينة الفروقات المدمجة**: فتح الروابط النصية والمسارات المحلية في اللوحة الجانبية، معاينة فروقات Git المدمجة داخل المحادثة، بث ملفات الفيديو والصوت وPDF والجداول والخطوط الضخمة، والنقر الأيمن لنسخ المسارات أو إظهار الملفات أو إدراج الإشارات.

---

## البدء السريع

يوفر Obsidian Prism **مثبّتات رسومية مستقلة** (لا تتطلب تثبيت Node.js) وكذلك **التثبيت المباشر من الشيفرة المصدرية**، مع توافق كامل مع **`Antigravity v2.33.0+`** (حيث يحافظ تلقائياً على العلم `--remote-debugging-port=0` في اختصارات التشغيل ويوفر إعادة تشغيل بنقرة واحدة بعد التحديثات):

### الخيار أ: المثبّت الرسومي المستقل (موصى به · بدون Node.js)
تجد ملفات التثبيت في [صفحة الإصدارات](https://github.com/omarallsharkawy/obsidian-prism/releases) عند نشرها. يمكنك أيضًا التثبيت مباشرةً من الشيفرة المصدرية باتباع الخطوات أدناه.
1. **ويندوز (`x64`)**: نزّل [**`obsidian-prism-installer.exe`**](https://github.com/omarallsharkawy/obsidian-prism/releases/latest/download/obsidian-prism-installer.exe) وشغّله. ينشر الإضافة المحلية في `~/.gemini/config/plugins/obsidian-prism` ويشغّل الخدمة الخلفية فوراً باستخدام بيئة Antigravity المدمجة (أعد تشغيل نفس الملف لإلغاء التثبيت النظيف في أي وقت).
2. **ماك (`Apple Silicon & Intel Universal`)**: نزّل [**`Obsidian-Prism-macOS-universal.dmg`**](https://github.com/omarallsharkawy/obsidian-prism/releases/latest/download/Obsidian-Prism-macOS-universal.dmg)، اسحب `Obsidian Prism.app` إلى `/Applications`، ثم **افتح `Obsidian Prism.app` مرة واحدة** لإكمال النشر وإعداد `LaunchAgent`.
3. **لينكس (`حزمة محمولة`)**: نزّل `obsidian-prism-linux-portable.tar.gz` وفك ضغطه ثم شغّل `./install.sh` (واستخدم `./uninstall.sh` للإزالة النظيفة).

> **ملاحظة أمان التشغيل الأول (بناء مفتوح المصدر)**
> - **Windows SmartScreen**: إذا ظهرت رسالة *"Windows protected your PC"*، انقر **معلومات إضافية (More info) ← التشغيل على أي حال (Run anyway)**.
> - **macOS 15+ Gatekeeper**: افتح **إعدادات النظام ← الخصوصية والأمان** وانقر **الفتح على أي حال (Open Anyway)**، أو أزل سمة الحجر الصحي مرة واحدة عبر الطرفية:
>   <div dir="ltr">
>
>   ```bash
>   xattr -cr "/Applications/Obsidian Prism.app"
>   ```
>
>   </div>

### الخيار ب: التثبيت الأصلي على لينكس (بدون صلاحيات root)
يوفر Obsidian Prism **دعماً أصلياً كاملاً لنظام Linux** دون الحاجة لصلاحيات `root` — حيث ينشئ تلقائياً نسخاً ظلّية لملفات XDG `.desktop` داخل `~/.local/share/applications/` ومُطلِقاً مُداراً (`antigravity-prism.desktop`) مع دعم تلقائي لـ AppImage و`~/.local/bin/antigravity` واستعادة كاملة بلا خسارة عند الإزالة:

1. **الأرشيف المحمول (`.tar.gz` بلا اعتمادات خارجية)**: نزّل `obsidian-prism-linux-portable.tar.gz` من [**GitHub Releases**](https://github.com/omarallsharkawy/obsidian-prism/releases) (أو قم ببنائه محلياً عبر `npm run build:linux`)، وفك الضغط ثم شغّل:

</div>

```bash
./install.sh
# لنسخ AppImage أو المسارات المخصصة لتطبيق Antigravity:
./install.sh --target-exe /path/to/Antigravity.AppImage
# للتحقق من الحالة أو الإزالة النظيفة:
./status.sh
./uninstall.sh
```

<div dir="rtl">

2. **من الشيفرة المصدرية على لينكس**:

</div>

```bash
git clone https://github.com/omarallsharkawy/obsidian-prism.git
cd obsidian-prism
npm run install:plugin
# أو تحديد مسار AppImage أو ~/.local/bin/antigravity صراحةً:
node tools/install-plugin.cjs --target-exe ~/.local/bin/antigravity
```

<div dir="rtl">

### الخيار ج: التثبيت الأصلي من الشيفرة المصدرية (للمطورين)

</div>

```bash
git clone https://github.com/omarallsharkawy/obsidian-prism.git
cd obsidian-prism

# نشر الإضافة إلى ~/.gemini/config/plugins/obsidian-prism والاتصال بالنوافذ المفتوحة
npm run install:plugin
```

<div dir="rtl">

ثم افتح **الإعدادات ← المظهر (Settings → Appearance)** داخل Antigravity لتوسيع لوحة تحكم **Obsidian Prism** واختيار اللغة **العربية (`ar`)** أو **الإنجليزية (`en`)**.

### مسار التثبيت القياسي بمساعدة الذكاء الاصطناعي والتحقق من الصحة

</div>

```bash
git clone https://github.com/omarallsharkawy/obsidian-prism.git
cd obsidian-prism

# 1. نشر الإضافة المحلية بالكامل وتشغيل الخدمة الخلفية الدائمة
npm run install:plugin

# 2. التحقق من صحة التثبيت والخدمة الخلفية والوحدات المحمّلة عند الطلب
node tools/install-plugin.cjs --status
```

<div dir="rtl">

- **لا تستخدم `npm run inject` كبديل للتثبيت**: يقوم `npm run inject` بحقن مؤقت لمرة واحدة فقط دون تثبيت دائم في `~/.gemini/config/plugins/obsidian-prism` ودون تشغيل الخدمة الخلفية.
- **تحقّق من مخرجات `--status`**: تأكد من `installed: true` و`daemonAlive: true` و`hasThoughtTranslator: true` و`hasWallpaperChannel: true`.

### أوامر المطورين الشائعة

</div>

```bash
npm run status                 # فحص صحة التثبيت والخدمة الخلفية والوحدات
npm run inject                 # حقن فوري لمرة واحدة في نوافذ Antigravity المفتوحة
npm run remove                 # إزالة نظيفة لجميع الأنماط والأدوات واستعادة الواجهة الأصلية
npm run archive:conversations  # فحص تضخم قاعدة المحادثات وأرشفة جلسات الوكلاء الفرعيين بأمان
npm test                       # تشغيل مجموعة اختبارات الأمان والحزمة والتكامل
npm run build:installer        # بناء مثبّت ويندوز المستقل (.exe)
npm run build:macos            # بناء حزمة macOS Universal المستقلة (.dmg)
npm run build:linux            # بناء حزمة لينكس المحمولة (.tar.gz)
```

<div dir="rtl">

---

## الترخيص والإسناد وشروط الأعمال المشتقة

### 1. الترخيص مفتوح المصدر والإسناد الإلزامي (`GPL-3.0-only` + `NOTICE`)

مشروع **Obsidian Prism** (`Copyright (C) 2026 RMvdesi`) مرخّص بموجب **[رخصة جنو العمومية الإصدار 3.0 (`GPL-3.0-only`)](./LICENSE)** مع شروط الإسناد الإلزامية وفق البند 7 في ملف **[`NOTICE`](./NOTICE)**.

> مبني على مشروع [Obsidian Prism](https://github.com/RMvdesi/obsidian-prism) للمؤلف [@RMvdesi](https://github.com/RMvdesi)، والمرخّص بموجب [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html). جميع إشعارات المكونات الأصلية محفوظة بالكامل في [`NOTICE`](./NOTICE) و[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

يجب على أي تفريع أو تعديل أو إعادة توزيع الالتزام بالشروط الثلاثة التالية:
1. **المعاملة بالمثل (Copyleft)**: توزيع أي عمل مشتق بموجب **`GPL-3.0`** مع إتاحة الشيفرة المصدرية الكاملة.
2. **الحفاظ على سلسلة الإسناد**: الإبقاء على [`LICENSE`](./LICENSE) و[`NOTICE`](./NOTICE) و[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) سليمة مع إظهار الإسناد لـ `@RMvdesi` و`RMvdesi/obsidian-prism`.
3. **توثيق التعديلات وعدم الإيحاء بالاعتماد الرسمي**: توثيق التغييرات وتاريخها في الملفات المعدّلة وعدم تقديم النسخ المعدّلة كإصدارات رسمية دون إذن كتابي مسبق.

### 2. شكر وتقدير للمشاريع المصدرية (MIT) والمساهمين

تُحفظ كامل إشعارات حقوق النشر والتراخيص للمكونات المقتبسة تحت رخصة **MIT** في ملف [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) (بما في ذلك `0DNANCY/agy-claude-style` و`ATtacK030130/antigrative-dashboard` و`LLYSH-HANNARI/antigravity-Codex-Claude-effort-slider` للمؤلف `Yueshanghan / LLYSH-HANNARI` و`yiheng8023/antigravity-chinese` و`wp3171216237/dsh-TUI`).

للاطلاع على قائمة المساهمين الكاملة راجع [**`CONTRIBUTORS.md`**](./CONTRIBUTORS.md) وسجل التغييرات [**`CHANGELOG.md`**](./CHANGELOG.md). نرحّب دائماً بمساهماتكم عبر [البلاغات](https://github.com/omarallsharkawy/obsidian-prism/issues) و[طلبات الدمج](https://github.com/omarallsharkawy/obsidian-prism/pulls)!

</div>
