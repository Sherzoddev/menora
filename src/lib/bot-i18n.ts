// Text for the Telegram bot — both the customer side (BOT_TEXT) and the
// staff/owner side (STAFF_TEXT). Not the website's own i18n (menu-view.tsx's
// DICT is separate).
export type BotLang = "ru" | "uz";

export function resolveBotLang(value: string | null | undefined): BotLang {
  return value === "uz" ? "uz" : "ru";
}

export const LANGUAGE_NAMES: Record<BotLang, string> = {
  ru: "🇷🇺 Русский",
  uz: "🇺🇿 O'zbek",
};

export const FEEDBACK_TAG_KEYS = ["food", "delivery", "packaging", "service", "other"] as const;
export type FeedbackTagKey = (typeof FEEDBACK_TAG_KEYS)[number];

// Whatever language the customer picked a tag in, the *stored* label is
// always Russian — the owner's Reviews page is Russian-only, and mixing
// scripts there would be confusing to read at a glance.
export const FEEDBACK_TAG_STORED_LABEL: Record<FeedbackTagKey, string> = {
  food: "Еда",
  delivery: "Доставка",
  packaging: "Упаковка",
  service: "Обслуживание",
  other: "Другое",
};

const FEEDBACK_TAG_DISPLAY: Record<BotLang, Record<FeedbackTagKey, string>> = {
  ru: FEEDBACK_TAG_STORED_LABEL,
  uz: {
    food: "Taom",
    delivery: "Yetkazib berish",
    packaging: "Qadoqlash",
    service: "Xizmat",
    other: "Boshqa",
  },
};

export function feedbackTagLabel(lang: BotLang, key: FeedbackTagKey): string {
  return FEEDBACK_TAG_DISPLAY[lang][key];
}

export const BOT_TEXT: Record<
  BotLang,
  {
    labels: { menu: string; orders: string; bonuses: string; contacts: string; language: string };
    welcomeLine: (venueName: string) => string;
    menuHint: string;
    tableLine: (n: string) => string;
    todayHours: (range: string) => string;
    waitingForYou: (venueName: string) => string;
    noOrders: string;
    ordersHeader: string;
    status: { new: string; preparing: string; ready: string; sent: string };
    trackerHeader: (venueName: string, orderNumber: number) => string;
    trackerCourierNote: string;
    trackerButton: string;
    noBonusPhone: string;
    bonusPoints: (n: number) => string;
    noBonusPoints: string;
    contactsHeader: (venueName: string) => string;
    openMap: string;
    noContacts: string;
    ratingThanksPrefix: string;
    alreadyRated: string;
    ratingSaveFail: string;
    feedbackPrompt: string;
    tagThanks: string;
    chooseLanguage: string;
    languageSaved: (langName: string) => string;
  }
