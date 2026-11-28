# Global Mobile Search API (`GET /api/v1/search`)

دليل متكامل لـ Endpoint البحث الشامل لعميل الموبايل في منصة **AKEELA**، يشمل جميع المعاملات (`Query Parameters`)، قواعد الترتيب والظهور، وأمثلة الردود الكاملة (`JSON Responses`) لجميع حالات النجاح والأخطاء.

---

## 1. معلومات الـ Endpoint الأساسية

| الخاصية                 | القيمة                                                               |
| :---------------------- | :------------------------------------------------------------------- |
| **Method & Path**       | `GET /api/v1/search`                                                 |
| **Production URL**      | `https://api.akeelaonline.tech/api/v1/search`                        |
| **Local URL**           | `http://localhost:3000/api/v1/search`                                |
| **Authentication**      | **Public** — لا يتطلب `Authorization` Header أو تسجيل دخول           |
| **Customer Swagger**    | `https://api.akeelaonline.tech/api/v1/docs/customer/` (قسم `Search`) |
| **Currency & Timezone** | العملة `EGP` (كنص عشري بخانتين) · التوقيت `Africa/Cairo`             |

---

## 2. المعاملات المتاحة (`Query Parameters`)

| Parameter   | النوع             | مطلوب؟  | الافتراضي | القيم المسموحة والقيود                                                               |
| :---------- | :---------------- | :-----: | :-------: | :----------------------------------------------------------------------------------- |
| `q`         | `string`          | **نعم** |     —     | من `1` إلى `100` حرف بعد إزالة المسافات الزائدة (`trim`). القيمة الفارغة ترجع `422`. |
| `type`      | `enum`            |   لا    |   `all`   | `all` · `restaurants` · `products` · `offers` · `categories`                         |
| `limit`     | `integer`         |   لا    |   `10`    | عدد صحيح من `1` إلى `50` (الحد الأقصى للنتائج المُرجَعة في كل قسم).                    |
| `open_only` | `boolean`         |   لا    |  `false`  | `true` أو `false` — عند `true` تُرجع نتائج المطاعم المفتوحة حاليًا فقط بتوقيت القاهرة. |
| `rest_id`   | `string` (BIGINT) |   لا    |     —     | معرّف مطعم رقمي موجب (`^[1-9]\d{0,18}$`) لحصر البحث داخل منيو مطعم محدد فقط.          |

> **ملاحظة لتطبيق الموبايل:** مرّر `q` دائمًا عبر `queryParameters` في العميل (مثل Dio / Retrofit / URLSearchParams) أو `encodeURIComponent` لضمان ترميز الحروف العربية والمسافات بشكل سليم.

---

## 3. بنية الحقول في الاستجابة (`Response Schema`)

- جميع المعرّفات (`rest_id`, `prod_id`, `cat_id`, `offer_id`) **نصوص (`string`)** تمثل `BIGINT` — لا تحوّلها إلى `number` في JavaScript.
- جميع الأسعار (`price`, `initial_price`, `real_price`) **نصوص عشرية (`"125.00"`)** بالجنيه المصري (`EGP`).
- الإحداثيات (`longitude`, `latitude`) **نصوص بـ 7 أرقام عشرية**.
- مواعيد الفتح والإغلاق (`opens_at`, `closes_at`) بصيغة `HH:mm:ss` بتوقيت القاهرة، و`is_open` يحسبها السيرفر لحظيًا (مع دعم الساعات الليلية مثل `10:00:00` حتى `02:00:00`).
- `counts`: تحتوي على **العدد الكلي الدقيق** للمطابقات في كل قسم (حتى لو كان `limit` أصغر من العدد الكلي).
- `matched_in` داخل كل مطعم: مصفوفة توضّح أسباب ظهور المطعم في النتائج (`"name"` | `"description"` | `"category"` | `"product"` | `"offer"`).
- `matching_items_count`: مجموع الوجبات والعروض المطابقة داخل هذا المطعم (مفيد لعرض شارة مثل `"4 أصناف مطابقة"`).

---

