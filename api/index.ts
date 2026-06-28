import express from "express";
import { createClient } from "@supabase/supabase-js";
import type { Request, Response } from "express";

const app = express();
app.use(express.json());

// --- SUPABASE ---
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
let supabase: any = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.error("Supabase init failed:", e);
  }
}

// --- IN-MEMORY DATA (Vercel is stateless — use Supabase for persistence) ---
const INITIAL_MENU = [
  { id: 'mysore-bonda', name: 'Mysore Bonda', desc: 'Crisp urad-rice fritters served with coconut chutney.', category: 'starters', price: 90, icon: '🧆', veg: true, spice: false, initialStock: 14, stock: 14, addons: [{ id: 'dip', label: 'Extra Mint Dip', price: 10 }] },
  { id: 'chilli-corn', name: 'Chilli Garlic Baby Corn', desc: 'Wok-tossed baby corn in a sharp garlic-chilli glaze.', category: 'starters', price: 160, icon: '🌽', veg: true, spice: true, initialStock: 9, stock: 9, addons: [{ id: 'sauce', label: 'Extra Chilli-Garlic Sauce', price: 15 }] },
  { id: 'chicken-65', name: 'Chicken 65', desc: 'Madurai-style deep fried chicken with robust curry leaf tempering.', category: 'starters', price: 220, icon: '🍗', veg: false, spice: true, initialStock: 6, stock: 6, addons: [{ id: 'curryleaf', label: 'Extra Curry Leaf Tempering', price: 10 }] },
  { id: 'pepper-prawns', name: 'Pepper Prawns', desc: 'Pan-seared prawns in a spicy cracked black pepper masala.', category: 'starters', price: 280, icon: '🦐', veg: false, spice: true, initialStock: 3, stock: 3, addons: [{ id: 'pepper', label: 'Extra Pepper Crust', price: 20 }] },
  { id: 'masala-dosa', name: 'Masala Dosa', desc: 'Crisp rice crepe stuffed with spiced potato filling.', category: 'southindian', price: 110, icon: '🫓', veg: true, spice: false, initialStock: 20, stock: 20, addons: [{ id: 'cheese', label: 'Add Cheese', price: 25 }, { id: 'sambar', label: 'Extra Sambar', price: 15 }] },
  { id: 'ghee-roast-dosa', name: 'Ghee Roast Dosa', desc: 'Golden butter-crisp dosa loaded with premium pure ghee.', category: 'southindian', price: 140, icon: '🫓', veg: true, spice: false, initialStock: 5, stock: 5 },
  { id: 'idli-sambar', name: 'Idli Sambar (4 pc)', desc: 'Soft steamed rice cakes soaked in flavorful hot lentil sambar.', category: 'southindian', price: 80, icon: '🍙', veg: true, spice: false, initialStock: 25, stock: 25 },
  { id: 'chettinad-chicken', name: 'Chettinad Chicken Curry', desc: 'Juicy chicken slow-cooked in roasted Chettinad spices.', category: 'southindian', price: 260, icon: '🍛', veg: false, spice: true, initialStock: 8, stock: 8 },
  { id: 'meen-kuzhambu', name: 'Meen Kuzhambu', desc: 'Tangy tamarind-infused fish curry, a legendary coastal classic.', category: 'southindian', price: 240, icon: '🐟', veg: false, spice: true, initialStock: 2, stock: 2 },
  { id: 'paneer-butter-masala', name: 'Paneer Butter Masala', desc: 'Fresh paneer cubes in a silky rich tomato-cashew gravy.', category: 'mains', price: 220, icon: '🍛', veg: true, spice: false, initialStock: 12, stock: 12 },
  { id: 'dal-makhani', name: 'Dal Makhani', desc: 'Black lentils slow-simmered overnight with butter and cream.', category: 'mains', price: 190, icon: '🍲', veg: true, spice: false, initialStock: 18, stock: 18 },
  { id: 'butter-chicken', name: 'Butter Chicken', desc: 'Tandoori chicken in a rich buttery gravy.', category: 'mains', price: 260, icon: '🍛', veg: false, spice: false, initialStock: 7, stock: 7 },
  { id: 'mutton-rogan-josh', name: 'Mutton Rogan Josh', desc: 'Tender mutton with aromatic Kashmiri spices.', category: 'mains', price: 320, icon: '🍖', veg: false, spice: true, initialStock: 4, stock: 4 },
  { id: 'filter-coffee', name: 'Filter Coffee', desc: 'Strong traditional South Indian filter brew.', category: 'beverages', price: 40, icon: '☕', veg: true, spice: false, initialStock: 50, stock: 50 },
  { id: 'masala-chai', name: 'Masala Chai', desc: 'Milk tea brewed with ginger, cloves, and cardamom.', category: 'beverages', price: 30, icon: '☕', veg: true, spice: false, initialStock: 50, stock: 50 },
  { id: 'coca-cola', name: 'Coca-Cola (Chilled)', desc: 'Served ice-cold.', category: 'beverages', price: 40, icon: '🥤', veg: true, spice: false, initialStock: 30, stock: 30 },
  { id: 'mysore-pak', name: 'Mysore Pak', desc: 'Rich ghee-sweet made from gram flour.', category: 'desserts', price: 70, icon: '🍯', veg: true, spice: false, initialStock: 10, stock: 10 },
  { id: 'filter-coffee-kulfi', name: 'Filter Coffee Kulfi', desc: 'Kulfi frozen with filter coffee flavor.', category: 'desserts', price: 90, icon: '🍦', veg: true, spice: false, initialStock: 6, stock: 6 }
];