> = {
  ru: {
    labels: { menu: "🍽 Меню", orders: "📦 Мои заказы", bonuses: "🎁 Бонусы", contacts: "📍 Контакты", language: "🌐 Язык" },
    welcomeLine: (name) => `👋 Добро пожаловать в <b>${name}</b>!`,
    menuHint: "Жмите «🍽 Меню» внизу, чтобы сделать заказ.",
    tableLine: (n) => `🍽 Стол №${n}`,
    todayHours: (range) => `Сегодня: ${range}`,
    waitingForYou: (name) => `«${name}» ждёт вас 🍽`,
    noOrders: "У вас пока нет заказов через этот бот — самое время это исправить 🍽",
    ordersHeader: "📦 <b>Ваши последние заказы</b>",
    status: { new: "📝 Принят", preparing: "🍳 Готовится", ready: "✅ Готов", sent: "🛵 Отправлен" },
    trackerHeader: (name, n) => `📦 <b>Заказ №${n}</b> в «${name}»`,
    trackerCourierNote: "🛵 Курьер такси уже в пути — обычно доставка занимает около 30 минут",
    trackerButton: "🔎 Смотреть онлайн",
    noBonusPhone: "Пока нет данных о бонусах — оформите заказ через меню, и баллы появятся здесь 🎁",
    bonusPoints: (n) => `🎁 У вас <b>${n}</b> бонусных баллов — спишите их при следующем заказе.`,
    noBonusPoints: "Пока нет накопленных баллов — они начисляются автоматически после заказа.",
    contactsHeader: (name) => `📍 <b>${name}</b>`,
    openMap: "Открыть на карте",
    noContacts: "Заведение пока не указало адрес и телефон.",
    ratingThanksPrefix: "Спасибо за оценку:",
    alreadyRated: "Вы уже оценили этот заказ ❤️",
    ratingSaveFail: "Не получилось сохранить оценку",
    feedbackPrompt: "Спасибо за оценку. Что нам улучшить?",
    tagThanks: "Спасибо, учтём! ❤️",
    chooseLanguage: "🌐 Выберите язык:",
    languageSaved: (langName) => `Готово! Язык переключён на ${langName} ✅`,
  },
  uz: {
    labels: { menu: "🍽 Menyu", orders: "📦 Buyurtmalarim", bonuses: "🎁 Bonuslar", contacts: "📍 Kontaktlar", language: "🌐 Til" },
    welcomeLine: (name) => `👋 <b>${name}</b>ga xush kelibsiz!`,
    menuHint: "Buyurtma berish uchun pastdagi «🍽 Menyu» tugmasini bosing.",
    tableLine: (n) => `🍽 Stol №${n}`,
    todayHours: (range) => `Bugun: ${range}`,
    waitingForYou: (name) => `«${name}» sizni kutmoqda 🍽`,
    noOrders: "Hali bu bot orqali buyurtmalaringiz yo'q — buni tuzatish vaqti keldi 🍽",
    ordersHeader: "📦 <b>Sizning oxirgi buyurtmalaringiz</b>",
    status: { new: "📝 Qabul qilindi", preparing: "🍳 Tayyorlanmoqda", ready: "✅ Tayyor", sent: "🛵 Yuborildi" },
    trackerHeader: (name, n) => `📦 <b>№${n}-buyurtma</b> — «${name}»`,
    trackerCourierNote: "🛵 Taksi kuryeri allaqachon yo'lda — yetkazish odatda taxminan 30 daqiqa davom etadi",
    trackerButton: "🔎 Onlayn ko'rish",
    noBonusPhone: "Bonuslar haqida ma'lumot yo'q — menyu orqali buyurtma bering, ballar shu yerda paydo bo'ladi 🎁",
    bonusPoints: (n) => `🎁 Sizda <b>${n}</b> bonus ball bor — keyingi buyurtmada ishlating.`,
    noBonusPoints: "Hali to'plangan ball yo'q — ular buyurtmadan so'ng avtomatik hisoblanadi.",
    contactsHeader: (name) => `📍 <b>${name}</b>`,
    openMap: "Xaritada ochish",
    noContacts: "Muassasa hali manzil va telefon ko'rsatmagan.",
    ratingThanksPrefix: "Baho uchun rahmat:",
    alreadyRated: "Siz bu buyurtmani allaqachon baholagansiz ❤️",
    ratingSaveFail: "Bahoni saqlab bo'lmadi",
    feedbackPrompt: "Baho uchun rahmat. Nimani yaxshilashimiz kerak?",
    tagThanks: "Rahmat, hisobga olamiz! ❤️",
    chooseLanguage: "🌐 Tilni tanlang:",
    languageSaved: (langName) => `Tayyor! Til ${langName}ga o'zgartirildi ✅`,
  },
};

// "1 заказ" vs "2 заказа" — Uzbek doesn't inflect the noun for count, so
// this only branches for Russian.
export function orderWord(lang: BotLang, count: number): string {
  return lang === "uz" ? "buyurtma" : count === 1 ? "заказ" : "заказа";
}