## 4. أمثلة الردود لكل الحالات الممكنة

### الحالة 1: البحث الشامل الافتراضي (`type=all`)

**Request:**

```http
GET /api/v1/search?q=شاورما
```

_(مكافئ لـ `GET /api/v1/search?q=شاورما&type=all&limit=10&open_only=false`)_

**Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Search results returned.",
  "data": {
    "query": "شاورما",
    "normalized_query": "شاورما",
    "type": "all",
    "counts": {
      "restaurants": 2,
      "products": 10,
      "offers": 6,
      "categories": 3
    },
    "restaurants": [
      {
        "rest_id": "2",
        "rest_title": "شاورما كرم الشام الاصلي",
        "rest_description": "شاورما سوري وفتة ومقبلات شامية",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
        "rest_address": "شارع السلطان حسين، الإسماعيلية",
        "longitude": "32.2723000",
        "latitude": "30.5965000",
        "opens_at": "11:00:00",
        "closes_at": "03:00:00",
        "is_open": true,
        "matched_in": ["name", "description", "category", "product", "offer"],
        "matching_items_count": 14
      }
    ],
    "products": [
      {
        "prod_id": "45",
        "cat_id": "12",
        "cat_title": "ساندوتشات الشاورما",
        "prod_name": "شاورما ماريا بالجبنة الموتزاريلا",
        "prod_description": "شاورما دجاج سوري مع جبنة موتزاريلا وثومية",
        "prod_image_url": "https://api.akeelaonline.tech/images/example-prod.webp",
        "price": "115.00",
        "rest_id": "2",
        "rest_title": "شاورما كرم الشام الاصلي",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
        "is_open": true
      }
    ],
    "offers": [
      {
        "offer_id": "18",
        "rest_id": "2",
        "offer_title": "وجبة الشاورما العربي الموفرة",
        "offer_description": "وجبة شاورما عربي + بطاطس + ثومية + مشروب",
        "initial_price": "190.00",
        "real_price": "149.00",
        "offer_image_url": "https://api.akeelaonline.tech/images/example-offer.webp",
        "starts_at": "2026-11-23T00:00:00.000Z",
        "expires_at": "2026-12-31T21:59:59.000Z",
        "rest_title": "شاورما كرم الشام الاصلي",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
        "is_open": true
      }
    ],
    "categories": [
      {
        "cat_id": "12",
        "cat_title": "ساندوتشات الشاورما",
        "display_order": 1,
        "rest_id": "2",
        "rest_title": "شاورما كرم الشام الاصلي",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
        "is_open": true
      }
    ]
  }
}
```

---

### الحالة 2: البحث في تبويب محدد (`type`)

عند تمرير `type` غير `all`، ينفّذ السيرفر استعلام القسم المحدد **فقط** لتحقيق أقصى سرعة، وتعود باقي الأقسام كمصفوفات فارغة `[]` وعداداتها `0`.

#### 2-أ: المطاعم فقط (`type=restaurants`)

**Request:**

```http
GET /api/v1/search?q=شاورما&type=restaurants&limit=15
```

**Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Search results returned.",
  "data": {
    "query": "شاورما",
    "normalized_query": "شاورما",
    "type": "restaurants",
    "counts": {
      "restaurants": 2,
      "products": 0,
      "offers": 0,
      "categories": 0
    },
    "restaurants": [
      {
        "rest_id": "2",
        "rest_title": "شاورما كرم الشام الاصلي",
        "rest_description": "شاورما سوري وفتة ومقبلات شامية",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
        "rest_address": "شارع السلطان حسين، الإسماعيلية",
        "longitude": "32.2723000",
        "latitude": "30.5965000",
        "opens_at": "11:00:00",
        "closes_at": "03:00:00",
        "is_open": true,
        "matched_in": ["name", "category", "product", "offer"],
        "matching_items_count": 14
      }
    ],
    "products": [],
    "offers": [],
    "categories": []
  }
}
```

#### 2-ب: الوجبات/المنتجات فقط (`type=products`)

**Request:**

```http
GET /api/v1/search?q=برجر&type=products&limit=20
```

**Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Search results returned.",
  "data": {
    "query": "برجر",
    "normalized_query": "برجر",
    "type": "products",
    "counts": {
      "restaurants": 0,
      "products": 8,
      "offers": 0,
      "categories": 0
    },
    "restaurants": [],
    "products": [
      {
        "prod_id": "71",
        "cat_id": "20",
        "cat_title": "برجر اللحم",
        "prod_name": "دبل بيف برجر بالجبنة الشيدر",
        "prod_description": "شريحتين برجر لحم مشوي مع جبنة شيدر وصوص خاص",
        "prod_image_url": "https://api.akeelaonline.tech/images/example-burger.webp",
        "price": "165.00",
        "rest_id": "4",
        "rest_title": "برجر هاوس",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest-4.webp",
        "is_open": true
      }
    ],
    "offers": [],
    "categories": []
  }
}
```

#### 2-ج: العروض السارية فقط (`type=offers`)

**Request:**

```http
GET /api/v1/search?q=عائلة&type=offers&limit=10
```

**Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Search results returned.",
  "data": {
    "query": "عائلة",
    "normalized_query": "عايله",
    "type": "offers",
    "counts": {
      "restaurants": 0,
      "products": 0,
      "offers": 3,
      "categories": 0
    },
    "restaurants": [],
    "products": [],
    "offers": [
      {
        "offer_id": "22",
        "rest_id": "3",
        "offer_title": "عرض عائلة الكشري الكبير",
        "offer_description": "4 أطباق كشري كبير + 4 طواجن + 4 حلو",
        "initial_price": "380.00",
        "real_price": "295.00",
        "offer_image_url": "https://api.akeelaonline.tech/images/example-koshary-offer.webp",
        "starts_at": "2026-11-23T00:00:00.000Z",
        "expires_at": "2026-12-31T21:59:59.000Z",
        "rest_title": "كشري الزعيم",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest-3.webp",
        "is_open": true
      }
    ],
    "categories": []
  }
}
```

#### 2-د: التصنيفات فقط (`type=categories`)

**Request:**

```http
GET /api/v1/search?q=مشويات&type=categories
```

**Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Search results returned.",
  "data": {
    "query": "مشويات",
    "normalized_query": "مشويات",
    "type": "categories",
    "counts": {
      "restaurants": 0,
      "products": 0,
      "offers": 0,
      "categories": 2
    },
    "restaurants": [],
    "products": [],
    "offers": [],
    "categories": [
      {
        "cat_id": "5",
        "cat_title": "المشويات على الفحم",
        "display_order": 1,
        "rest_id": "1",
        "rest_title": "مشويات الحاتي",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest-1.webp",
        "is_open": true
      }
    ]
  }
}
```

---

### الحالة 3: فلترة المطاعم المفتوحة الآن فقط (`open_only=true`)

تستبعد تلقائيًا أي مطعم مغلق في الوقت الحالي بتوقيت `Africa/Cairo` (وكذلك منتجاته وعروضه وتصنيفاته).

**Request:**

```http
GET /api/v1/search?q=شاورما&open_only=true
```

**Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Search results returned.",
  "data": {
    "query": "شاورما",
    "normalized_query": "شاورما",
    "type": "all",
    "counts": {
      "restaurants": 1,
      "products": 6,
      "offers": 4,
      "categories": 2
    },
    "restaurants": [
      {
        "rest_id": "2",
        "rest_title": "شاورما كرم الشام الاصلي",
        "rest_description": "شاورما سوري وفتة ومقبلات شامية",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
        "rest_address": "شارع السلطان حسين، الإسماعيلية",
        "longitude": "32.2723000",
        "latitude": "30.5965000",
        "opens_at": "11:00:00",
        "closes_at": "03:00:00",
        "is_open": true,
        "matched_in": ["name", "category", "product", "offer"],
        "matching_items_count": 10
      }
    ],
    "products": [],
    "offers": [],
    "categories": []
  }
}
```

---

### الحالة 4: البحث داخل منيو مطعم محدد (`rest_id`)

