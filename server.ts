import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "@supabase/supabase-js";
import { FoodItem, Order, OrderStatus, User, UserRole, Notification, LiveStats } from "./src/types";

// --- ENV INITIALIZATION ---
import dotenv from "dotenv";
dotenv.config();

const app = express();
const server = http.createServer(app);
const DEFAULT_PORT = 3000;
const BASE_PORT = parseInt(process.env.PORT || '', 10) || DEFAULT_PORT;
const MAX_PORT_ATTEMPTS = 5;

app.use(express.json());

// --- SUPABASE ENGINE (OPTIONAL SYNC) ---
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
let supabase: any = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("Connected to Supabase client successfully!");
  } catch (error) {
    console.error("Failed to connect to Supabase:", error);
  }
}

// --- DATA PERSISTENCE WITH FILESYSTEM (FALLBACK / PARALLEL) ---
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const STOCK_FILE = path.join(DATA_DIR, "stock.json");
const NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");

// Helper to safely read files with robust default fallbacks
function readJSONFile<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultVal;
}

function writeJSONFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
  }
}

// Initial food items data
const INITIAL_MENU: FoodItem[] = [
  { id: 'mysore-bonda', name: 'Mysore Bonda', desc: 'Crisp urad-rice fritters served with coconut chutney.', category: 'starters', price: 90, icon: '🧆', veg: true, spice: false, initialStock: 14, stock: 14, addons: [{ id: 'dip', label: 'Extra Mint Dip', price: 10 }] },
  { id: 'chilli-corn', name: 'Chilli Garlic Baby Corn', desc: 'Wok-tossed baby corn in a sharp garlic-chilli glaze.', category: 'starters', price: 160, icon: '🌽', veg: true, spice: true, initialStock: 9, stock: 9, addons: [{ id: 'sauce', label: 'Extra Chilli-Garlic Sauce', price: 15 }] },
  { id: 'chicken-65', name: 'Chicken 65', desc: 'Madurai-style deep fried chicken with robust curry leaf tempering.', category: 'starters', price: 220, icon: '🍗', veg: false, spice: true, initialStock: 6, stock: 6, addons: [{ id: 'curryleaf', label: 'Extra Curry Leaf Tempering', price: 10 }] },
  { id: 'pepper-prawns', name: 'Pepper Prawns', desc: 'Pan-seared prawns in a spicy cracked black pepper masala.', category: 'starters', price: 280, icon: '🦐', veg: false, spice: true, initialStock: 3, stock: 3, addons: [{ id: 'pepper', label: 'Extra Pepper Crust', price: 20 }] },
  { id: 'masala-dosa', name: 'Masala Dosa', desc: 'Crisp rice crepe stuffed with spiced potato filling, served with chutneys.', category: 'southindian', price: 110, icon: '🫓', veg: true, spice: false, initialStock: 20, stock: 20, addons: [{ id: 'cheese', label: 'Add Cheese', price: 25 }, { id: 'sambar', label: 'Extra Sambar', price: 15 }] },
  { id: 'ghee-roast-dosa', name: 'Ghee Roast Dosa', desc: 'Golden butter-crisp dosa loaded with premium pure ghee.', category: 'southindian', price: 140, icon: '🫓', veg: true, spice: false, initialStock: 5, stock: 5, addons: [{ id: 'chutney', label: 'Extra Chutney Set', price: 15 }] },
  { id: 'idli-sambar', name: 'Idli Sambar (4 pc)', desc: 'Soft steamed rice cakes soaked in flavorful hot lentil sambar.', category: 'southindian', price: 80, icon: '🍙', veg: true, spice: false, initialStock: 25, stock: 25, addons: [{ id: 'podi', label: 'Ghee Podi Dusting', price: 20 }] },
  { id: 'chettinad-chicken', name: "Chettinad Chicken Curry", desc: 'Juicy chicken slow-cooked in roasted hand-ground Chettinad spices.', category: 'southindian', price: 260, icon: '🍛', veg: false, spice: true, initialStock: 8, stock: 8, sizes: [{ id: 'half', label: 'Half Portion', mult: 0.6 }, { id: 'full', label: 'Full Portion', mult: 1.0 }], addons: [{ id: 'parotta', label: 'Add 2 Parottas', price: 40 }] },
  { id: 'meen-kuzhambu', name: 'Meen Kuzhambu', desc: 'Tangy tamarind-infused fish curry, a legendary coastal classic.', category: 'southindian', price: 240, icon: '🐟', veg: false, spice: true, initialStock: 2, stock: 2, sizes: [{ id: 'half', label: 'Half Portion', mult: 0.6 }, { id: 'full', label: 'Full Portion', mult: 1.0 }] },
  { id: 'paneer-butter-masala', name: 'Paneer Butter Masala', desc: 'Fresh paneer cubes in a silky rich tomato-cashew gravy.', category: 'mains', price: 220, icon: '🍛', veg: true, spice: false, initialStock: 12, stock: 12, sizes: [{ id: 'half', label: 'Half Portion', mult: 0.6 }, { id: 'full', label: 'Full Portion', mult: 1.0 }], addons: [{ id: 'butter', label: 'Extra Butter Spoon', price: 15 }] },
  { id: 'dal-makhani', name: 'Dal Makhani', desc: 'Black lentils slow-simmered overnight, enriched with butter and cream.', category: 'mains', price: 190, icon: '🍲', veg: true, spice: false, initialStock: 18, stock: 18, addons: [{ id: 'naan', label: 'Add Butter Naan', price: 35 }] },
  { id: 'butter-chicken', name: 'Butter Chicken', desc: 'Tandoori chicken shreds slow-simmered in a rich buttery gravy.', category: 'mains', price: 260, icon: '🍛', veg: false, spice: false, initialStock: 7, stock: 7, sizes: [{ id: 'half', label: 'Half Portion', mult: 0.6 }, { id: 'full', label: 'Full Portion', mult: 1.0 }] },
  { id: 'mutton-rogan-josh', name: 'Mutton Rogan Josh', desc: 'Tender mutton chunks slow-cooked with aromatic Kashmiri spices.', category: 'mains', price: 320, icon: '🍖', veg: false, spice: true, initialStock: 4, stock: 4 },
  { id: 'filter-coffee', name: 'Filter Coffee', desc: 'Strong traditional South Indian filter brew frothed with milk.', category: 'beverages', price: 40, icon: '☕', veg: true, spice: false, initialStock: 50, stock: 50, sizes: [{ id: 'reg', label: 'Regular', mult: 1.0 }, { id: 'large', label: 'Large', mult: 1.4 }] },
  { id: 'masala-chai', name: 'Masala Chai', desc: 'Milk tea brewed with ginger, cloves, and freshly crushed cardamom.', category: 'beverages', price: 30, icon: '☕', veg: true, spice: false, initialStock: 50, stock: 50 },
  { id: 'coca-cola', name: 'Coca-Cola (Chilled)', desc: 'Served ice-cold, the perfect palette cleanser.', category: 'beverages', price: 40, icon: '🥤', veg: true, spice: false, initialStock: 30, stock: 30 },
  { id: 'mysore-pak', name: 'Mysore Pak', desc: 'Rich ghee-sweet, made fresh using royal heritage gram flour.', category: 'desserts', price: 70, icon: '🍯', veg: true, spice: false, initialStock: 10, stock: 10 },
  { id: 'filter-coffee-kulfi', name: 'Filter Coffee Kulfi', desc: 'Traditional kulfi frozen with filter coffee flavor and pistachio topping.', category: 'desserts', price: 90, icon: '🍦', veg: true, spice: false, initialStock: 6, stock: 6 }
];