export const STAFF_TEXT: Record<
  BotLang,
  {
    labels: { tables: string; delivery: string; prices: string; stats: string; cabinet: string; invite: string; radius: string; language: string };
    connected: (venueName: string) => string;
    menuOpenedBelow: string;
    fallbackUseButtons: (venueName: string) => string;
    chooseLanguage: string;
    languageSaved: (langName: string) => string;
    tables: {
      chooseTable: string;
      noActive: string;
      headerWithCount: (activeCount: number) => string;
      summaryLine: (n: string, count: number, totalLabel: string) => string;
      tableHeader: (n: string, count: number, totalLabel: string) => string;
      noOrdersAtTable: (n: string) => string;
      doneButton: (priceLabel: string) => string;
      doneSimple: string;
      cancelButton: string;
      backButton: string;
    };
    doneToast: string;
    doneAppended: string;
    cancelToast: string;
    cancelAppended: string;
    stages: {
      new: string;
      preparing: string;
      ready: string;
      sent: string;
      startCookingButton: string;
      readyButton: string;
      sentButton: string;
      startCookingToast: string;
      readyToast: string;
      sentToast: string;
      appended: (label: string) => string;
    };
    delivery: {
      header: (count: number) => string;
      noOrders: string;
    };
    order: {
      orderedAt: string;
      total: string;
      name: string;
      phone: string;
      address: string;
      comment: string;
      routeGoogle: string;
      routeYandex: string;
    };
    stats: { header: string; orders: string; revenue: string; avgCheck: string };
    prices: {
      chooseCategory: string;
      noCategories: string;
      chooseDish: string;
      noDishesInCategory: string;
      editPrompt: (dishName: string, currentPriceLabel: string) => string;
      invalidPrice: string;
      dishNotFoundForEdit: string;
      dishNotFoundToast: string;
      updated: (dishName: string, newPriceLabel: string) => string;
    };
    lowRatingAlert: (stars: string, customerName: string, phonePart: string, orderShortId: string) => string;
    tagAlert: (orderShortId: string, tag: string) => string;
    waiterCallAlert: (table: string | null) => string;
    inviteCode: (code: string) => string;
    radius: {
      askLocation: string;
      locationSaved: string;
      chooseRadius: (currentKm: number | null) => string;
      unlimitedLabel: string;
      relocateButton: string;
      customButton: string;
      customPrompt: string;
      customInvalid: string;
      radiusSaved: (km: number | null) => string;
      needLocationFirst: string;
    };
  }