مفيد لشريط البحث الداخلي داخل شاشة المطعم بدون الحاجة لـ Endpoint منفصل.

**Request:**

```http
GET /api/v1/search?q=فراخ&rest_id=2&type=products&limit=25
```

**Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Search results returned.",
  "data": {
    "query": "فراخ",
    "normalized_query": "فراخ",
    "type": "products",
    "counts": {
      "restaurants": 0,
      "products": 3,
      "offers": 0,
      "categories": 0
    },
    "restaurants": [],
    "products": [
      {
        "prod_id": "46",
        "cat_id": "12",
        "cat_title": "ساندوتشات الشاورما",
        "prod_name": "شاورما فراخ سوري كبير",
        "prod_description": "شاورما دجاج في عيش سوري محمص",
        "prod_image_url": "https://api.akeelaonline.tech/images/example-chicken.webp",
        "price": "85.00",
        "rest_id": "2",
        "rest_title": "شاورما كرم الشام الاصلي",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
        "is_open": true
      }
    ],
    "offers": [],
    "categories": []
  }
}
```

---

### الحالة 5: الاقتطاع بـ `limit` مع الاحتفاظ بالعدد الكلي الدقيق (`counts`)

عند طلب `limit=1` مثلًا لمعاينة سريعة (`Autocomplete`)، تعود نتيجة واحدة في المصفوفة بينما تحتفظ `counts` بالعدد الإجمالي للمطابقات لعرض زر **«عرض الكل (10)»**.

**Request:**

```http
GET /api/v1/search?q=شاورما&limit=1
```

**Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Search results returned.",
  "data": {
    "query": "شاورما",
    "normalized_query": "شاورما",
    "type": "all",
    "counts": {
      "restaurants": 2,
      "products": 10,
      "offers": 6,
      "categories": 3
    },
    "restaurants": [
      {
        "rest_id": "2",
        "rest_title": "شاورما كرم الشام الاصلي",
        "rest_description": "شاورما سوري وفتة ومقبلات شامية",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
        "rest_address": "شارع السلطان حسين، الإسماعيلية",
        "longitude": "32.2723000",
        "latitude": "30.5965000",
        "opens_at": "11:00:00",
        "closes_at": "03:00:00",
        "is_open": true,
        "matched_in": ["name", "category", "product", "offer"],
        "matching_items_count": 14
      }
    ],
    "products": [
      {
        "prod_id": "45",
        "cat_id": "12",
        "cat_title": "ساندوتشات الشاورما",
        "prod_name": "شاورما ماريا بالجبنة الموتزاريلا",
        "prod_description": "شاورما دجاج سوري مع جبنة موتزاريلا وثومية",
        "prod_image_url": "https://api.akeelaonline.tech/images/example-prod.webp",
        "price": "115.00",
        "rest_id": "2",
        "rest_title": "شاورما كرم الشام الاصلي",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
        "is_open": true
      }
    ],
    "offers": [
      {
        "offer_id": "18",
        "rest_id": "2",
        "offer_title": "وجبة الشاورما العربي الموفرة",
        "offer_description": "وجبة شاورما عربي + بطاطس + ثومية + مشروب",
        "initial_price": "190.00",
        "real_price": "149.00",
        "offer_image_url": "https://api.akeelaonline.tech/images/example-offer.webp",
        "starts_at": "2026-11-23T00:00:00.000Z",
        "expires_at": "2026-12-31T21:59:59.000Z",
        "rest_title": "شاورما كرم الشام الاصلي",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
        "is_open": true
      }
    ],
    "categories": [
      {
        "cat_id": "12",
        "cat_title": "ساندوتشات الشاورما",
        "display_order": 1,
        "rest_id": "2",
        "rest_title": "شاورما كرم الشام الاصلي",
        "rest_image_url_mobile": "https://api.akeelaonline.tech/images/example-rest.webp",
        "is_open": true
      }
    ]
  }
}
```

---

### الحالة 6: تطبيع العربي، الكلمات غير المرتبة، والأخطاء الإملائية

تعمل جميعها تلقائيًا بدون أي باراميتر إضافي:

| مثال الاستدعاء   | `normalized_query` | كيف يطابق السيرفر                                                      |
| :--------------- | :----------------- | :--------------------------------------------------------------------- |
| `?q=اكيله`       | `اكيله`            | يطابق `أكيلة` / `إكيلة` / `أكيله` (توحيد الهمزات والتاء المربوطة)      |
| `?q=كشرى`        | `كشري`             | يطابق `كشري` (توحيد الألف المقصورة والياء)                             |
| `?q=مشويّات`      | `مشويات`           | يزيل التشكيل والتطويل (`ـ`) تلقائيًا                                    |
| `?q=سوري+شاورما` | `سوري شاورما`      | يطابق `وجبة شاورما فراخ سوري` بغض النظر عن ترتيب الكلمات (حتى 4 كلمات) |
| `?q=بتزا`        | `بتزا`             | يطابق `بيتزا` عبر `pg_trgm` `word_similarity` للكلمات من 4 حروف فأكثر  |

---

### الحالة 7: عدم وجود نتائج مطابقة (`Empty Results`)

عند عدم مطابقة أي سجل (أو عند إدخال حروف تشكيل/تطويل فقط مثل `?q=ـــ`) يرجع الرد `200 OK` بمصفوفات فارغة وعدادات `0` (وليس `404`):

**Request:**

```http
GET /api/v1/search?q=سوشي ياباني
```

**Response (`200 OK`):**

```json
{
  "success": true,
  "message": "Search results returned.",
  "data": {
    "query": "سوشي ياباني",
    "normalized_query": "سوشي ياباني",
    "type": "all",
    "counts": {
      "restaurants": 0,
      "products": 0,
      "offers": 0,
      "categories": 0
    },
    "restaurants": [],
    "products": [],
    "offers": [],
    "categories": []
  }
}
```

---

### الحالة 8: أخطاء التحقق من المدخلات (`422 VALIDATION_ERROR`)

> **قاعدة ثابتة للعميل:** اعتمد دائمًا على `HTTP Status` و`error.code` (وليس نص `message`).

#### 8-أ: عدم إرسال `q` أو إرسال مسافات فارغة فقط

**Request:**

```http
GET /api/v1/search
GET /api/v1/search?q=%20%20%20
```

**Response (`422 Unprocessable Entity`):**

```json
{
  "success": false,
  "message": "Please review the highlighted fields and try again.",
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "q": ["Search query must be between 1 and 100 characters."]
    }
  }
}
```

#### 8-ب: قيمة غير صالحة لـ `type`

**Request:**

```http
GET /api/v1/search?q=شاورما&type=meals
```

**Response (`422 Unprocessable Entity`):**

```json
{
  "success": false,
  "message": "Please review the highlighted fields and try again.",
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "type": [
        "type must be one of: all, restaurants, products, offers, categories."
      ]
    }
  }
}
```

#### 8-ج: `limit` خارج النطاق (`< 1` أو `> 50` أو غير رقمي)

**Request:**

```http
GET /api/v1/search?q=شاورما&limit=100
```

**Response (`422 Unprocessable Entity`):**

```json
{
  "success": false,
  "message": "Please review the highlighted fields and try again.",
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "limit": ["limit cannot exceed 50."]
    }
  }
}
```

#### 8-د: قيمة غير صالحة لـ `open_only`

**Request:**

```http
GET /api/v1/search?q=شاورما&open_only=yes
```

**Response (`422 Unprocessable Entity`):**

```json
{
  "success": false,
  "message": "Please review the highlighted fields and try again.",
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "open_only": ["open_only must be true or false."]
    }
  }
}
```

#### 8-هـ: قيمة غير صالحة لـ `rest_id`

**Request:**

```http
GET /api/v1/search?q=شاورما&rest_id=abc
```

**Response (`422 Unprocessable Entity`):**

```json
{
  "success": false,
  "message": "Please review the highlighted fields and try again.",
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "rest_id": ["rest_id must be a positive integer."]
    }
  }
}
```

#### 8-و: إرسال باراميتر غير معروف (Strict Whitelist)