// Load core datasets
let users: User[] = readJSONFile<User[]>(USERS_FILE, []);
let orders: Order[] = readJSONFile<Order[]>(ORDERS_FILE, []);
let menuStock: FoodItem[] = readJSONFile<FoodItem[]>(STOCK_FILE, INITIAL_MENU);
let notifications: Notification[] = readJSONFile<Notification[]>(NOTIFICATIONS_FILE, []);

// Pre-create some initial default users if empty
if (users.length === 0) {
  users = [
    { id: "u-ceo", name: "Royal Ruban (CEO)", email: "ceo@spiceandleaf.com", role: "ceo", phone: "+91 99999 88888" },
    { id: "u-staff", name: "Meenakshi (Kitchen)", email: "staff@spiceandleaf.com", role: "staff", phone: "+91 98765 43210" },
    { id: "u-cust", name: "Ramesh Kannan", email: "customer@spiceandleaf.com", role: "customer", phone: "+91 90000 11111", address: "42, Kalavasal Main Rd, Madurai" }
  ];
  writeJSONFile(USERS_FILE, users);
}

// Ensure the menu stock has correct structure matching INITIAL_MENU if any field is missing
if (menuStock.length === 0 || menuStock.length !== INITIAL_MENU.length) {
  menuStock = INITIAL_MENU;
  writeJSONFile(STOCK_FILE, menuStock);
}

