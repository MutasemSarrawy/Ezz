import type { Category, Product } from './types';

export const CATEGORIES: Category[] = [
  { id: 'coffee', name: 'Coffee', emoji: '☕' },
  { id: 'iced', name: 'Iced', emoji: '🧊' },
  { id: 'tea', name: 'Tea', emoji: '🍵' },
  { id: 'bakery', name: 'Bakery', emoji: '🥐' },
  { id: 'dessert', name: 'Dessert', emoji: '🍰' },
];

// Photos: swap these URLs for the shop's own product photography.
const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

export const PRODUCTS: Product[] = [
  { id: 'espresso', name: 'Espresso', description: 'Double shot, dark chocolate and caramel notes.', price: 2.5, category: 'coffee', image: u('1510591509098-f4fdc6d0ff04'), prepSeconds: 60 },
  { id: 'flat-white', name: 'Flat White', description: 'Velvety microfoam over a ristretto base.', price: 3.8, category: 'coffee', image: u('1577968897966-3d4325b36b61'), prepSeconds: 130, popular: true },
  { id: 'latte', name: 'Caffè Latte', description: 'Smooth, milky and balanced.', price: 4.0, category: 'coffee', image: u('1509042239860-f550ce710b93'), prepSeconds: 140, popular: true },
  { id: 'cappuccino', name: 'Cappuccino', description: 'Thick foam, equal parts espresso and milk.', price: 3.9, category: 'coffee', image: u('1572442388796-11668a67e53d'), prepSeconds: 140 },
  { id: 'mocha', name: 'Mocha', description: 'Espresso, steamed milk and rich dark chocolate.', price: 4.5, category: 'coffee', image: u('1578314675249-a6910f80cc4e'), prepSeconds: 160 },
  { id: 'iced-latte', name: 'Iced Latte', description: 'Chilled espresso over milk and ice.', price: 4.3, category: 'iced', image: u('1517701604599-bb29b565090c'), prepSeconds: 110, popular: true },
  { id: 'cold-brew', name: 'Cold Brew', description: 'Steeped 18 hours. Smooth, low acidity.', price: 4.2, category: 'iced', image: u('1461023058943-07fcbe16d735'), prepSeconds: 60 },
  { id: 'iced-caramel', name: 'Iced Caramel Macchiato', description: 'Vanilla, milk, espresso and a caramel drizzle.', price: 4.8, category: 'iced', image: u('1553909489-cd47e0907980'), prepSeconds: 130 },
  { id: 'green-tea', name: 'Jasmine Green Tea', description: 'Fragrant, light, freshly steeped.', price: 3.0, category: 'tea', image: u('1556679343-c7306c1976bc'), prepSeconds: 90 },
  { id: 'chai', name: 'Masala Chai Latte', description: 'Spiced black tea with steamed milk.', price: 4.0, category: 'tea', image: u('1561336313-0bd5e0b27ec8'), prepSeconds: 120 },
  { id: 'croissant', name: 'Butter Croissant', description: 'Baked fresh every morning.', price: 3.2, category: 'bakery', image: u('1555507036-ab1f4038808a'), prepSeconds: 30 },
  { id: 'pain-choc', name: 'Pain au Chocolat', description: 'Flaky pastry, two dark chocolate bars.', price: 3.6, category: 'bakery', image: u('1530610476181-d83430b64dcd'), prepSeconds: 30 },
  { id: 'cheesecake', name: 'Basque Cheesecake', description: 'Burnt top, creamy centre.', price: 5.5, category: 'dessert', image: u('1533134242443-d4fd215305ad'), prepSeconds: 20 },
  { id: 'brownie', name: 'Fudge Brownie', description: 'Dense, gooey and just a little salty.', price: 3.5, category: 'dessert', image: u('1606313564200-e75d5e30476c'), prepSeconds: 20 },
];

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
