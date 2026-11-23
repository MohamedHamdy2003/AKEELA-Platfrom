export function normalizeOtpDigits(value: string): string {
  const eastern = '٠١٢٣٤٥٦٧٨٩';
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  return value
    .replace(/[٠-٩]/g, (d) => String(eastern.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[^0-9]/g, '')
    .slice(0, 6);
}

const CODE_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'انتهت الجلسة. سجّل الدخول مجددًا.',
  FORBIDDEN: 'لا يملك حسابك صلاحية تنفيذ هذا الإجراء.',
  WRONG_ROLE: 'هذا الحساب غير مخصص لهذه اللوحة.',
  EMAIL_NOT_VERIFIED: 'أكّد بريدك الإلكتروني قبل تسجيل الدخول.',
  RESTAURANT_NOT_ACTIVE: 'إدارة المطعم غير متاحة حتى تفعيله من الإدارة.',
  DELIVERY_COMPANY_INACTIVE: 'حساب شركة التوصيل غير نشط حاليًا.',
  NOT_FOUND: 'العنصر غير موجود أو لم يعد متاحًا.',
  ORDER_CONFLICT: 'تغيّر الطلب أثناء التنفيذ. تم تحديث أحدث حالة.',
  CART_CONFLICT: 'تغيّرت السلة أثناء التنفيذ. حدّث السلة ثم حاول مجددًا.',
  CART_RESTAURANT_CONFLICT: 'أفرغ السلة قبل الطلب من مطعم آخر.',
  EMPTY_CART: 'السلة فارغة حاليًا.',
  RESTAURANT_CLOSED: 'المطعم مغلق حاليًا خارج مواعيد العمل.',
  UNAVAILABLE: 'بعض العناصر أو الخدمات غير متاحة حاليًا.',
  DELIVERY_COMPANY_UNAVAILABLE:
    'تعذّر قبول الطلب لعدم توفر شركة التوصيل. ما زال الطلب بانتظار القبول.',
  DRIVER_REQUIRED: 'أسند سائقًا نشطًا للطلب أولًا قبل المتابعة.',
  DRIVER_UNAVAILABLE:
    'السائق المحدد غير نشط أو غير متاح حاليًا. اختر سائقًا نشطًا آخر.',
  VALIDATION_ERROR: 'راجع الحقول الموضحة ثم حاول مجددًا.',
  IMAGE_TOO_LARGE: 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت.',
  PAYLOAD_TOO_LARGE: 'حجم البيانات المرسلة أكبر من الحد المسموح.',
  INVALID_IMAGE:
    'استخدم صورة صالحة غير متحركة بصيغة JPEG أو PNG أو WebP بحد أقصى 16 ميجابكسل.',
  RATE_LIMITED: 'محاولات كثيرة. انتظر قليلًا قبل المحاولة مجددًا.',
  OTP_INVALID_OR_EXPIRED: 'الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.',
  NETWORK: 'تعذّر الاتصال بالخدمة. تحقق من الاتصال ثم أعد المحاولة.',
};

function translateConflictMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('email or phone already exists')) {
    return 'البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل.';
  }
  if (lower.includes('cannot delete category') && lower.includes('product')) {
    return 'لا يمكن مسح التصنيف قبل نقل أو فك ربط جميع المنتجات بداخله.';
  }
  if (
    lower.includes('category') &&
    (lower.includes('already exists') || lower.includes('duplicate'))
  ) {
    return 'يوجد تصنيف آخر بهذا الاسم بالفعل.';
  }
  if (lower.includes('cannot delete product') && lower.includes('linked')) {
    return 'لا يمكن مسح منتج مربوط بتصنيف. فك ربطه أولاً ثم أعد المحاولة.';
  }
  if (lower.includes('cannot delete addon') && lower.includes('linked')) {
    return 'لا يمكن مسح الإضافة أثناء ربطها بمنتجات. فك ربطها من جميع المنتجات أولاً.';
  }
  if (lower.includes('admin') && lower.includes('already exists')) {
    return 'يوجد حساب إدارة بالفعل على المنصة.';
  }
  if (
    (lower.includes('admin') || lower.includes('delivery')) &&
    (lower.includes('disable') ||
      lower.includes('inactive') ||
      lower.includes('deactivate'))
  ) {
    return 'لا يمكن تعطيل حساب الإدارة أو شركة التوصيل.';
  }
  if (
    lower.includes('order status') ||
    lower.includes('pending orders') ||
    lower.includes('transition')
  ) {
    return 'لا يمكن تنفيذ هذا الإجراء على الطلب في حالته الحالية. حدّث الصفحة ثم راجع الحالة.';
  }
  return 'تعذّر الحفظ بسبب بيانات مكررة أو تغيّر الحالة. راجع البيانات وحدّث الصفحة.';
}

