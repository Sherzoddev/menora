// Весь текстовый контент лендинга собран здесь для удобного редактирования.
// Двуязычный: RU и UZ (латиница).

export type Lang = "ru" | "uz";

export const demoSlug = "magicstreet550";

const ru = {
  hero: {
    eyebrow: "Цифровые меню для кафе и ресторанов",
    title: "Меню, которое гости открывают за 2 секунды",
    subtitle:
      "Menora превращает бумажное меню в красивую мобильную страницу, QR-код и экран для телевизора — без приложений и установок для гостей.",
    ctaPrimary: "Оставить заявку",
    ctaSecondary: "Открыть живое меню",
  },
  stats: [
    { value: "2 сек", label: "Открывается меню" },
    { value: "0", label: "Приложений ставить не нужно" },
    { value: "24/7", label: "Обновляйте меню сами" },
  ],
  audience: [
    { title: "Кафе", desc: "Уютное меню в фирменных цветах заведения" },
    { title: "Рестораны", desc: "Категории, фото блюд, описания и языки" },
    { title: "Кофейни", desc: "Быстрое меню напитков и десертов" },
    { title: "Fast food", desc: "Простое меню с ценами и акциями" },
  ],
  steps: [
    { title: "Оставляете заявку", desc: "Пишете нам название заведения и контакты — мы свяжемся и всё настроим." },
    { title: "Мы создаём меню", desc: "Добавляем категории, блюда, фото и цены вместе с вами." },
    { title: "Вы получаете доступ", desc: "Личный кабинет для самостоятельного обновления меню и готовый QR-код." },
    { title: "Гости сканируют QR", desc: "Открывается быстрое мобильное меню — без установки приложений." },
  ],
  features: [
    { title: "Мобильное меню", desc: "Современный дизайн, быстрая загрузка, адаптация под любой телефон" },
    { title: "QR-коды", desc: "Готовые варианты для стола, стойки, двери и печати — PNG/SVG/PDF" },
    { title: "TV-меню", desc: "Отдельный экран для телевизора с автоматической сменой категорий" },
    { title: "Личный кабинет", desc: "Вы сами меняете цены, фото и описания — изменения видны сразу" },
    { title: "Заказы в Telegram", desc: "Новый заказ с сайта сразу приходит вам в Telegram-бот" },
    { title: "Аналитика", desc: "Просмотры меню и сканирования QR-кода по каждому заведению" },
    { title: "Русский и узбекский", desc: "Гость сам переключает язык меню" },
    { title: "Без комиссий", desc: "Мы не берём процент с ваших заказов" },
  ],
  comparison: {
    title: "Почему не бумажное меню",
    items: [
      { old: "Печать новой версии при каждом изменении цены", new: "Меняете цену в кабинете — видно сразу всем" },
      { old: "Меню изнашивается, теряется, пачкается", new: "Всегда чистое, всегда актуальное" },
      { old: "Нет фото блюд, гость выбирает вслепую", new: "Фото каждого блюда — выбор проще и приятнее" },
      { old: "Официант тратит время на пересказ акций", new: "Акции и новинки видно сразу в меню" },
    ],
  },
  pricing: {
    setupPrice: "$100",
    setupLabel: "разово при подключении",
    monthlyPrice: "$10",
    monthlyLabel: "в месяц далее",
    description: "Одна прозрачная цена. Без скрытых платежей и без процента с ваших заказов.",
    items: [
      "Мобильное меню в цветах вашего заведения",
      "Короткая ссылка и QR-код для стола/двери/стойки",
      "TV-меню для экрана в зале",
      "Личный кабинет — сами меняете меню когда угодно",
      "Приём заказов с уведомлением в Telegram",
      "Аналитика просмотров и сканирований",
      "Меню на русском и узбекском языках",
      "Помощь с наполнением меню при подключении",
    ],
  },
  faq: [
    {
      q: "Это подписка?",
      a: "При подключении — разовый платёж $100, он покрывает настройку и внедрение. Дальше $10 в месяц — хостинг, обновления и поддержка. Отменить можно в любой момент.",
    },
    {
      q: "Нужно ли гостям скачивать приложение?",
      a: "Нет. Гость сканирует QR-код или переходит по ссылке — меню открывается прямо в браузере телефона.",
    },
    {
      q: "Сколько времени занимает подключение?",
      a: "Обычно 1–2 дня: вы присылаете название, фото и позиции меню — мы всё настраиваем и выдаём доступ.",
    },
    {
      q: "Могу ли я сам менять цены и блюда потом?",
      a: "Да, в личном кабинете можно менять категории, блюда, фото, цены и режим работы в любой момент.",
    },
  ],
  nav: { features: "Возможности", pricing: "Тариф", faq: "Вопросы", contact: "Контакты" },
  contact: {
    heading: "Готовы подключить своё заведение?",
    subheading: "Напишите нам — расскажем, как это работает, и настроим меню вместе с вами.",
    telegram: "https://t.me/+998500068296",
    telegramLabel: "Написать в Telegram",
    phone: "+998 50 006 82 96",
  },
  footer: "Menora — цифровые меню для кафе и ресторанов",
};