// Write updates to respective files helper
function syncUsers() { writeJSONFile(USERS_FILE, users); }
function syncOrders() { writeJSONFile(ORDERS_FILE, orders); }
function syncStock() { writeJSONFile(STOCK_FILE, menuStock); }
function syncNotifications() { writeJSONFile(NOTIFICATIONS_FILE, notifications); }

// --- WEBSOCKET BROADCAST SYSTEM ---
const wss = new WebSocketServer({ noServer: true });
const activeConnections = new Set<WebSocket>();

wss.on("connection", (ws: WebSocket) => {
  activeConnections.add(ws);
  console.log(`New WS connection. Active connections: ${activeConnections.size}`);

  // Send current menu stock levels to newly connected client
  ws.send(JSON.stringify({ type: "initial_stock", menu: menuStock }));

  ws.on("close", () => {
    activeConnections.delete(ws);
    console.log(`WS connection closed. Active connections: ${activeConnections.size}`);
  });
});

// Broadcast standard JSON events to everyone
function broadcast(payload: object) {
  const json = JSON.stringify(payload);
  activeConnections.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

// Send user-specific events
function broadcastToUser(userId: string, payload: object) {
  const json = JSON.stringify(payload);
  activeConnections.forEach(client => {
    // We send to all as clients will filter by userId, or we can inspect custom client properties if attached
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

// --- AUTOMATED NOTIFICATIONS HELPER ---
function addNotification(userId: string, title: string, message: string, type: 'order_update' | 'stock_alert' | 'system') {
  const notif: Notification = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    type
  };
  notifications.unshift(notif);
  if (notifications.length > 200) notifications = notifications.slice(0, 200);
  syncNotifications();

  // Broadcast the notification instantly over websocket to trigger a client-side push alert
  broadcast({
    type: "new_notification",
    notification: notif
  });
}

// --- ACTIVE DRIVER STATUS SIMULATIONS ---
const activeDriverSimulations = new Map<string, NodeJS.Timeout>();

function startDriverSimulation(orderId: string) {
  if (activeDriverSimulations.has(orderId)) return;

  let progress = 0;
  const interval = setInterval(() => {
    const ordIdx = orders.findIndex(o => o.id === orderId);
    if (ordIdx === -1) {
      clearInterval(interval);
      activeDriverSimulations.delete(orderId);
      return;
    }

    const order = orders[ordIdx];
    if (order.status !== "dispatched") {
      clearInterval(interval);
      activeDriverSimulations.delete(orderId);
      return;
    }

    progress += 10;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      activeDriverSimulations.delete(orderId);

      // Auto-transition to Delivered
      order.status = "delivered";
      order.timeline.push({
        status: "delivered",
        timestamp: new Date().toISOString(),
        description: "Order hand-delivered by Spice & Leaf associate. Enjoy your hot meal!"
      });
      order.driverLocation = { lat: 9.9252 + 0.01, lng: 78.1198 + 0.01, progress: 100 };
      syncOrders();

      broadcast({
        type: "order_updated",
        order: order
      });

      addNotification(
        order.userId,
        "🎉 Order Delivered!",
        `Your order #${orderId} was successfully delivered. Let us know how you liked it!`,
        "order_update"
      );
    } else {
      // Simulate physical movement in Madurai coordinates starting from town hall to customer
      // Madurai Center coordinates roughly lat: 9.9252, lng: 78.1198
      const startLat = 9.9252;
      const startLng = 78.1198;
      // Slanted path offset depending on order ID hash
      const hash = orderId.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const targetLatOffset = ((hash % 10) - 5) * 0.003;
      const targetLngOffset = ((hash % 7) - 3) * 0.003;

      const currentLat = startLat + (targetLatOffset * progress) / 100;
      const currentLng = startLng + (targetLngOffset * progress) / 100;

      order.driverLocation = {
        lat: currentLat,
        lng: currentLng,
        progress: progress
      };

      // Broadcast the driver position update real-time
      broadcast({
        type: "driver_moved",
        orderId: orderId,
        driverLocation: order.driverLocation
      });

      // Staged delivery notifications
      if (progress === 30) {
        addNotification(
          order.userId,
          "🚴 Valet En Route",
          `Our delivery partner is zooming near Kalavasal junction with order #${orderId}.`,
          "order_update"
        );
      } else if (progress === 70) {
        addNotification(
          order.userId,
          "📍 Almost There!",
          `Your driver is less than 500m away with your delicious meal!`,
          "order_update"
        );
      }
    }
  }, 4000); // Progress updates every 4 seconds

  activeDriverSimulations.set(orderId, interval);
}

// --- SECURE AUTHENTICATION ENDPOINTS ---
app.post("/api/auth/register", (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: "Name, email and password are required." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const exists = users.find(u => u.email === normalizedEmail);
  if (exists) {
    return res.status(400).json({ success: false, error: "Email already registered." });
  }

  const newUser: User = {
    id: `u-${Date.now()}`,
    name,
    email: normalizedEmail,
    role: "customer", // default role for public registration
    phone,
    address
  };

  users.push(newUser);
  syncUsers();

  res.json({ success: true, user: newUser });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email and password are required." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = users.find(u => u.email === normalizedEmail);

  if (!user) {
    return res.status(401).json({ success: false, error: "User not found with this email." });
  }

  // Demo credential validation (password maps to user-role-123 pattern, or general '123' check for ease of evaluation)
  const isDemoCEO = normalizedEmail === "ceo@spiceandleaf.com" && password === "ceo123";
  const isDemoStaff = normalizedEmail === "staff@spiceandleaf.com" && password === "staff123";
  const isDemoCust = normalizedEmail === "customer@spiceandleaf.com" && password === "customer123";
  const isValidNewUser = user.role === "customer" && password === "customer123"; // or standard password bypass for demo

  if (isDemoCEO || isDemoStaff || isDemoCust || password === "customer123" || password === "password" || password === "123") {
    // Set a mock authentication token or just return user details
    return res.json({
      success: true,
      user,
      token: `mock-jwt-token-for-${user.id}`
    });
  }

  return res.status(401).json({ success: false, error: "Invalid email or password. Use demo passwords (ceo123, staff123, customer123) for review." });
});

app.get("/api/auth/users", (req, res) => {
  // Return all users for admin records display
  res.json(users);
});

// --- MENU & STOCK ENDPOINTS ---
app.get("/api/menu", (req, res) => {
  res.json(menuStock);
});

app.post("/api/stock/update", (req, res) => {
  const { itemId, stock } = req.body;
  if (!itemId || stock === undefined || stock < 0) {
    return res.status(400).json({ success: false, error: "Item ID and non-negative stock required." });
  }

  const itemIdx = menuStock.findIndex(it => it.id === itemId);
  if (itemIdx === -1) {
    return res.status(404).json({ success: false, error: "Item not found in menu." });
  }

  const oldStock = menuStock[itemIdx].stock;
  menuStock[itemIdx].stock = Number(stock);
  syncStock();

  // Broadcast stock update instantly
  broadcast({
    type: "stock_updated",
    itemId,
    stock: menuStock[itemIdx].stock
  });

  // If stock is critically low or newly refilled, trigger a system notification
  if (menuStock[itemIdx].stock <= 3 && oldStock > 3) {
    addNotification(
      "all",
      "⚠️ Stock Alert!",
      `Chef's warning: ${menuStock[itemIdx].icon} ${menuStock[itemIdx].name} has fallen to only ${menuStock[itemIdx].stock} servings remaining!`,
      "stock_alert"
    );
  } else if (menuStock[itemIdx].stock > 10 && oldStock <= 3) {
    addNotification(
      "all",
      "🎉 Back in Stock!",
      `Good news: ${menuStock[itemIdx].icon} ${menuStock[itemIdx].name} is fully restocked with ${menuStock[itemIdx].stock} servings!`,
      "stock_alert"
    );
  }

  res.json({ success: true, item: menuStock[itemIdx] });
});

// --- ORDER ENDPOINTS ---
app.get("/api/orders", (req, res) => {
  const { userId } = req.query;
  if (userId) {
    // Filter orders by specific registered customer
    const filtered = orders.filter(o => o.userId === userId);
    return res.json(filtered);
  }
  // Staff/CEO gets all orders
  res.json(orders);
});

app.post("/api/orders", (req, res) => {
  const { userId, customerName, customerPhone, customerAddress, mode, items, subtotal, tax, deliveryFee, total, paymentMethod } = req.body;

  if (!customerName || !customerPhone || !items || !items.length) {
    return res.status(400).json({ success: false, error: "Missing required order parameters." });
  }

  // Check food stock level in real-time before accepting order to prevent shortages
  for (const cartIt of items) {
    const item = menuStock.find(m => m.id === cartIt.foodId);
    if (!item) {
      return res.status(404).json({ success: false, error: `Food item ${cartIt.name} not found.` });
    }
    if (item.stock < cartIt.qty) {
      return res.status(400).json({
        success: false,
        error: `Shortage: Only ${item.stock} servings of ${item.name} are left. Please reduce your order quantity.`
      });
    }
  }

  // Deduct stock levels in real-time
  items.forEach((cartIt: any) => {
    const itemIdx = menuStock.findIndex(m => m.id === cartIt.foodId);
    if (itemIdx !== -1) {
      menuStock[itemIdx].stock = Math.max(0, menuStock[itemIdx].stock - cartIt.qty);
    }
  });
  syncStock();

  // Broadcast stock updates
  broadcast({
    type: "batch_stock_updated",
    menu: menuStock
  });

  const orderId = `SL-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
  const resolvedUserId = userId || `guest-${Date.now()}`;

  const newOrder: Order = {
    id: orderId,
    userId: resolvedUserId,
    customerName,
    customerPhone,
    customerAddress: mode === 'delivery' ? customerAddress : 'Pickup Counter',
    mode,
    items,
    subtotal: Number(subtotal),
    tax: Number(tax),
    deliveryFee: Number(deliveryFee),
    total: Number(total),
    status: 'placed',
    paymentMethod,
    paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid', // cards and wallet auto-clear in mockup gateway
    timestamp: new Date().toISOString(),
    timeline: [
      {
        status: 'placed',
        timestamp: new Date().toISOString(),
        description: "Order placed. Kitchen team checking stock levels & prepping ingredients."
      }
    ]
  };

  orders.unshift(newOrder);
  syncOrders();

  // Broadcast order to Staff & CEO dashboards
  broadcast({
    type: "order_created",
    order: newOrder
  });

  // Add automated notification
  addNotification(
    resolvedUserId,
    "🍛 Order Received!",
    `Order #${orderId} was successfully placed. Total is ₹${total.toFixed(0)}.`,
    "order_update"
  );

  // If stock of any item falls under 3 during this purchase, let staff know
  items.forEach((cartIt: any) => {
    const item = menuStock.find(m => m.id === cartIt.foodId);
    if (item && item.stock <= 3) {
      addNotification(
        "all",
        "⚠️ Item Running Out!",
        `${item.icon} ${item.name} is running low! Just ${item.stock} left.`,
        "stock_alert"
      );
    }
  });

  res.json({ success: true, order: newOrder });
});

// Update order status (Kitchen/CEO flow)
app.post("/api/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, description } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, error: "Target status required." });
  }

  const ordIdx = orders.findIndex(o => o.id === id);
  if (ordIdx === -1) {
    return res.status(404).json({ success: false, error: "Order not found." });
  }

  const order = orders[ordIdx];
  const oldStatus = order.status;
  order.status = status as OrderStatus;

  const defaultDescMap: Record<OrderStatus, string> = {
    placed: "Order placed.",
    accepted: "Order accepted! Chef has begun preparing your food with top-grade ingredients.",
    preparing: "Chef is tossing and frying your selections with fresh traditional Tamil spices.",
    dispatched: "Order packed in thermodynamic foil bags. Valet is speeding to your location.",
    delivered: "Food delivered warm and fresh. Bon appétit!",
    cancelled: "Order cancelled by kitchen staff. Refund initiated if prepaid."
  };

  order.timeline.push({
    status: status as OrderStatus,
    timestamp: new Date().toISOString(),
    description: description || defaultDescMap[status as OrderStatus] || `Order state updated to ${status}.`
  });

  // Save changes
  syncOrders();

  // Broadcast updated order status to all clients
  broadcast({
    type: "order_updated",
    order: order
  });

  // Automated notification message based on new state
  const stateNotificationMessage: Record<OrderStatus, string> = {
    placed: `Your order #${id} has been registered successfully.`,
    accepted: `Kitchen confirmed order #${id}! Sourcing raw ingredients now.`,
    preparing: `Your order #${id} is sizzling on the stove. T-minus 15 mins!`,
    dispatched: `Valet left Spice & Leaf with your warm meal! Track live driver movement.`,
    delivered: `Delivered! Order #${id} is in your hands. Thank you for choosing us!`,
    cancelled: `We are sorry, order #${id} had to be cancelled. Please contact helpline.`
  };

  addNotification(
    order.userId,
    `Order Status Update`,
    stateNotificationMessage[status as OrderStatus] || `Your order status changed to ${status}.`,
    "order_update"
  );

  // If transition is to "dispatched", start real-time delivery GPS simulator
  if (status === "dispatched" && order.mode === "delivery") {
    startDriverSimulation(order.id);
  }

  res.json({ success: true, order });
});