export function formatApiErrorMessage(
  code: string,
  rawMessage: string,
  retryAfter = 0,
): string {
  if (code === 'CONFLICT') {
    return translateConflictMessage(rawMessage);
  }
  if (code === 'RATE_LIMITED' && retryAfter > 0) {
    return `محاولات كثيرة. انتظر ${retryAfter} ثانية ثم أعد المحاولة.`;
  }
  if (CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code]!;
  }
  if (/\p{Script=Arabic}/u.test(rawMessage)) {
    return rawMessage;
  }
  return 'تعذّر إتمام الطلب. حاول مجددًا.';
}

const FIELD_LABELS: Record<string, string> = {
  full_name: 'الاسم الكامل',
  email: 'البريد الإلكتروني',
  phone: 'رقم الهاتف',
  password: 'كلمة المرور',
  current_password: 'كلمة المرور الحالية',
  new_password: 'كلمة المرور الجديدة',
  otp: 'رمز التحقق',
  cat_id: 'التصنيف',
  cat_title: 'اسم التصنيف',
  display_order: 'ترتيب العرض',
  prod_name: 'اسم المنتج',
  prod_description: 'وصف المنتج',
  price: 'السعر',
  addon_name: 'اسم الإضافة',
  addon_price: 'سعر الإضافة',
  offer_title: 'اسم العرض',
  offer_description: 'وصف العرض',
  initial_price: 'السعر الأصلي',
  real_price: 'سعر العرض',
  starts_at: 'بداية العرض',
  expires_at: 'نهاية العرض',
  is_active: 'الحالة',
  rest_title: 'اسم المطعم',
  rest_description: 'وصف المطعم',
  rest_address: 'عنوان المطعم',
  longitude: 'خط الطول',
  latitude: 'خط العرض',
  opens_at: 'وقت الفتح',
  closes_at: 'وقت الإغلاق',
  company_name: 'اسم الشركة',
  company_phone: 'هاتف الشركة',
  company_email: 'بريد الشركة',
  company_address: 'عنوان الشركة',
  driver_name: 'اسم السائق',
  driver_phone: 'هاتف السائق',
  driver_email: 'بريد السائق',
  driver_id: 'السائق',
  date_from: 'من تاريخ',
  date_to: 'إلى تاريخ',
};

export function translateFieldLabel(field: string): string {
  const clean = field.replace(/^profile\./, '');
  return FIELD_LABELS[clean] ?? FIELD_LABELS[field] ?? field;
}

export function translateFieldReason(field: string, reason: string): string {
  if (/\p{Script=Arabic}/u.test(reason)) return reason;
  const lower = reason.toLowerCase();
  const clean = field.replace(/^profile\./, '');
  if (lower.includes('not allowed')) return 'هذا الحقل غير مسموح به.';
  if (lower.includes('must differ from opens_at')) {
    return 'يجب أن يختلف وقت الإغلاق عن وقت الفتح.';
  }
  if (lower.includes('less than or equal to the initial price')) {
    return 'يجب ألا يتجاوز سعر العرض السعر الأصلي.';
  }
  if (lower.includes('earlier than today')) {
    return 'بداية العرض لا يمكن أن تكون في تاريخ سابق لليوم.';
  }
  if (
    lower.includes('after the start time') ||
    lower.includes('on or after the start date')
  ) {
    return 'نهاية العرض يجب أن تكون في نفس يوم البداية أو بعده.';
  }
  if (lower.includes('cannot activate an expired offer')) {
    return 'لا يمكن تفعيل عرض منتهي الصلاحية. مدّد تاريخ نهاية العرض أولاً.';
  }
  if (lower.includes('assign a category before activating')) {
    return 'اربط المنتج بتصنيف أولاً قبل تفعيله.';
  }
  if (lower.includes('link this addon to at least one product')) {
    return 'اربط الإضافة بمنتج واحد على الأقل قبل تفعيلها.';
  }
  if (clean.includes('password')) {
    return 'استخدم كلمة مرور من 8 إلى 128 حرفًا تتضمن حرفًا ورقمًا.';
  }
  if (clean.includes('email')) {
    return 'أدخل بريدًا إلكترونيًا صحيحًا.';
  }
  if (clean.includes('phone')) {
    return 'أدخل رقم هاتف يبدأ بـ + ورمز الدولة (8–15 رقمًا).';
  }
  if (clean === 'otp') {
    return 'أدخل رمز تحقق مكونًا من 6 أرقام.';
  }
  if (clean.includes('price')) {
    return 'أدخل سعرًا صحيحًا بصيغة رقمية (حتى منزلتين عشريتين).';
  }
  if (clean === 'opens_at' || clean === 'closes_at') {
    return 'أدخل وقتًا صحيحًا بنظام 24 ساعة.';
  }
  if (clean === 'longitude' || clean === 'latitude') {
    return 'أدخل إحداثيات جغرافية صحيحة.';
  }
  if (clean === 'display_order') {
    return 'اختر ترتيب عرض صحيحًا.';
  }
  return 'راجع القيمة المدخلة في هذا الحقل.';
}

export function decodeJwtExpiryMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