> = {
  ru: {
    labels: { tables: "🍽 Столы", delivery: "🚚 Доставка", prices: "💰 Цены", stats: "📊 Статистика", cabinet: "🖥 Кабинет", invite: "➕ Добавить сотрудника", radius: "📍 Радиус доставки", language: "🌐 Язык" },
    connected: (name) => `✅ Подключено к заведению «${name}». Новые заказы будут приходить сюда.\n\nИспользуйте кнопки внизу 👇`,
    menuOpenedBelow: "Меню открыто внизу 👇",
    fallbackUseButtons: (name) => `Меню «${name}» — используйте кнопки внизу 👇`,
    chooseLanguage: "🌐 Выберите язык интерфейса:",
    languageSaved: (langName) => `Готово! Язык переключён на ${langName} ✅`,
    tables: {
      chooseTable: "Выберите стол:",
      noActive: "Активных заказов нет.",
      headerWithCount: (n) => `🍽 <b>Столы</b> (${n} активных)`,
      summaryLine: (n, count, totalLabel) => `🟢 Стол ${n} — ${count} ${orderWord("ru", count)}, ${totalLabel}`,
      tableHeader: (n, count, totalLabel) => `🍽 <b>Стол №${n}</b> — ${count} ${orderWord("ru", count)}, итого ${totalLabel}`,
      noOrdersAtTable: (n) => `🍽 Стол №${n}\n\nЗаказов нет.`,
      doneButton: (priceLabel) => `✅ Готово (${priceLabel})`,
      doneSimple: "✅ Готово",
      cancelButton: "❌ Отменить",
      backButton: "◀ Назад",
    },
    doneToast: "Отмечено выполненным ✅",
    doneAppended: "✅ Выполнено",
    cancelToast: "Заказ отменён",
    cancelAppended: "❌ Отменено",
    stages: {
      new: "📝 Принят",
      preparing: "🍳 Готовится",
      ready: "✅ Готов",
      sent: "🛵 Отправлен",
      startCookingButton: "🍳 Начать готовить",
      readyButton: "✅ Готово",
      sentButton: "🛵 Отправить",
      startCookingToast: "Начали готовить 🍳",
      readyToast: "Отмечено готовым ✅",
      sentToast: "Отмечено отправленным 🛵",
      appended: (label) => `${label}`,
    },
    delivery: {
      header: (count) => `🚚 Доставка (${count})`,
      noOrders: "🚚 Доставка\n\nЗаказов нет.",
    },
    order: {
      orderedAt: "Заказано в",
      total: "Итого",
      name: "Имя",
      phone: "Телефон",
      address: "Адрес",
      comment: "Комментарий",
      routeGoogle: "🗺 Маршрут (Google)",
      routeYandex: "🗺 Маршрут (Яндекс)",
    },
    stats: { header: "📊 <b>Статистика за сегодня</b>", orders: "Заказов", revenue: "Выручка", avgCheck: "Средний чек" },
    prices: {
      chooseCategory: "💰 Выберите категорию:",
      noCategories: "В меню пока нет категорий.",
      chooseDish: "Выберите блюдо, чтобы изменить цену:",
      noDishesInCategory: "В этой категории пока нет блюд.",
      editPrompt: (name, price) => `Введите новую цену для «${name}». Сейчас: ${price}`,
      invalidPrice: "Некорректная цена — отправьте число, например 29000.",
      dishNotFoundForEdit: "Не удалось найти это блюдо — возможно, оно было удалено.",
      dishNotFoundToast: "Блюдо не найдено",
      updated: (name, price) => `✅ Цена «${name}» обновлена: ${price}`,
    },
    lowRatingAlert: (stars, name, phonePart, orderShortId) =>
      `⚠️ Низкая оценка ${stars} от ${name}${phonePart}\nЗаказ №${orderShortId}`,
    tagAlert: (orderShortId, tag) => `📝 Причина низкой оценки (заказ №${orderShortId}): ${tag}`,
    waiterCallAlert: (table) => `🔔 Гость${table ? ` (стол №${table})` : ""} просит официанта`,
    inviteCode: (code) =>
      `➕ Фраза для нового сотрудника: <code>${code}</code>\n\nПередайте её человеку — пусть напишет её этому же боту (просто текстом). Он сам получит доступ к этому меню: заказы, статистика, цены.`,
    radius: {
      askLocation: "📍 Сначала пришлите геолокацию заведения — нажмите на скрепку 📎 в Telegram → «Геопозиция» и отправьте её сюда.",
      locationSaved: "✅ Локация заведения сохранена.",
      chooseRadius: (km) =>
        `📍 Выберите радиус доставки${km != null ? ` (сейчас: ${km} км)` : ""}. Гостям дальше этого расстояния сайт покажет, что доставка недоступна.`,
      unlimitedLabel: "Без ограничений",
      relocateButton: "📍 Обновить локацию заведения",
      customButton: "✏️ Своё число км",
      customPrompt: "Введите радиус доставки в км (например: 7 или 12.5) — просто отправьте число сообщением.",
      customInvalid: "Не похоже на число км. Введите, например: 7",
      radiusSaved: (km) => (km == null ? "✅ Ограничение по радиусу снято." : `✅ Радиус доставки: ${km} км.`),
      needLocationFirst: "Сначала пришлите геолокацию заведения (см. выше).",
    },
  },
  uz: {
    labels: { tables: "🍽 Stollar", delivery: "🚚 Yetkazish", prices: "💰 Narxlar", stats: "📊 Statistika", cabinet: "🖥 Kabinet", invite: "➕ Xodim qo'shish", radius: "📍 Yetkazish radiusi", language: "🌐 Til" },
    connected: (name) => `✅ «${name}» muassasasiga ulandingiz. Yangi buyurtmalar shu yerga keladi.\n\nPastdagi tugmalardan foydalaning 👇`,
    menuOpenedBelow: "Menyu pastda ochiq 👇",
    fallbackUseButtons: (name) => `«${name}» menyusi — pastdagi tugmalardan foydalaning 👇`,
    chooseLanguage: "🌐 Interfeys tilini tanlang:",
    languageSaved: (langName) => `Tayyor! Til ${langName}ga o'zgartirildi ✅`,
    tables: {
      chooseTable: "Stolni tanlang:",
      noActive: "Faol buyurtmalar yo'q.",
      headerWithCount: (n) => `🍽 <b>Stollar</b> (${n} ta faol)`,
      summaryLine: (n, count, totalLabel) => `🟢 Stol ${n} — ${count} ${orderWord("uz", count)}, ${totalLabel}`,
      tableHeader: (n, count, totalLabel) => `🍽 <b>Stol №${n}</b> — ${count} ${orderWord("uz", count)}, jami ${totalLabel}`,
      noOrdersAtTable: (n) => `🍽 Stol №${n}\n\nBuyurtmalar yo'q.`,
      doneButton: (priceLabel) => `✅ Tayyor (${priceLabel})`,
      doneSimple: "✅ Tayyor",
      cancelButton: "❌ Bekor qilish",
      backButton: "◀ Orqaga",
    },
    doneToast: "Tayyor deb belgilandi ✅",
    doneAppended: "✅ Bajarildi",
    cancelToast: "Buyurtma bekor qilindi",
    cancelAppended: "❌ Bekor qilindi",
    stages: {
      new: "📝 Qabul qilindi",
      preparing: "🍳 Tayyorlanmoqda",
      ready: "✅ Tayyor",
      sent: "🛵 Yuborildi",
      startCookingButton: "🍳 Tayyorlashni boshlash",
      readyButton: "✅ Tayyor",
      sentButton: "🛵 Yuborish",
      startCookingToast: "Tayyorlash boshlandi 🍳",
      readyToast: "Tayyor deb belgilandi ✅",
      sentToast: "Yuborildi deb belgilandi 🛵",
      appended: (label) => `${label}`,
    },
    delivery: {
      header: (count) => `🚚 Yetkazish (${count})`,
      noOrders: "🚚 Yetkazish\n\nBuyurtmalar yo'q.",
    },
    order: {
      orderedAt: "Buyurtma vaqti",
      total: "Jami",
      name: "Ism",
      phone: "Telefon",
      address: "Manzil",
      comment: "Izoh",
      routeGoogle: "🗺 Marshrut (Google)",
      routeYandex: "🗺 Marshrut (Yandex)",
    },
    stats: { header: "📊 <b>Bugungi statistika</b>", orders: "Buyurtmalar", revenue: "Tushum", avgCheck: "O'rtacha chek" },
    prices: {
      chooseCategory: "💰 Kategoriyani tanlang:",
      noCategories: "Menyuda hali kategoriyalar yo'q.",
      chooseDish: "Narxini o'zgartirish uchun taomni tanlang:",
      noDishesInCategory: "Bu kategoriyada hali taomlar yo'q.",
      editPrompt: (name, price) => `«${name}» uchun yangi narxni kiriting. Hozir: ${price}`,
      invalidPrice: "Noto'g'ri narx — raqam yuboring, masalan 29000.",
      dishNotFoundForEdit: "Bu taom topilmadi — ehtimol, u o'chirilgan.",
      dishNotFoundToast: "Taom topilmadi",
      updated: (name, price) => `✅ «${name}» narxi yangilandi: ${price}`,
    },
    lowRatingAlert: (stars, name, phonePart, orderShortId) =>
      `⚠️ Past baho ${stars} — ${name}${phonePart}\nBuyurtma №${orderShortId}`,
    tagAlert: (orderShortId, tag) => `📝 Past bahoning sababi (buyurtma №${orderShortId}): ${tag}`,
    waiterCallAlert: (table) => `🔔 Mehmon${table ? ` (stol №${table})` : ""} ofitsiantni chaqirmoqda`,
    inviteCode: (code) =>
      `➕ Yangi xodim uchun ibora: <code>${code}</code>\n\nUni odamga bering — u shu botga matn qilib yuborsin. Shu menyu unga ham ochiladi: buyurtmalar, statistika, narxlar.`,
    radius: {
      askLocation: "📍 Avval muassasa geolokatsiyasini yuboring — Telegram'da skrepka 📎 → «Joylashuv» va shu yerga yuboring.",
      locationSaved: "✅ Muassasa lokatsiyasi saqlandi.",
      chooseRadius: (km) =>
        `📍 Yetkazish radiusini tanlang${km != null ? ` (hozir: ${km} km)` : ""}. Bu masofadan uzoqroq mehmonlarga sayt yetkazish mavjud emasligini ko'rsatadi.`,
      unlimitedLabel: "Cheklovsiz",
      relocateButton: "📍 Muassasa lokatsiyasini yangilash",
      customButton: "✏️ O'z raqamingiz (km)",
      customPrompt: "Yetkazish radiusini km da kiriting (masalan: 7 yoki 12.5) — shunchaki raqam yuboring.",
      customInvalid: "Bu km soniga o'xshamaydi. Masalan: 7 deb kiriting",
      radiusSaved: (km) => (km == null ? "✅ Radius bo'yicha cheklov olib tashlandi." : `✅ Yetkazish radiusi: ${km} km.`),
      needLocationFirst: "Avval muassasa geolokatsiyasini yuboring (yuqoriga qarang).",
    },
  },
};