let users: any[] = [
  { id: "u-ceo", name: "Royal Ruban (CEO)", email: "ceo@spiceandleaf.com", role: "ceo", phone: "+91 99999 88888" },
  { id: "u-staff", name: "Meenakshi (Kitchen)", email: "staff@spiceandleaf.com", role: "staff", phone: "+91 98765 43210" },
  { id: "u-cust", name: "Ramesh Kannan", email: "customer@spiceandleaf.com", role: "customer", phone: "+91 90000 11111", address: "42, Kalavasal Main Rd, Madurai" }
];
let orders: any[] = [];
let menuStock: any[] = [...INITIAL_MENU];
let notifications: any[] = [];

// --- HELPERS ---
function addNotification(userId: string, title: string, message: string, type: string) {
  const notif = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId, title, message,
    timestamp: new Date().toISOString(),
    read: false, type
  };
  notifications.unshift(notif);
  if (notifications.length > 100) notifications = notifications.slice(0, 100);
}

// --- API ROUTES ---

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Menu
app.get("/api/menu", (_req: Request, res: Response) => {
  res.json(menuStock);
});

// Auth
app.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, role } = req.body;
  const user = users.find(u => u.email === email && u.role === role);
  if (!user) return res.status(401).json({ success: false, error: "Invalid credentials." });
  res.json({ success: true, user });
});

app.post("/api/auth/register", (req: Request, res: Response) => {
  const { name, email, phone, address } = req.body;
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ success: false, error: "Email already registered." });
  }
  const newUser = {
    id: `u-${Date.now()}`,
    name, email, phone,
    address: address || "",
    role: "customer"
  };
  users.push(newUser);
  res.json({ success: true, user: newUser });
});

// Orders
app.get("/api/orders", (req: Request, res: Response) => {
  const { userId, role } = req.query;
  if (role === "ceo" || role === "staff") return res.json(orders);
  const filtered = orders.filter(o => o.userId === userId);
  res.json(filtered);
});

app.post("/api/orders", (req: Request, res: Response) => {
  const { userId, items, total, mode, address } = req.body;
  if (!userId || !items || !total) {
    return res.status(400).json({ success: false, error: "Missing required fields." });
  }

  // Deduct stock
  items.forEach((item: any) => {
    const menuItem = menuStock.find(m => m.id === item.id);
    if (menuItem) {
      menuItem.stock = Math.max(0, menuItem.stock - item.qty);
    }
  });

  const order = {
    id: `ORD-${Date.now()}`,
    userId, items, total,
    mode: mode || "dine-in",
    address: address || "",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  orders.push(order);
  addNotification(userId, "Order Placed!", `Your order #${order.id} has been received.`, "order_update");
  addNotification("u-staff", "New Order!", `New order #${order.id} received.`, "order_update");

  res.json({ success: true, order });
});

app.patch("/api/orders/:id/status", (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ success: false, error: "Order not found." });

  order.status = status;
  order.updatedAt = new Date().toISOString();

  const messages: Record<string, string> = {
    confirmed: `Your order #${id} has been confirmed!`,
    preparing: `Your order #${id} is being prepared.`,
    dispatched: `Your order #${id} is on the way!`,
    delivered: `Your order #${id} has been delivered. Enjoy!`,
    cancelled: `Your order #${id} has been cancelled.`
  };

  addNotification(order.userId, "Order Update", messages[status] || `Order status: ${status}`, "order_update");
  res.json({ success: true, order });
});

// Stock
app.get("/api/stock", (_req: Request, res: Response) => {
  res.json(menuStock);
});

app.patch("/api/stock/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { stock } = req.body;
  const item = menuStock.find(m => m.id === id);
  if (!item) return res.status(404).json({ success: false, error: "Item not found." });
  item.stock = stock;
  res.json({ success: true, item });
});

// Users
app.get("/api/users", (_req: Request, res: Response) => {
  res.json(users);
});

// CEO Stats
app.get("/api/ceo/stats", (_req: Request, res: Response) => {
  const completedOrders = orders.filter(o => o.status === "delivered");
  const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + o.total, 0);
  const counts: Record<string, number> = {};
  orders.forEach(ord => {
    ord.items.forEach((it: any) => {
      counts[it.name] = (counts[it.name] || 0) + it.qty;
    });
  });
  const popularItems = Object.keys(counts)
    .map(name => ({ name, count: counts[name] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    totalOrders: orders.length,
    totalRevenue,
    popularItems,
    lowStockCount: menuStock.filter(it => it.stock <= 5).length
  });
});

// Notifications
app.get("/api/notifications", (req: Request, res: Response) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, error: "User ID required." });
  const user = users.find(u => u.id === userId);
  if (user && (user.role === "ceo" || user.role === "staff")) {
    return res.json(notifications);
  }
  res.json(notifications.filter((n: any) => n.userId === userId || n.userId === "all"));
});

app.post("/api/notifications/read", (req: Request, res: Response) => {
  const { notificationId } = req.body;
  const notif = notifications.find((n: any) => n.id === notificationId);
  if (notif) notif.read = true;
  res.json({ success: true });
});

// Payment mock
app.post("/api/payment/pay", (_req: Request, res: Response) => {
  const success = Math.random() < 0.96;
  if (success) {
    res.json({
      success: true,
      transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 90000 + 10000)}`,
      status: "captured",
      message: "Payment authorized successfully."
    });
  } else {
    res.status(402).json({ success: false, error: "Transaction declined by issuer bank." });
  }
});

export default app;