الـ API يرفض أي `Query Parameter` غير معرّف في العقد:

**Request:**

```http
GET /api/v1/search?q=شاورما&sort=price
```

**Response (`422 Unprocessable Entity`):**

```json
{
  "success": false,
  "message": "Please review the highlighted fields and try again.",
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "sort": ["property sort should not exist"]
    }
  }
}
```

---

### الحالة 9: تجاوز حد الطلبات (`429`) أو خطأ خادم (`500`)

#### `429 Too Many Requests` (عند تجاوز 300 طلب/دقيقة لنفس الـ IP)

```json
{
  "success": false,
  "message": "Too many requests. Please wait a moment and try again.",
  "error": {
    "code": "RATE_LIMITED"
  }
}
```

#### `500 Internal Server Error`

```json
{
  "success": false,
  "message": "An unexpected error occurred.",
  "error": {
    "code": "INTERNAL_ERROR"
  }
}
```

---

## 5. قواعد الظهور والترتيب والأداء

1. **العزل الأمني وظهور البيانات:**
   - تظهر فقط المطاعم ذات `activation_status = 'Active'` و`is_active = true` ومالكها نشط ومؤكّد البريد الإلكتروني.
   - تظهر فقط التصنيفات النشطة (`categories.is_active = true`)، والمنتجات النشطة المرتبطة بتصنيف نشط، والعروض النشطة داخل نافذة البيع الحالية (`starts_at <= NOW() < expires_at`).
   - لا تُعرض أي بيانات حساسة للمالك أو حسابه.
2. **أولوية الترتيب (`Relevance Ranking`):**
   - التطابق التام في الاسم > بداية الاسم > احتواء الاسم > التشابه الإملائي (`word_similarity`) > تطابق التصنيف/الوصف.
   - المطاعم المفتوحة حاليًا (`is_open = true`) تحصل على دفعة أولوية إضافية.
   - في نتائج `restaurants`، المطعم الذي يطابق اسمه مباشرة يظهر أولًا، ثم المطاعم التي تحتوي على أكبر عدد من الأصناف والعروض المطابقة.
3. **الأداء على PostgreSQL:**
   - تعتمد على **7 فهارس GIN Trigram جزئية** (`ix_search_*_trgm`) مبنية على الدالة `normalize_search_text(TEXT)` للصفوف النشطة فقط.
   - كل طلب بحث يعمل داخل معاملة `READ ONLY` واحدة على اتصال واحد فقط من مجمع الاتصالات.

---

## 6. توصيات الربط لتطبيق الموبايل

1. **Debounce 300–400ms:** لا ترسل طلبًا مع كل حرف أثناء الكتابة السريعة؛ انتظر 300–400ms بعد توقف الكتابة.
2. **إلغاء الطلبات القديمة (`CancelToken` / `AbortController`):** إذا كتب المستخدم حرفًا جديدًا قبل وصول الرد السابق، ألغِ الطلب الأقدم حتى لا تظهر نتائج قديمة فوق الأحدث.
3. **ابدأ بـ `type=all&limit=10`** في شاشة البحث الرئيسية، واستخدم `counts` لعرض الأرقام على التبويبات (`المطاعم (2)` · `الوجبات (10)` · `العروض (6)`).
4. **عند الضغط على تبويب معيّن أو «عرض الكل»:** أرسل الطلب بنفس `q` مع `type=products&limit=30` مثلًا لتحميل نتائج القسم فقط بأسرع استجابة ممكنة.
5. **للانتقال عند الضغط على نتيجة:**
   - مطعم ← افتح شاشة المطعم باستخدام `rest_id`.
   - وجبة ← افتح تفاصيل الوجبة عبر `GET /api/v1/restaurants/{rest_id}/products/{prod_id}`.
   - عرض ← افتح تفاصيل العرض عبر `GET /api/v1/restaurants/{rest_id}/offers/{offer_id}`.
   - تصنيف ← افتح منيو المطعم مفلترًا على `GET /api/v1/restaurants/{rest_id}/products?cat_id={cat_id}`.
