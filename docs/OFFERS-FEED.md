# Global Home Offers Feed (`GET /api/v1/offers`)

دليل الـ Endpoint الموحد لعرض العروض السارية عبر **جميع المطاعم النشطة** في الصفحة الرئيسية (`Home Page`) لتطبيق الموبايل، مع Pagination كامل وخوارزمية ترتيب ذكية وتنويع تلقائي للمطاعم.

---

## 1. معلومات الـ Endpoint الأساسية

| الخاصية                 | القيمة                                                               |
| :---------------------- | :------------------------------------------------------------------- |
| **Method & Path**       | `GET /api/v1/offers`                                                 |
| **Production URL**      | `https://api.akeelaonline.tech/api/v1/offers`                        |
| **Local URL**           | `http://localhost:3000/api/v1/offers`                                |
| **Authentication**      | **Public** — لا يتطلب `Authorization` Header أو تسجيل دخول           |
| **Customer Swagger**    | `https://api.akeelaonline.tech/api/v1/docs/customer/` (قسم `Offers`) |
| **Currency & Timezone** | `EGP` (نصوص عشرية بخانتين) · التوقيت `Africa/Cairo`                  |

---

## 2. المعاملات (`Query Parameters`)

| Parameter   | النوع     | مطلوب؟ | الافتراضي | القيم المسموحة                                                                     |
| :---------- | :-------- | :----: | :-------: | :--------------------------------------------------------------------------------- |
| `page`      | `integer` |   لا   |    `1`    | من `1` إلى `10000` (يُتجاهل لحساب الإزاحة عند تمرير `offset`).                      |
| `per_page`  | `integer` |   لا   |   `20`    | من `1` إلى `100` (`limit` له الأولوية عليه عند تمريره).                            |
| `limit`     | `integer` |   لا   |     —     | بديل اختياري لـ `per_page` (من `1` إلى `100`).                                     |
| `offset`    | `integer` |   لا   |     —     | إزاحة اختيارية تبدأ من `0` حتى `1000000` (لها الأولوية على `page`).                |
| `open_only` | `boolean` |   لا   |  `false`  | `true` أو `false` — عند `true` تُرجع عروض المطاعم المفتوحة الآن فقط بتوقيت القاهرة. |

> **ملاحظة:** خيار `sort` مؤجّل كميزة مستقبلية (`Future Feature`)؛ جميع الطلبات تُرتَّب تلقائيًا بخوارزمية الترتيب الذكي الموضّحة أدناه.

---

## 3. خوارزمية الترتيب الذكي وتنويع المطاعم

1. **أولوية المطاعم المفتوحة (`is_open = true`):**
   - عروض المطاعم المفتوحة حاليًا بتوقيت `Africa/Cairo` تظهر دائمًا قبل عروض المطاعم المغلقة.
2. **معادلة النقاط المركّبة (`Composite Score` من 100 نقطة):**
   - **الشعبية الحديثة (`45%` — حتى 45 نقطة):** مجموع الوحدات المطلوبة من العرض خلال آخر 30 يوم (مع وزن مضاعف `2×` لطلبات آخر 7 أيام) عبر `LEAST(45, LN(1 + orders_30d + orders_7d) * 12)`، مع استبعاد الطلبات ذات الحالة `Cancelled` أو `Rejected` أو `Failed`.
   - **قوة الخصم (`25%` — حتى 25 نقطة):** `LEAST(25, ((initial_price - real_price) / initial_price) * 50)` — تحل مشكلة العروض الجديدة ذات الخصم القوي.
   - **حداثة العرض (`15%` — Cold-Start Boost):** دفعة تتناقص تدريجيًا خلال أول 7 أيام من نشر/بداية العرض حتى يأخذ فرصته العادلة في الظهور.
   - **قرب الانتهاء (`15%` — Urgency Boost):** دفعة تتصاعد خلال آخر 48 ساعة قبل `expires_at` لتعزيز التحويل للعروض التي تنتهي قريبًا.
3. **تنويع المطاعم (`Restaurant Diversity Round-Robin`):**
   - تُعطى المرتبة `1` لأفضل عرض في كل مطعم، ثم المرتبة `2` لثاني أفضل عرض في كل مطعم، وهكذا — بحيث تعرض الشاشة الأولى أفضل العروض من مطاعم متعددة بدل سيطرة مطعم واحد على أول 5 كروت.
4. **عزل البيانات والأداء:**
   - تظهر فقط العروض النشطة داخل نافذة البيع الحالية (`is_active = true AND starts_at <= NOW() < expires_at`) التابعة لمطاعم نشطة ومفعّلة (`Active`) وملاكها نشطون ومؤكَّدو البريد.
   - مدعوم بفهرسين جزئيين في PostgreSQL (`ix_order_items_offer_order` و`ix_offers_public_active_window`).

---

## 4. أمثلة الطلبات والردود

### الحالة 1: الصفحة الأولى للـ Home Page (`page` & `per_page`)

**Request:**

```http
GET /api/v1/offers?page=1&per_page=10
```

**Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Records returned.",
  "data": [
    {
      "offer_id": "18",
      "rest_id": "2",
      "offer_title": "وجبة الشاورما العربي الموفرة",
      "offer_description": "وجبة شاورما عربي + بطاطس + ثومية + مشروب",
      "initial_price": "200.00",
      "real_price": "150.00",
      "offer_image_url": "https://api.akeelaonline.tech/images/example-offer.webp",
      "starts_at": "2026-11-23T00:00:00.000Z",
      "expires_at": "2026-12-31T21:59:59.000Z",
      "rest_title": "شاورما كرم الشام الاصلي",
      "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
      "is_open": true,
      "discount_percentage": 25,
      "orders_count": 14
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 10,
    "total": 35,
    "last_page": 4
  }
}
```

### الحالة 2: المطاعم المفتوحة الآن فقط مع `limit` و `offset`

**Request:**

```http
GET /api/v1/offers?open_only=true&limit=10&offset=10
```

### الحالة 3: عدم وجود عروض متاحة أو صفحة بعد الأخيرة

**Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Records returned.",
  "data": [],
  "meta": {
    "page": 10,
    "per_page": 10,
    "total": 35,
    "last_page": 4
  }
}
```

### الحالة 4: خطأ تحقق في المعاملات (`422 VALIDATION_ERROR`)

**Request:**

```http
GET /api/v1/offers?per_page=200&open_only=yes
```

**Response (`422 Unprocessable Entity`):**

```json
{
  "success": false,
  "message": "Please review the highlighted fields and try again.",
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "per_page": ["per_page cannot exceed 100."],
      "open_only": ["open_only must be true or false."]
    }
  }
}
```