const uz: typeof ru = {
  hero: {
    eyebrow: "Kafe va restoranlar uchun raqamli menyular",
    title: "Mehmonlar 2 soniyada ochadigan menyu",
    subtitle:
      "Menora qog'oz menyuni chiroyli mobil sahifaga, QR-kodga va televizor ekraniga aylantiradi — mehmonlar uchun ilova o'rnatish shart emas.",
    ctaPrimary: "Ariza qoldirish",
    ctaSecondary: "Jonli menyuni ochish",
  },
  stats: [
    { value: "2 soniya", label: "Menyu ochiladi" },
    { value: "0", label: "Ilova o'rnatish shart emas" },
    { value: "24/7", label: "Menyuni o'zingiz yangilaysiz" },
  ],
  audience: [
    { title: "Kafe", desc: "Muassasangiz ranglarida qulay menyu" },
    { title: "Restoranlar", desc: "Kategoriyalar, taomlar rasmi, tavsiflar va tillar" },
    { title: "Qahvaxonalar", desc: "Ichimlik va desertlarning tezkor menyusi" },
    { title: "Fast food", desc: "Narxlar va aksiyalar bilan sodda menyu" },
  ],
  steps: [
    { title: "Ariza qoldirasiz", desc: "Bizga muassasa nomi va aloqa ma'lumotlarini yozasiz — bog'lanib, hammasini sozlaymiz." },
    { title: "Biz menyuni tayyorlaymiz", desc: "Kategoriyalar, taomlar, rasmlar va narxlarni siz bilan birga qo'shamiz." },
    { title: "Kirish huquqini olasiz", desc: "Menyuni mustaqil yangilash uchun shaxsiy kabinet va tayyor QR-kod." },
    { title: "Mehmonlar QR-ni skanerlaydi", desc: "Tezkor mobil menyu ochiladi — ilova o'rnatish shart emas." },
  ],
  features: [
    { title: "Mobil menyu", desc: "Zamonaviy dizayn, tez yuklanish, har qanday telefonga moslashuv" },
    { title: "QR-kodlar", desc: "Stol, stend, eshik va bosib chiqarish uchun tayyor variantlar — PNG/SVG/PDF" },
    { title: "TV-menyu", desc: "Zaldagi televizor uchun kategoriyalar avtomatik almashinadigan alohida ekran" },
    { title: "Shaxsiy kabinet", desc: "Narxlar, rasmlar va tavsiflarni o'zingiz o'zgartirasiz — o'zgarishlar darhol ko'rinadi" },
    { title: "Telegram orqali buyurtmalar", desc: "Saytdan tushgan yangi buyurtma darhol Telegram-botingizga keladi" },
    { title: "Analitika", desc: "Har bir muassasa bo'yicha menyu ko'rishlar va QR skanerlari" },
    { title: "Rus va o'zbek tillari", desc: "Mehmon menyu tilini o'zi tanlaydi" },
    { title: "Komissiyasiz", desc: "Biz buyurtmalaringizdan foiz olmaymiz" },
  ],
  comparison: {
    title: "Nega qog'oz menyu emas",
    items: [
      { old: "Har narx o'zgarganda yangi versiyani bosib chiqarish", new: "Kabinetda narxni o'zgartirasiz — hammaga darhol ko'rinadi" },
      { old: "Menyu eskiradi, yo'qoladi, iflos bo'ladi", new: "Har doim toza, har doim dolzarb" },
      { old: "Taom rasmi yo'q, mehmon ko'r-ko'rona tanlaydi", new: "Har bir taomning rasmi — tanlash osonroq va yoqimliroq" },
      { old: "Ofitsiant aksiyalarni aytib o'tirishga vaqt sarflaydi", new: "Aksiya va yangiliklar menyuda darhol ko'rinadi" },
    ],
  },
  pricing: {
    setupPrice: "$100",
    setupLabel: "ulanishda bir martalik to'lov",
    monthlyPrice: "$10",
    monthlyLabel: "keyin oyiga",
    description: "Bitta shaffof narx. Yashirin to'lovlarsiz va buyurtmalardan foizsiz.",
    items: [
      "Muassasangiz ranglarida mobil menyu",
      "Stol/eshik/stend uchun qisqa havola va QR-kod",
      "Zal uchun TV-menyu",
      "Shaxsiy kabinet — menyuni istalgan vaqtda o'zingiz o'zgartirasiz",
      "Telegramga bildirishnoma bilan buyurtmalarni qabul qilish",
      "Ko'rishlar va skanerlar analitikasi",
      "Rus va o'zbek tilidagi menyu",
      "Ulanishda menyuni to'ldirishda yordam",
    ],
  },
  faq: [
    {
      q: "Bu obunami?",
      a: "Ulanishda $100 bir martalik to'lov — sozlash va joriy etishni qamrab oladi. Keyin oyiga $10 — hosting, yangilanishlar va qo'llab-quvvatlash. Istalgan vaqtda bekor qilish mumkin.",
    },
    {
      q: "Mehmonlar ilova yuklab olishi kerakmi?",
      a: "Yo'q. Mehmon QR-kodni skanerlaydi yoki havola orqali o'tadi — menyu darhol telefon brauzerida ochiladi.",
    },
    {
      q: "Ulanish qancha vaqt oladi?",
      a: "Odatda 1–2 kun: nom, rasmlar va menyu pozitsiyalarini yuborasiz — biz hammasini sozlab, kirish huquqini beramiz.",
    },
    {
      q: "Keyinchalik narx va taomlarni o'zim o'zgartira olamanmi?",
      a: "Ha, shaxsiy kabinetda kategoriya, taom, rasm, narx va ish vaqtini istalgan vaqtda o'zgartirishingiz mumkin.",
    },
  ],
  nav: { features: "Imkoniyatlar", pricing: "Narx", faq: "Savollar", contact: "Aloqa" },
  contact: {
    heading: "Muassasangizni ulashga tayyormisiz?",
    subheading: "Bizga yozing — qanday ishlashini tushuntiramiz va menyuni birga sozlaymiz.",
    telegram: "https://t.me/+998500068296",
    telegramLabel: "Telegramga yozish",
    phone: "+998 50 006 82 96",
  },
  footer: "Menora — kafe va restoranlar uchun raqamli menyular",
};

export const LANDING: Record<Lang, typeof ru> = { ru, uz };