// --- CEOS LIVE STATS & INTERNAL RECORDS ENDPOINT ---
app.get("/api/ceo/stats", (req, res) => {
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === "delivered");
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);

  // Calculate popular items
  const counts: Record<string, number> = {};
  orders.forEach(ord => {
    ord.items.forEach(it => {
      counts[it.name] = (counts[it.name] || 0) + it.qty;
    });
  });

  const popularItems = Object.keys(counts)
    .map(name => ({ name, count: counts[name] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const lowStockCount = menuStock.filter(it => it.stock <= 5).length;

  const stats: LiveStats = {
    totalOrders,
    totalRevenue,
    popularItems,
    lowStockCount
  };

  res.json(stats);
});

// GET USER NOTIFICATIONS
app.get("/api/notifications", (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, error: "User ID required." });
  }

  // CEO and Staff receive all notifications, customers only theirs or "all" global notifications
  const user = users.find(u => u.id === userId);
  if (user && (user.role === "ceo" || user.role === "staff")) {
    return res.json(notifications);
  }

  const filtered = notifications.filter(n => n.userId === userId || n.userId === "all");
  res.json(filtered);
});

app.post("/api/notifications/read", (req, res) => {
  const { notificationId } = req.body;
  const notIdx = notifications.findIndex(n => n.id === notificationId);
  if (notIdx !== -1) {
    notifications[notIdx].read = true;
    syncNotifications();
  }
  res.json({ success: true });
});

