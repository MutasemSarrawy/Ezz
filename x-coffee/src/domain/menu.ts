import type { Category, Product } from './types';

export const CATEGORIES: Category[] = [
  { id: 'coffee', name: { en: 'Coffee', ar: 'قهوة' }, emoji: '☕' },
  { id: 'iced', name: { en: 'Iced', ar: 'مثلج' }, emoji: '🧊' },
  { id: 'tea', name: { en: 'Tea', ar: 'شاي' }, emoji: '🍵' },
  { id: 'bakery', name: { en: 'Bakery', ar: 'مخبوزات' }, emoji: '🥐' },
  { id: 'dessert', name: { en: 'Dessert', ar: 'حلويات' }, emoji: '🍰' },
];

// Prices are placeholders. Photos: swap these URLs for the shop's own product photography.
const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

export const PRODUCTS: Product[] = [
  { id: 'espresso', name: { en: 'Espresso', ar: 'إسبريسو' }, description: { en: 'Double shot, dark chocolate and caramel notes.', ar: 'شوت مزدوج بنكهات الشوكولاتة الداكنة والكراميل.' }, price: { JOD: 1.75, SAR: 12 }, category: 'coffee', image: u('1510591509098-f4fdc6d0ff04'), options: ['sugar', 'shots'], prepSeconds: 60 },
  { id: 'flat-white', name: { en: 'Flat White', ar: 'فلات وايت' }, description: { en: 'Velvety microfoam over a ristretto base.', ar: 'رغوة حليب ناعمة فوق قاعدة ريستريتو.' }, price: { JOD: 2.75, SAR: 17 }, category: 'coffee', image: u('1577968897966-3d4325b36b61'), options: ['size', 'milk', 'sugar', 'shots', 'syrup'], prepSeconds: 130, popular: true },
  { id: 'latte', name: { en: 'Caffè Latte', ar: 'كافيه لاتيه' }, description: { en: 'Smooth, milky and balanced.', ar: 'ناعم ومتوازن بالحليب.' }, price: { JOD: 2.9, SAR: 18 }, category: 'coffee', image: u('1509042239860-f550ce710b93'), options: ['size', 'milk', 'sugar', 'shots', 'syrup'], prepSeconds: 140, popular: true },
  { id: 'cappuccino', name: { en: 'Cappuccino', ar: 'كابتشينو' }, description: { en: 'Thick foam, equal parts espresso and milk.', ar: 'رغوة كثيفة وكميات متساوية من الإسبريسو والحليب.' }, price: { JOD: 2.8, SAR: 17 }, category: 'coffee', image: u('1572442388796-11668a67e53d'), options: ['size', 'milk', 'sugar', 'shots', 'syrup'], prepSeconds: 140 },
  { id: 'mocha', name: { en: 'Mocha', ar: 'موكا' }, description: { en: 'Espresso, steamed milk and rich dark chocolate.', ar: 'إسبريسو وحليب مبخر وشوكولاتة داكنة غنية.' }, price: { JOD: 3.25, SAR: 20 }, category: 'coffee', image: u('1578314675249-a6910f80cc4e'), options: ['size', 'milk', 'sugar', 'shots'], prepSeconds: 160 },
  { id: 'iced-latte', name: { en: 'Iced Latte', ar: 'آيس لاتيه' }, description: { en: 'Chilled espresso over milk and ice.', ar: 'إسبريسو مبرد فوق الحليب والثلج.' }, price: { JOD: 3.0, SAR: 19 }, category: 'iced', image: u('1517701604599-bb29b565090c'), options: ['size', 'milk', 'sugar', 'shots', 'syrup'], prepSeconds: 110, popular: true },
  { id: 'cold-brew', name: { en: 'Cold Brew', ar: 'كولد برو' }, description: { en: 'Steeped 18 hours. Smooth, low acidity.', ar: 'منقوع 18 ساعة. ناعم وقليل الحموضة.' }, price: { JOD: 2.9, SAR: 18 }, category: 'iced', image: u('1461023058943-07fcbe16d735'), options: ['size', 'sugar', 'syrup'], prepSeconds: 60 },
  { id: 'iced-caramel', name: { en: 'Iced Caramel Macchiato', ar: 'آيس كراميل ماكياتو' }, description: { en: 'Vanilla, milk, espresso and a caramel drizzle.', ar: 'فانيلا وحليب وإسبريسو مع صوص الكراميل.' }, price: { JOD: 3.4, SAR: 21 }, category: 'iced', image: u('1553909489-cd47e0907980'), options: ['size', 'milk', 'sugar', 'shots'], prepSeconds: 130 },
  { id: 'green-tea', name: { en: 'Jasmine Green Tea', ar: 'شاي أخضر بالياسمين' }, description: { en: 'Fragrant, light, freshly steeped.', ar: 'عطري وخفيف ومنقوع طازجاً.' }, price: { JOD: 2.0, SAR: 13 }, category: 'tea', image: u('1556679343-c7306c1976bc'), options: ['size', 'sugar'], prepSeconds: 90 },
  { id: 'chai', name: { en: 'Masala Chai Latte', ar: 'شاي ماسالا لاتيه' }, description: { en: 'Spiced black tea with steamed milk.', ar: 'شاي أسود بالبهارات مع حليب مبخر.' }, price: { JOD: 2.75, SAR: 17 }, category: 'tea', image: u('1561336313-0bd5e0b27ec8'), options: ['size', 'milk', 'sugar'], prepSeconds: 120 },
  { id: 'croissant', name: { en: 'Butter Croissant', ar: 'كرواسون بالزبدة' }, description: { en: 'Baked fresh every morning.', ar: 'يُخبز طازجاً كل صباح.' }, price: { JOD: 1.9, SAR: 11 }, category: 'bakery', image: u('1555507036-ab1f4038808a'), options: ['warm'], prepSeconds: 30 },
  { id: 'pain-choc', name: { en: 'Pain au Chocolat', ar: 'بان أو شوكولا' }, description: { en: 'Flaky pastry, two dark chocolate bars.', ar: 'عجينة هشة مع قطعتي شوكولاتة داكنة.' }, price: { JOD: 2.2, SAR: 13 }, category: 'bakery', image: u('1530610476181-d83430b64dcd'), options: ['warm'], prepSeconds: 30 },
  { id: 'cheesecake', name: { en: 'Basque Cheesecake', ar: 'تشيز كيك باسك' }, description: { en: 'Burnt top, creamy centre.', ar: 'وجه محروق وقلب كريمي.' }, price: { JOD: 3.75, SAR: 24 }, category: 'dessert', image: u('1533134242443-d4fd215305ad'), options: [], prepSeconds: 20 },
  { id: 'brownie', name: { en: 'Fudge Brownie', ar: 'براوني' }, description: { en: 'Dense, gooey and just a little salty.', ar: 'كثيف وطري مع لمسة ملح.' }, price: { JOD: 2.25, SAR: 14 }, category: 'dessert', image: u('1606313564200-e75d5e30476c'), options: ['warm'], prepSeconds: 20 },
];

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