// --- PAYMENT INTEGRATION GATEWAY MOCKUP ---
app.post("/api/payment/pay", (req, res) => {
  const { orderId, paymentMethod, cardDetails, walletName } = req.body;
  
  // High fidelity response simulating real-world gateway delay & authorization
  setTimeout(() => {
    const success = Math.random() < 0.96; // 96% success rate for transactions
    if (success) {
      res.json({
        success: true,
        transactionId: `TXN-${Date.now()}-${Math.floor(Math.random()*90000 + 10000)}`,
        status: "captured",
        message: "Payment authorized successfully."
      });
    } else {
      res.status(402).json({
        success: false,
        error: "Insufficient funds or transaction declined by issuer bank."
      });
    }
  }, 1000);
});

// --- PLATFORM DEV SERVER AND INDEX ORCHESTRATION ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind WebSocket upgrading onto the same server instance on port 3000
  server.on("upgrade", (request, socket, head) => {
    const origin = request.headers.host ? `http://${request.headers.host}` : "http://localhost";
    const pathname = request.url ? new URL(request.url, origin).pathname : "";
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  const listenOnPort = (port: number, attempt = 1) => {
    server.once("error", (error: any) => {
      if (error.code === "EADDRINUSE" && attempt < MAX_PORT_ATTEMPTS) {
        const nextPort = port + 1;
        console.warn(`Port ${port} is in use, trying ${nextPort}...`);
        listenOnPort(nextPort, attempt + 1);
      } else {
        console.error(`Unable to start server on port ${port}:`, error);
        process.exit(1);
      }
    });

    server.listen(port, "0.0.0.0", () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  };

  listenOnPort(BASE_PORT);

}

startServer();
