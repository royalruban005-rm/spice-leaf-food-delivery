import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChefHat, 
  ShoppingBag, 
  TrendingUp, 
  User as UserIcon, 
  MapPin, 
  Bell, 
  Clock, 
  CreditCard, 
  Lock, 
  Shield, 
  Plus, 
  Minus, 
  LogOut, 
  Smartphone, 
  Laptop, 
  CheckCircle, 
  Check, 
  Truck, 
  Sparkles, 
  History, 
  DollarSign, 
  X, 
  ChevronRight, 
  Utensils, 
  AlertTriangle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, FoodItem, CartItem, Order, OrderStatus, Notification, LiveStats, UserRole } from './types';

// Web Audio API custom notification chime
const playChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    // Play dual-tone pleasant synth chime
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12); // A5
    
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    console.warn("Chime block:", e);
  }
};

export default function App() {
  // --- APPLICATION STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'tracker' | 'history' | 'notifications'>('menu');
  const [staffTab, setStaffTab] = useState<'orders' | 'inventory'>('orders');
  const [ceoTab, setCeoTab] = useState<'stats' | 'orders' | 'inventory' | 'users'>('stats');
  
  // Menu and Stock
  const [menu, setMenu] = useState<FoodItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  
  // Customization selection state
  const [custSize, setCustSize] = useState<string | null>(null);
  const [custSpice, setCustSpice] = useState<string | null>(null);
  const [custAddons, setCustAddons] = useState<string[]>([]);
  const [custQty, setCustQty] = useState<number>(1);
  const [custNotes, setCustNotes] = useState<string>("");

  // Cart Drawer
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  
  // Checkout Modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [checkoutMode, setCheckoutMode] = useState<'delivery' | 'pickup'>('delivery');
  const [custName, setCustName] = useState<string>("");
  const [custPhone, setCustPhone] = useState<string>("");
  const [custAddress, setCustAddress] = useState<string>("");
  const [custTable, setCustTable] = useState<string>("");
  const [payMethod, setPayMethod] = useState<'upi' | 'card' | 'cod'>('upi');
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardExpiry, setCardExpiry] = useState<string>("");
  const [cardCvv, setCardCvv] = useState<string>("");
  
  // Active trackers and orders logs
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedTrackerOrder, setSelectedTrackerOrder] = useState<Order | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toastAlerts, setToastAlerts] = useState<{ id: string; title: string; message: string; type: string }[]>([]);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [userList, setUserList] = useState<User[]>([]);

  // Device Framework Shell simulation
  const [deviceFrame, setDeviceFrame] = useState<'desktop' | 'ios' | 'android'>('desktop');

  // Manual Login forms
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [regName, setRegName] = useState<string>("");
  const [regEmail, setRegEmail] = useState<string>("");
  const [regPassword, setRegPassword] = useState<string>("");
  const [regPhone, setRegPhone] = useState<string>("");
  const [regAddress, setRegAddress] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);

  // --- WEBSOCKET ENGINE & DATA BOOTSTRAP ---
  useEffect(() => {
    // Fetch initial menu
    fetch("/api/menu")
      .then(res => res.json())
      .then(data => setMenu(data))
      .catch(err => console.error("Error fetching menu:", err));

    // Establish persistent WebSocket connection on port 3000
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const connectWS = () => {
      console.log("Connecting WS to:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          console.log("Received WS event:", payload);

          if (payload.type === "initial_stock") {
            setMenu(payload.menu);
          } else if (payload.type === "stock_updated") {
            setMenu(prev => {
              return prev.map(item => item.id === payload.itemId ? { ...item, stock: payload.stock } : item
              );
            });
          } else if (payload.type === "batch_stock_updated") {
            setMenu(payload.menu);
          } else if (payload.type === "order_created") {
            setOrders(prev => [payload.order, ...prev]);
            // If recipient is Staff or CEO, alert with a visual toast
            playChime();
            addToast("🔔 New Customer Order!", `Order #${payload.order.id} was placed by ${payload.order.customerName}.`, "system");
          } else if (payload.type === "order_updated") {
            setOrders(prev => prev.map(o => o.id === payload.order.id ? payload.order : o));
            // Sync with current tracked order if applicable
            setSelectedTrackerOrder(prev => prev && prev.id === payload.order.id ? payload.order : prev);
            
            // Send visual push notification
            playChime();
            addToast("🍛 Order Status Update", `Order #${payload.order.id} is now [${payload.order.status.toUpperCase()}].`, "order_update");
          } else if (payload.type === "driver_moved") {
            setOrders(prev => prev.map(o => 
              o.id === payload.orderId ? { ...o, driverLocation: payload.driverLocation } : o
            ));
            setSelectedTrackerOrder(prev => 
              prev && prev.id === payload.orderId ? { ...prev, driverLocation: payload.driverLocation } : prev
            );
          } else if (payload.type === "new_notification") {
            setNotifications(prev => [payload.notification, ...prev]);
            playChime();
            addToast(payload.notification.title, payload.notification.message, payload.notification.type);
          }
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      ws.onclose = () => {
        console.warn("WS disconnected. Reconnecting in 5s...");
        setTimeout(connectWS, 5000);
      };
    };

    connectWS();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Fetch contextual stats/lists based on role
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.role === "ceo") {
      fetch("/api/ceo/stats")
        .then(res => res.json())
        .then(data => setLiveStats(data))
        .catch(err => console.error(err));

      fetch("/api/auth/users")
        .then(res => res.json())
        .then(data => setUserList(data))
        .catch(err => console.error(err));
    }

    // Load active logs
    const url = currentUser.role === "customer" ? `/api/orders?userId=${currentUser.id}` : "/api/orders";
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setOrders(data);
        // Default to active tracker order if customer has active orders
        if (currentUser.role === "customer") {
          const active = data.find((o: Order) => o.status !== "delivered" && o.status !== "cancelled");
          if (active) {
            setSelectedTrackerOrder(active);
            setActiveTab('tracker');
          }
        }
      })
      .catch(err => console.error(err));

    // Load user notification alerts
    fetch(`/api/notifications?userId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => setNotifications(data))
      .catch(err => console.error(err));

  }, [currentUser]);

  // Recalculate Live CEO stats whenever orders array updates on server
  useEffect(() => {
    if (currentUser?.role === "ceo" && orders.length) {
      fetch("/api/ceo/stats")
        .then(res => res.json())
        .then(data => setLiveStats(data))
        .catch(err => console.error(err));
    }
  }, [orders, currentUser]);

  // Helper to construct local overlay alert toasts
  const addToast = (title: string, message: string, type: string) => {
    const id = `toast-${Date.now()}`;
    setToastAlerts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToastAlerts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // --- AUTH ACTIONS ---
  const handleDemoLogin = async (role: UserRole) => {
    let email = "customer@spiceandleaf.com";
    if (role === "staff") email = "staff@spiceandleaf.com";
    if (role === "ceo") email = "ceo@spiceandleaf.com";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: `${role}123` })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        setAuthToken(data.token);
        // Reset navigation
        setActiveTab('menu');
        setLoginError("");
        addToast(`🔑 Welcome, ${data.user.name}!`, `Logged in securely as ${role.toUpperCase()}.`, "system");
      } else {
        setLoginError(data.error);
      }
    } catch (err) {
      setLoginError("Failed to communicate with auth server.");
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter your credentials.");
      return;
    }
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        setAuthToken(data.token);
        setActiveTab('menu');
        setLoginError("");
        addToast(`🔑 Welcome Back, ${data.user.name}!`, `Role-based session created.`, "system");
      } else {
        setLoginError(data.error);
      }
    } catch (err) {
      setLoginError("Incorrect credentials or server offline.");
    }
  };

  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) {
      setLoginError("Name, Email, and Password are required.");
      return;
    }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          phone: regPhone,
          address: regAddress
        })
      });
      const data = await res.json();
      if (data.success) {
        // Auto login
        setCurrentUser(data.user);
        setIsRegistering(false);
        setLoginError("");
        addToast("🎉 Account Created!", "You can now order delicious Tamil specials.", "system");
      } else {
        setLoginError(data.error);
      }
    } catch (err) {
      setLoginError("Registration failed.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthToken(null);
    setCart([]);
    setOrders([]);
    setSelectedTrackerOrder(null);
    addToast("🚪 Logged Out", "Session destroyed safely.", "system");
  };

  // --- CART CALCULATIONS ---
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [cart]);

  const tax = useMemo(() => {
    return subtotal * 0.05; // GST 5%
  }, [subtotal]);

  const deliveryFee = useMemo(() => {
    if (subtotal === 0 || checkoutMode === "pickup") return 0;
    return subtotal >= 299 ? 0 : 30; // Free delivery over 299
  }, [subtotal, checkoutMode]);

  const grandTotal = useMemo(() => {
    return subtotal + tax + deliveryFee;
  }, [subtotal, tax, deliveryFee]);

  // --- CUSTOMIZER ACTIONS ---
  const openCustomizer = (food: FoodItem) => {
    if (food.stock <= 0) {
      addToast("⚠️ Sold Out!", `${food.name} is currently out of stock.`, "system");
      return;
    }
    setSelectedFood(food);
    setCustSize(food.sizes ? food.sizes[food.sizes.length - 1].id : null);
    setCustSpice(food.spice ? 'Medium' : null);
    setCustAddons([]);
    setCustQty(1);
    setCustNotes("");
  };

  const handleAddonToggle = (addonId: string) => {
    setCustAddons(prev => 
      prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]
    );
  };

  const customizedUnitPrice = useMemo(() => {
    if (!selectedFood) return 0;
    let base = selectedFood.price;
    if (selectedFood.sizes && custSize) {
      const s = selectedFood.sizes.find(sz => sz.id === custSize);
      if (s) base = base * s.mult;
    }
    let extra = 0;
    if (selectedFood.addons) {
      selectedFood.addons.forEach(ad => {
        if (custAddons.includes(ad.id)) extra += ad.price;
      });
    }
    return base + extra;
  }, [selectedFood, custSize, custAddons]);

  const handleAddToCart = () => {
    if (!selectedFood) return;

    const sizeObj = selectedFood.sizes?.find(s => s.id === custSize);
    const addonsSelected = selectedFood.addons?.filter(a => custAddons.includes(a.id)) || [];

    const cartItem: CartItem = {
      cartId: `cart-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      foodId: selectedFood.id,
      name: selectedFood.name,
      icon: selectedFood.icon,
      price: customizedUnitPrice,
      qty: custQty,
      sizeLabel: sizeObj?.label,
      spiceLevel: custSpice || undefined,
      addonsSelected,
      notes: custNotes || undefined
    };

    setCart(prev => [...prev, cartItem]);
    setSelectedFood(null);
    setIsCartOpen(true);
    addToast("🛒 Item Added!", `${custQty}x ${selectedFood.name} added to your cart.`, "system");
  };

  // --- ORDER PLACEMENT FLOW ---
  const handleOpenCheckout = () => {
    if (currentUser) {
      setCustName(currentUser.name);
      setCustPhone(currentUser.phone || "");
      setCustAddress(currentUser.address || "");
    }
    setIsCheckoutOpen(true);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone || (checkoutMode === "delivery" && !custAddress)) {
      addToast("⚠️ Validation Failed", "Please fill in all recipient contact details.", "system");
      return;
    }

    setIsPaying(true);

    // Mock integrated payment gateway transaction
    if (payMethod !== "cod") {
      try {
        const payRes = await fetch("/api/payment/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: `SL-MOCK-${Date.now()}`,
            paymentMethod: payMethod,
            cardDetails: payMethod === "card" ? { cardNumber, cardExpiry, cardCvv } : null
          })
        });
        const payData = await payRes.json();
        if (!payData.success) {
          addToast("❌ Payment Declined", payData.error, "system");
          setIsPaying(false);
          return;
        }
      } catch (err) {
        addToast("❌ Gateway Connection Error", "Unable to communicate with checkout gateway.", "system");
        setIsPaying(false);
        return;
      }
    }

    // Connect and place order on backend
    try {
      const orderBody = {
        userId: currentUser?.id || `guest-${Date.now()}`,
        customerName: custName,
        customerPhone: custPhone,
        customerAddress: custAddress,
        mode: checkoutMode,
        items: cart,
        subtotal,
        tax,
        deliveryFee,
        total: grandTotal,
        paymentMethod: payMethod
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderBody)
      });
      const data = await res.json();

      if (data.success) {
        const orderCreated: Order = data.order;
        setCart([]);
        setIsCheckoutOpen(false);
        setIsPaying(false);
        setIsCartOpen(false);

        // Fetch freshly updated menu & orders state
        setOrders(prev => [orderCreated, ...prev]);
        setSelectedTrackerOrder(orderCreated);
        setActiveTab('tracker');

        playChime();
        addToast("🎉 Order Placed!", `Your order #${orderCreated.id} is now in queue!`, "order_update");
      } else {
        addToast("⚠️ Shortage / Stock Alert", data.error, "system");
        setIsPaying(false);
      }
    } catch (err) {
      addToast("❌ Placement Failure", "Check server connectivity.", "system");
      setIsPaying(false);
    }
  };

  // --- KITCHEN STAFF ACTIONS ---
  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        addToast("✅ Status Updated", `Order #${orderId} moved to ${nextStatus.toUpperCase()}`, "order_update");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- INVENTORY ADJUSTER ---
  const handleModifyStock = async (itemId: string, qty: number) => {
    try {
      const res = await fetch("/api/stock/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, stock: qty })
      });
      const data = await res.json();
      if (data.success) {
        setMenu(prev => prev.map(item => item.id === itemId ? data.item : item));
        addToast("✏️ Stock Updated", `${data.item.name} set to ${qty} remaining.`, "system");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter items in the browser
  const filteredMenu = useMemo(() => {
    return menu.filter(item => activeCategory === "all" || item.category === activeCategory);
  }, [menu, activeCategory]);

  const categories = [
    { id: 'all', label: 'All Dishes' },
    { id: 'starters', label: 'Starters' },
    { id: 'southindian', label: 'South Indian Specials' },
    { id: 'mains', label: 'North Indian Mains' },
    { id: 'beverages', label: 'Beverages' },
    { id: 'desserts', label: 'Desserts' }
  ];

  // Helper to mark notification as read
  const markAsRead = (id: string) => {
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id })
    })
    .then(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    });
  };

  // Render the entire inner UI of the workspace
  const renderCoreUI = () => {
    if (!currentUser) {
      // Return login page with clean cards & 1-click bypasses
      return (
        <div className="flex flex-col items-center justify-center py-6 px-4 bg-amber-50/50 min-h-full">
          <div className="w-full max-w-md bg-white rounded-3xl border border-amber-900/10 shadow-2xl overflow-hidden p-8">
            <div className="text-center mb-8">
              <span className="text-4xl">🌿</span>
              <h2 className="font-serif font-bold text-3xl text-amber-950 mt-2">Spice & Leaf</h2>
              <p className="text-amber-900/60 text-sm mt-1">Role-Based Order Platform & Real-Time Tracker</p>
            </div>

            {loginError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2.5 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{loginError}</span>
              </div>
            )}

            {!isRegistering ? (
              <form onSubmit={handleManualLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-amber-900/70 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="E.g. customer@spiceandleaf.com"
                    className="w-full bg-amber-50/30 border border-amber-950/15 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-700 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-900/70 mb-1">Password</label>
                  <input 
                    type="password" 
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="w-full bg-amber-50/30 border border-amber-950/15 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-700 font-sans"
                  />
                </div>
                <button type="submit" className="w-full bg-red-700 text-white font-semibold py-3 rounded-xl hover:bg-red-800 transition-colors cursor-pointer text-sm">
                  Sign In Securely
                </button>
                <div className="text-center mt-4 text-xs text-amber-900/60">
                  Don't have an account?{" "}
                  <button type="button" onClick={() => setIsRegistering(true)} className="text-red-700 font-bold hover:underline cursor-pointer">
                    Register Customer
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleManualRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-amber-900/70 mb-0.5">Full Name</label>
                  <input 
                    type="text" 
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="E.g. Ramesh Kannan"
                    className="w-full bg-amber-50/30 border border-amber-950/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-900/70 mb-0.5">Email Address</label>
                  <input 
                    type="email" 
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="customer@spiceandleaf.com"
                    className="w-full bg-amber-50/30 border border-amber-950/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-900/70 mb-0.5">Password</label>
                  <input 
                    type="password" 
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Min 6 characters (e.g. customer123)"
                    className="w-full bg-amber-50/30 border border-amber-950/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-amber-900/70 mb-0.5">Phone Number</label>
                    <input 
                      type="text" 
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-amber-50/30 border border-amber-950/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-amber-900/70 mb-0.5">Default Table / Flat</label>
                    <input 
                      type="text" 
                      value={regAddress}
                      onChange={e => setRegAddress(e.target.value)}
                      placeholder="E.g. Flat 3A or Table 14"
                      className="w-full bg-amber-50/30 border border-amber-950/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-700"
                    />
                  </div>
                </div>
                <button type="submit" className="w-full bg-amber-950 text-white font-semibold py-2.5 rounded-xl hover:bg-amber-900 transition-colors cursor-pointer text-xs mt-2">
                  Create Customer Account
                </button>
                <div className="text-center mt-3 text-xs text-amber-900/60">
                  Already registered?{" "}
                  <button type="button" onClick={() => setIsRegistering(false)} className="text-red-700 font-bold hover:underline cursor-pointer">
                    Sign In instead
                  </button>
                </div>
              </form>
            )}

            {/* Premium 1-Click Sandbox Portals */}
            <div className="mt-8 border-t border-amber-900/10 pt-6">
              <span className="block text-center text-xs text-amber-900/50 uppercase tracking-widest font-mono mb-4">
                🚀 One-Click Demo Logins
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => handleDemoLogin('customer')} 
                  className="bg-red-50 border border-red-200 hover:bg-red-100/70 text-red-900 text-xs py-2 px-1.5 rounded-xl flex flex-col items-center gap-1.5 cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 text-red-700" />
                  <span className="font-semibold text-[10px]">Customer</span>
                </button>
                <button 
                  onClick={() => handleDemoLogin('staff')} 
                  className="bg-amber-50 border border-amber-200 hover:bg-amber-100/70 text-amber-900 text-xs py-2 px-1.5 rounded-xl flex flex-col items-center gap-1.5 cursor-pointer"
                >
                  <ChefHat className="w-4 h-4 text-amber-700" />
                  <span className="font-semibold text-[10px]">Staff/Chef</span>
                </button>
                <button 
                  onClick={() => handleDemoLogin('ceo')} 
                  className="bg-purple-50 border border-purple-200 hover:bg-purple-100/70 text-purple-900 text-xs py-2 px-1.5 rounded-xl flex flex-col items-center gap-1.5 cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-purple-700" />
                  <span className="font-semibold text-[10px]">Management CEO</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Role-based customer rendering
    if (currentUser.role === "customer") {
      return (
        <div className="flex flex-col h-full bg-amber-50/10">
          {/* Main Content Pane */}
          <div className="flex-1 overflow-y-auto pb-24 px-4 py-4 max-w-5xl mx-auto w-full">
            {activeTab === 'menu' && (
              <div className="space-y-6">
                {/* Hero promo message */}
                <div className="bg-gradient-to-r from-amber-950 to-amber-900 text-amber-50 p-6 rounded-3xl relative overflow-hidden shadow-lg border border-amber-800/20">
                  <div className="max-w-md relative z-10">
                    <span className="inline-block bg-amber-400/20 text-amber-300 font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-full mb-2">
                      ⚡ Ghee Specials Today
                    </span>
                    <h3 className="font-serif font-bold text-xl md:text-2xl text-white">Legendary Madurai Taste</h3>
                    <p className="text-amber-100/70 text-xs md:text-sm mt-1">Dial in your spice, portion sizes, and custom toppings on every single order. Track deliveries in real time!</p>
                  </div>
                  <span className="absolute right-4 bottom-2 text-7xl opacity-15 pointer-events-none select-none">🍛</span>
                </div>

                {/* Categories Scrollbar */}
                <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-4 py-2 rounded-full font-semibold text-xs whitespace-nowrap transition-all border cursor-pointer ${
                        activeCategory === cat.id 
                          ? 'bg-amber-950 text-white border-amber-950 shadow-md' 
                          : 'bg-white text-amber-900/70 border-amber-950/10 hover:border-amber-950/30'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMenu.map(food => {
                    const lowStock = food.stock > 0 && food.stock <= 5;
                    return (
                      <div 
                        key={food.id}
                        className={`bg-white rounded-2xl border border-amber-950/5 p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all relative ${
                          food.stock <= 0 ? 'opacity-65' : ''
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-3xl bg-amber-50 w-12 h-12 rounded-xl flex items-center justify-center border border-amber-900/5">
                              {food.icon}
                            </span>
                            <div className="text-right">
                              {food.stock <= 0 ? (
                                <span className="bg-red-50 text-red-700 text-[10px] font-mono font-bold px-2 py-1 rounded-full border border-red-200">
                                  Sold Out
                                </span>
                              ) : lowStock ? (
                                <span className="bg-orange-50 text-orange-700 text-[10px] font-mono font-bold px-2 py-1 rounded-full border border-orange-200 animate-pulse">
                                  Only {food.stock} Left!
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-mono px-2 py-1 rounded-full border border-emerald-200">
                                  In Stock
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3">
                            <h4 className="font-serif font-bold text-amber-950 text-base flex items-center gap-1.5">
                              <span className={`w-3 h-3 border rounded-sm flex-shrink-0 inline-flex items-center justify-center p-0.5 ${
                                food.veg ? 'border-emerald-600' : 'border-red-600'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${food.veg ? 'bg-emerald-600' : 'bg-red-600'}`}></span>
                              </span>
                              {food.name}
                            </h4>
                            <p className="text-amber-900/60 text-xs mt-1 line-clamp-2">{food.desc}</p>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-amber-900/5 flex items-center justify-between gap-4">
                          <span className="font-mono font-bold text-amber-950 text-base">₹{food.price}</span>
                          <button
                            onClick={() => openCustomizer(food)}
                            disabled={food.stock <= 0}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                              food.stock <= 0 
                                ? 'bg-amber-100 text-amber-900/40 cursor-not-allowed' 
                                : 'bg-red-700 text-white hover:bg-red-800 shadow-sm hover:shadow'
                            }`}
                          >
                            Customise & Add
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'tracker' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif font-bold text-xl text-amber-950">Real-Time Delivery Tracker</h3>
                  <select 
                    className="bg-white border border-amber-950/10 text-xs font-semibold rounded-lg px-2 py-1 focus:outline-none"
                    value={selectedTrackerOrder?.id || ""}
                    onChange={e => {
                      const found = orders.find(o => o.id === e.target.value);
                      if (found) setSelectedTrackerOrder(found);
                    }}
                  >
                    <option value="">-- Select Active Order --</option>
                    {orders.filter(o => o.status !== "delivered" && o.status !== "cancelled").map(o => (
                      <option key={o.id} value={o.id}>Order #{o.id}</option>
                    ))}
                  </select>
                </div>

                {selectedTrackerOrder ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Status progress panel */}
                    <div className="bg-white rounded-3xl border border-amber-950/10 p-5 shadow-sm space-y-4">
                      <div className="flex justify-between items-start border-b border-amber-900/5 pb-3">
                        <div>
                          <span className="text-xs font-mono text-amber-900/40">ORDER REFERENCE</span>
                          <h4 className="font-mono font-bold text-sm text-amber-950">#{selectedTrackerOrder.id}</h4>
                        </div>
                        <span className="bg-amber-100 text-amber-950 font-mono text-xs px-2.5 py-1 rounded-full uppercase font-semibold">
                          {selectedTrackerOrder.status}
                        </span>
                      </div>

                      {/* Line steps for each stage */}
                      <div className="relative pl-6 space-y-4">
                        {/* Vertical timeline connector */}
                        <div className="absolute left-2.5 top-1.5 bottom-1.5 w-[2px] bg-amber-900/10"></div>
                        
                        {[
                          { key: 'placed', label: 'Order Registered', desc: 'Received & authorized' },
                          { key: 'accepted', label: 'Accepted by Kitchen', desc: 'Chefs verifying inventory' },
                          { key: 'preparing', label: 'Sizzling on Stove', desc: 'Being prepared with local spices' },
                          { key: 'dispatched', label: 'Dispatched / En Route', desc: 'Thermodynamic travel bags' },
                          { key: 'delivered', label: 'Arrived & Handed over', desc: 'Bon appétit!' }
                        ].map((step, idx) => {
                          const stages = ['placed', 'accepted', 'preparing', 'dispatched', 'delivered'];
                          const currentIdx = stages.indexOf(selectedTrackerOrder.status);
                          const stepIdx = stages.indexOf(step.key);
                          const isDone = stepIdx <= currentIdx && selectedTrackerOrder.status !== 'cancelled';
                          const isCurrent = step.key === selectedTrackerOrder.status;

                          return (
                            <div key={step.key} className="relative">
                              {/* Dot overlay */}
                              <span className={`absolute -left-[20px] top-1 w-3 h-3 rounded-full border-2 ${
                                isCurrent 
                                  ? 'bg-red-700 border-red-700 ring-4 ring-red-100 animate-pulse' 
                                  : isDone 
                                    ? 'bg-emerald-600 border-emerald-600' 
                                    : 'bg-white border-amber-900/20'
                              }`}></span>
                              <div className="pl-2">
                                <h5 className={`text-xs font-bold ${isCurrent ? 'text-red-800' : isDone ? 'text-emerald-800' : 'text-amber-950/50'}`}>
                                  {step.label}
                                </h5>
                                <p className="text-[10px] text-amber-900/50 mt-0.5">{step.desc}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* GPS Delivery driver simulation radar map */}
                    <div className="bg-white rounded-3xl border border-amber-950/10 p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        <h4 className="font-serif font-bold text-sm text-amber-950">Live GPS Radar Simulator</h4>
                        <p className="text-amber-900/50 text-xs mt-0.5">Physical telemetry of associate traveling from Town Hall Road.</p>
                      </div>

                      {selectedTrackerOrder.mode === 'pickup' ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-amber-950/40">
                          <span className="text-3xl">🥡</span>
                          <span className="font-semibold text-xs mt-2">Self Pickup Order</span>
                          <span className="text-[10px] mt-1">Please proceed to counter once notified that kitchen preparation is complete.</span>
                        </div>
                      ) : selectedTrackerOrder.status === 'dispatched' || selectedTrackerOrder.status === 'delivered' ? (
                        <div className="flex-1 py-4 space-y-4">
                          {/* Simulated Radar Route Map Grid */}
                          <div className="h-44 bg-amber-50/60 rounded-2xl border border-amber-900/5 relative overflow-hidden flex flex-col justify-between p-3 font-mono text-[9px]">
                            {/* Gridlines */}
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#efe8da_1px,transparent_1px),linear-gradient(to_bottom,#efe8da_1px,transparent_1px)] bg-[size:24px_24px] opacity-40"></div>
                            
                            {/* Route path */}
                            <svg className="absolute inset-0 w-full h-full opacity-60 pointer-events-none">
                              <path d="M 20 150 L 150 80 L 280 40" fill="none" stroke="#b45309" strokeWidth="2" strokeDasharray="4 4" />
                            </svg>

                            {/* Resturant Hub */}
                            <div className="absolute left-[20px] bottom-[20px] flex flex-col items-center z-10">
                              <span className="text-base">🌿</span>
                              <span className="bg-amber-950 text-[8px] text-white px-1 py-0.5 rounded shadow mt-0.5">Spice&Leaf</span>
                            </div>

                            {/* Moving Driver Courier Node */}
                            <div 
                              className="absolute transition-all duration-1000 flex flex-col items-center z-20"
                              style={{
                                left: `${20 + (260 * (selectedTrackerOrder.driverLocation?.progress || 0)) / 100}px`,
                                bottom: `${20 + (120 * (selectedTrackerOrder.driverLocation?.progress || 0)) / 100}px`
                              }}
                            >
                              <span className="text-base animate-bounce">🚴</span>
                              <span className="bg-red-700 text-[8px] text-white px-1 py-0.5 rounded shadow mt-0.5 font-bold animate-pulse">
                                Valet ({selectedTrackerOrder.driverLocation?.progress || 0}%)
                              </span>
                            </div>

                            {/* Customer Home */}
                            <div className="absolute right-[20px] top-[20px] flex flex-col items-center z-10">
                              <span className="text-base">🏠</span>
                              <span className="bg-amber-900 text-[8px] text-amber-50 px-1.5 py-0.5 rounded shadow mt-0.5">You</span>
                            </div>
                          </div>

                          {/* Progress tracker info */}
                          <div className="flex justify-between text-xs text-amber-950 font-mono border-t border-amber-900/5 pt-3">
                            <div>
                              <span className="block text-amber-900/40 text-[10px]">COURIER GPS</span>
                              <span className="font-bold">Lat: {selectedTrackerOrder.driverLocation?.lat.toFixed(4) || "9.9252"}, Lng: {selectedTrackerOrder.driverLocation?.lng.toFixed(4) || "78.1198"}</span>
                            </div>
                            <div className="text-right">
                              <span className="block text-amber-900/40 text-[10px]">APPROX. ETA</span>
                              <span className="font-bold text-red-700">
                                {selectedTrackerOrder.status === 'delivered' ? 'Arrived!' : `${Math.max(1, Math.round((100 - (selectedTrackerOrder.driverLocation?.progress || 0)) * 0.2))} mins`}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-amber-950/40">
                          <span className="text-3xl animate-pulse">🍲</span>
                          <span className="font-semibold text-xs mt-2">Food Is Prepping</span>
                          <span className="text-[10px] mt-1">Associate tracking details & live route maps will emerge instantly as the order is dispatched.</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-amber-950/10 p-12 text-center text-amber-950/40">
                    <span className="text-4xl">⏱️</span>
                    <h4 className="font-serif font-bold text-sm text-amber-950 mt-2">No Active Orders Tracked</h4>
                    <p className="text-[10px] mt-1">Please place a new order on the Menu to view physical route progress.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                <h3 className="font-serif font-bold text-xl text-amber-950">Your Order History</h3>
                
                {orders.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-amber-950/10 p-8 text-center text-amber-950/40">
                    <span className="text-3xl">🍲</span>
                    <p className="text-xs font-semibold mt-2">No previous orders logged.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map(order => (
                      <div key={order.id} className="bg-white rounded-2xl border border-amber-950/5 p-4 shadow-sm space-y-3">
                        <div className="flex justify-between items-center border-b border-amber-900/5 pb-2">
                          <div>
                            <span className="text-[10px] font-mono text-amber-900/40">ORDER #{order.id}</span>
                            <span className="block text-[10px] text-amber-900/40">{new Date(order.timestamp).toLocaleString()}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                            order.status === 'delivered' 
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                              : order.status === 'cancelled'
                                ? 'bg-red-50 text-red-800 border border-red-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {order.status}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="space-y-1">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="text-amber-900/70">{it.qty}x {it.name} <span className="text-[10px] font-mono text-amber-900/40">({it.sizeLabel || "Reg"})</span></span>
                              <span className="font-mono text-amber-950/80">₹{it.price * it.qty}</span>
                            </div>
                          ))}
                        </div>

                        {/* Subtotal metrics */}
                        <div className="flex justify-between items-center text-xs font-bold text-amber-950 border-t border-amber-900/5 pt-2 font-mono">
                          <span>Total Paid ({order.paymentMethod.toUpperCase()})</span>
                          <span>₹{order.total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-4">
                <h3 className="font-serif font-bold text-xl text-amber-950">Notification Center</h3>
                
                {notifications.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-amber-950/10 p-8 text-center text-amber-950/40">
                    <span className="text-3xl">📭</span>
                    <p className="text-xs font-semibold mt-2">Inbox is empty.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map(notif => (
                      <div 
                        key={notif.id}
                        onClick={() => !notif.read && markAsRead(notif.id)}
                        className={`bg-white rounded-2xl border p-4 shadow-sm flex items-start gap-3 transition-colors cursor-pointer ${
                          notif.read ? 'border-amber-950/5 opacity-75' : 'border-red-500/30 bg-red-50/5'
                        }`}
                      >
                        <span className="text-2xl mt-0.5">
                          {notif.type === 'order_update' ? '🍛' : notif.type === 'stock_alert' ? '⚠️' : '🔔'}
                        </span>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-xs text-amber-950">{notif.title}</h4>
                            <span className="text-[9px] font-mono text-amber-900/40">
                              {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-amber-900/60 mt-1">{notif.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Persistent Customer Bottom Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-amber-950/10 z-40 max-w-5xl mx-auto rounded-t-3xl shadow-lg">
            <div className="flex justify-around items-center py-2.5 px-2">
              <button 
                onClick={() => setActiveTab('menu')}
                className={`flex flex-col items-center gap-1 py-1 px-3 text-xs font-bold cursor-pointer transition-all ${
                  activeTab === 'menu' ? 'text-red-700 scale-105' : 'text-amber-950/50 hover:text-amber-950/80'
                }`}
              >
                <Utensils className="w-5 h-5" />
                <span>Menu</span>
              </button>
              
              <button 
                onClick={() => setActiveTab('tracker')}
                className={`flex flex-col items-center gap-1 py-1 px-3 text-xs font-bold cursor-pointer transition-all ${
                  activeTab === 'tracker' ? 'text-red-700 scale-105' : 'text-amber-950/50 hover:text-amber-950/80'
                }`}
              >
                <Clock className="w-5 h-5" />
                <span>Tracker</span>
              </button>

              {/* Dynamic Cart Bubble Trigger */}
              <button 
                onClick={() => setIsCartOpen(true)}
                className="bg-red-700 text-white rounded-full p-4 -mt-8 shadow-lg hover:bg-red-800 transition-all flex items-center justify-center relative cursor-pointer"
              >
                <ShoppingBag className="w-5 h-5" />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-amber-950 font-mono text-[9px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                    {cart.reduce((n, it) => n + it.qty, 0)}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setActiveTab('history')}
                className={`flex flex-col items-center gap-1 py-1 px-3 text-xs font-bold cursor-pointer transition-all ${
                  activeTab === 'history' ? 'text-red-700 scale-105' : 'text-amber-950/50 hover:text-amber-950/80'
                }`}
              >
                <History className="w-5 h-5" />
                <span>History</span>
              </button>

              <button 
                onClick={() => setActiveTab('notifications')}
                className={`flex flex-col items-center gap-1 py-1 px-3 text-xs font-bold cursor-pointer transition-all relative ${
                  activeTab === 'notifications' ? 'text-red-700 scale-105' : 'text-amber-950/50 hover:text-amber-950/80'
                }`}
              >
                <Bell className="w-5 h-5" />
                <span>Inbox</span>
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1 right-3.5 w-2 h-2 bg-red-600 rounded-full"></span>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Role-based kitchen staff rendering
    if (currentUser.role === "staff") {
      return (
        <div className="flex flex-col h-full bg-amber-50/5 p-4">
          <div className="max-w-5xl mx-auto w-full space-y-4 pb-12">
            <div className="flex items-center justify-between border-b border-amber-900/10 pb-3">
              <div>
                <span className="text-xs uppercase font-mono tracking-widest text-amber-900/40">STAFF WORKSPACE</span>
                <h3 className="font-serif font-bold text-xl text-amber-950 flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-amber-700" />
                  Live Kitchen Dashboard
                </h3>
              </div>
              <div className="bg-white p-0.5 rounded-xl border border-amber-950/10 flex">
                <button 
                  onClick={() => setStaffTab('orders')} 
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                    staffTab === 'orders' ? 'bg-amber-950 text-white shadow-sm' : 'text-amber-950/60'
                  }`}
                >
                  Pending Orders
                </button>
                <button 
                  onClick={() => setStaffTab('inventory')} 
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                    staffTab === 'inventory' ? 'bg-amber-950 text-white shadow-sm' : 'text-amber-950/60'
                  }`}
                >
                  Manage Stock Levels
                </button>
              </div>
            </div>

            {staffTab === 'orders' && (
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-amber-950/10 p-12 text-center text-amber-950/40">
                    <span className="text-4xl">📭</span>
                    <h4 className="font-serif font-bold text-sm text-amber-950 mt-2 font-semibold">Zero Orders In Queue</h4>
                    <p className="text-[10px] mt-1">Waiting for customers to check out items...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {orders.map(order => {
                      const stages: OrderStatus[] = ['placed', 'accepted', 'preparing', 'dispatched', 'delivered'];
                      const currentIdx = stages.indexOf(order.status);
                      const isComplete = order.status === 'delivered' || order.status === 'cancelled';
                      
                      return (
                        <div key={order.id} className="bg-white rounded-3xl border border-amber-950/10 p-5 shadow-sm space-y-3 relative overflow-hidden">
                          {/* Top badge */}
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] font-mono text-amber-900/40">ORDER ID</span>
                              <h4 className="font-mono font-bold text-amber-950 text-sm">#{order.id}</h4>
                              <span className="text-[10px] text-amber-900/50">{new Date(order.timestamp).toLocaleString()}</span>
                            </div>
                            <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase ${
                              order.status === 'placed' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200 animate-pulse' :
                              order.status === 'accepted' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                              order.status === 'preparing' ? 'bg-orange-50 text-orange-800 border border-orange-200' :
                              order.status === 'dispatched' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                              'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              {order.status}
                            </span>
                          </div>

                          {/* Customer coordinates */}
                          <div className="bg-amber-50/50 p-2.5 rounded-xl text-xs space-y-1">
                            <span className="block font-bold text-amber-950">{order.customerName} ({order.customerPhone})</span>
                            <span className="block text-amber-900/60 font-medium">Type: {order.mode.toUpperCase()} · Addr: {order.customerAddress}</span>
                          </div>

                          {/* Items Purchased */}
                          <div className="border-t border-b border-amber-900/5 py-2 space-y-1.5">
                            {order.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between items-start text-xs">
                                <div>
                                  <span className="font-semibold text-amber-950">{it.qty}x {it.name}</span>
                                  <span className="block text-[10px] text-amber-900/40">
                                    Size: {it.sizeLabel || 'Reg'} · Spice: {it.spiceLevel || 'Medium'}
                                    {it.addonsSelected.length > 0 && ` · Addons: ${it.addonsSelected.map(a => a.label).join(', ')}`}
                                    {it.notes && ` · Special note: "${it.notes}"`}
                                  </span>
                                </div>
                                <span className="font-mono text-amber-950/60">₹{it.price * it.qty}</span>
                              </div>
                            ))}
                          </div>

                          {/* Quick stage transition button action */}
                          {!isComplete && (
                            <div className="flex justify-end gap-2 pt-2">
                              {order.status === 'placed' && (
                                <button 
                                  onClick={() => handleUpdateStatus(order.id, 'accepted')}
                                  className="bg-amber-950 text-white hover:bg-amber-900 text-[10px] font-bold px-3.5 py-2 rounded-xl cursor-pointer"
                                >
                                  Accept Order
                                </button>
                              )}
                              {order.status === 'accepted' && (
                                <button 
                                  onClick={() => handleUpdateStatus(order.id, 'preparing')}
                                  className="bg-orange-700 text-white hover:bg-orange-800 text-[10px] font-bold px-3.5 py-2 rounded-xl cursor-pointer"
                                >
                                  Start Cooking
                                </button>
                              )}
                              {order.status === 'preparing' && (
                                <button 
                                  onClick={() => handleUpdateStatus(order.id, 'dispatched')}
                                  className="bg-blue-700 text-white hover:bg-blue-800 text-[10px] font-bold px-3.5 py-2 rounded-xl cursor-pointer animate-pulse"
                                >
                                  Dispatch & Track
                                </button>
                              )}
                              {order.status === 'dispatched' && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-blue-700 font-bold flex items-center gap-1">
                                    <Truck className="w-3.5 h-3.5 animate-bounce" />
                                    Transit ({order.driverLocation?.progress || 0}%)
                                  </span>
                                  <button 
                                    onClick={() => handleUpdateStatus(order.id, 'delivered')}
                                    className="bg-emerald-700 text-white hover:bg-emerald-800 text-[10px] font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                                  >
                                    Hand Deliver
                                  </button>
                                </div>
                              )}
                              
                              <button 
                                onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                                className="bg-red-50 hover:bg-red-100/70 text-red-700 border border-red-200 text-[10px] font-bold px-2.5 py-1.5 rounded-xl cursor-pointer"
                              >
                                Cancel Order
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {staffTab === 'inventory' && (
              <div className="bg-white rounded-3xl border border-amber-950/10 p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-amber-900/5 pb-3">
                  <h4 className="font-serif font-bold text-amber-950">Real-Time Kitchen Inventory</h4>
                  <span className="text-xs text-amber-900/50">Change levels to prevent customer shortages instantly.</span>
                </div>

                <div className="divide-y divide-amber-900/5">
                  {menu.map(food => (
                    <div key={food.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl bg-amber-50 w-10 h-10 rounded-lg border border-amber-900/5 flex items-center justify-center">
                          {food.icon}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-amber-950">{food.name}</span>
                          <span className="block text-[10px] text-amber-900/40">Category: {food.category.toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          food.stock <= 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                          food.stock <= 5 ? 'bg-orange-50 text-orange-700 border border-orange-200 animate-pulse' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {food.stock <= 0 ? 'SOLD OUT' : `${food.stock} Available`}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => handleModifyStock(food.id, Math.max(0, food.stock - 5))}
                            className="bg-amber-100 hover:bg-amber-200/70 text-amber-950 w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer"
                          >
                            -5
                          </button>
                          <input 
                            type="number"
                            min="0"
                            value={food.stock}
                            onChange={(e) => handleModifyStock(food.id, Math.max(0, Number(e.target.value)))}
                            className="w-12 bg-amber-50/50 border border-amber-950/10 text-center text-xs font-bold py-1 rounded-lg focus:outline-none focus:border-amber-700 font-mono"
                          />
                          <button 
                            onClick={() => handleModifyStock(food.id, food.stock + 5)}
                            className="bg-amber-100 hover:bg-amber-200/70 text-amber-950 w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer"
                          >
                            +5
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Role-based CEO Management rendering
    if (currentUser.role === "ceo") {
      return (
        <div className="flex flex-col h-full bg-amber-50/5 p-4">
          <div className="max-w-5xl mx-auto w-full space-y-5 pb-12">
            <div className="flex items-center justify-between border-b border-amber-900/10 pb-3">
              <div>
                <span className="text-xs uppercase font-mono tracking-widest text-purple-900/60 font-bold">EXECUTIVE CEO WORKSPACE</span>
                <h3 className="font-serif font-bold text-xl text-amber-950 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-700" />
                  Management Headquarters
                </h3>
              </div>
              <div className="bg-white p-0.5 rounded-xl border border-amber-950/10 flex text-xs">
                {['stats', 'orders', 'inventory', 'users'].map((t) => (
                  <button 
                    key={t}
                    onClick={() => setCeoTab(t as any)} 
                    className={`px-3 py-1.5 font-bold rounded-lg cursor-pointer uppercase font-mono ${
                      ceoTab === t ? 'bg-purple-950 text-white shadow-sm' : 'text-amber-950/60'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {ceoTab === 'stats' && liveStats && (
              <div className="space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-amber-950 to-amber-900 text-amber-50 rounded-3xl p-5 border border-amber-800/10 shadow flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-amber-300">TOTAL CEO REVENUE</span>
                      <h4 className="text-2xl font-mono font-bold mt-1">₹{liveStats.totalRevenue}</h4>
                      <p className="text-[9px] text-amber-100/50 mt-1">All processed transactions</p>
                    </div>
                    <span className="text-4xl bg-white/10 w-14 h-14 rounded-2xl flex items-center justify-center">💰</span>
                  </div>

                  <div className="bg-white rounded-3xl p-5 border border-amber-950/10 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-amber-900/40">TOTAL ORDERS RECORDED</span>
                      <h4 className="text-2xl font-mono font-bold mt-1 text-amber-950">{liveStats.totalOrders}</h4>
                      <p className="text-[9px] text-amber-900/40 mt-1">Historical operations logs</p>
                    </div>
                    <span className="text-4xl bg-amber-50 w-14 h-14 rounded-2xl border border-amber-900/5 flex items-center justify-center">📋</span>
                  </div>

                  <div className="bg-white rounded-3xl p-5 border border-amber-950/10 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-amber-900/40">LOW STOCK ITEMS</span>
                      <h4 className={`text-2xl font-mono font-bold mt-1 ${liveStats.lowStockCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {liveStats.lowStockCount}
                      </h4>
                      <p className="text-[9px] text-amber-900/40 mt-1">Below 5 servings remaining</p>
                    </div>
                    <span className="text-4xl bg-amber-50 w-14 h-14 rounded-2xl border border-amber-900/5 flex items-center justify-center">⚠️</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Popular items charts */}
                  <div className="bg-white rounded-3xl border border-amber-950/10 p-5 shadow-sm space-y-3">
                    <h4 className="font-serif font-bold text-sm text-amber-950">🔥 Best-Selling Tamil Dishes</h4>
                    <p className="text-[10px] text-amber-900/40">Quantity purchased across all users.</p>
                    
                    <div className="space-y-3 pt-2">
                      {liveStats.popularItems.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-amber-900">
                            <span>{item.name}</span>
                            <span>{item.count} orders</span>
                          </div>
                          <div className="h-2 bg-amber-50 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-700 rounded-full" style={{ width: `${Math.min(100, item.count * 15)}%` }}></div>
                          </div>
                        </div>
                      ))}
                      {liveStats.popularItems.length === 0 && (
                        <p className="text-xs text-amber-950/40 text-center py-6">No historical orders logged yet.</p>
                      )}
                    </div>
                  </div>

                  {/* System operations log */}
                  <div className="bg-white rounded-3xl border border-amber-950/10 p-5 shadow-sm space-y-3">
                    <h4 className="font-serif font-bold text-sm text-amber-950">📋 Real-Time Server Activity Logs</h4>
                    <p className="text-[10px] text-amber-900/40">Physical status overrides broadcast over WS.</p>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pt-2 font-mono text-[10px]">
                      {orders.slice(0, 10).map((ord) => (
                        <div key={ord.id} className="bg-amber-50/50 p-2 rounded-lg text-amber-900 flex justify-between gap-2">
                          <span>Order #{ord.id} changed state to [{ord.status.toUpperCase()}]</span>
                          <span className="text-amber-900/40">{new Date(ord.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                      {orders.length === 0 && (
                        <p className="text-xs text-amber-950/40 text-center py-6">Waiting for activity log broadcasts...</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ceoTab === 'orders' && (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-amber-900/60 uppercase font-mono">Operations log</span>
                {orders.map(order => (
                  <div key={order.id} className="bg-white rounded-2xl border border-amber-950/10 p-4 shadow-sm flex justify-between items-center gap-4 text-xs">
                    <div>
                      <span className="font-mono font-bold text-amber-950">Order #{order.id}</span>
                      <span className="block text-amber-900/40">Customer: {order.customerName} ({order.customerPhone})</span>
                      <span className="block text-amber-900/40">Timestamp: {new Date(order.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-amber-950">₹{order.total}</span>
                      <span className="block text-purple-700 font-bold uppercase tracking-wider text-[9px] mt-0.5">{order.status}</span>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && (
                  <div className="bg-white rounded-2xl p-8 text-center text-amber-950/40 text-xs">No orders logged.</div>
                )}
              </div>
            )}

            {ceoTab === 'inventory' && (
              <div className="bg-white rounded-3xl border border-amber-950/10 p-5 shadow-sm space-y-4">
                <h4 className="font-serif font-bold text-amber-950 border-b border-amber-900/5 pb-2">HQ stock overrides</h4>
                <div className="divide-y divide-amber-900/5">
                  {menu.map(food => (
                    <div key={food.id} className="py-2.5 flex justify-between items-center text-xs">
                      <span className="font-semibold text-amber-950">{food.icon} {food.name}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-amber-900/40">Live stock:</span>
                        <input 
                          type="number" 
                          value={food.stock}
                          onChange={(e) => handleModifyStock(food.id, Math.max(0, Number(e.target.value)))}
                          className="w-12 bg-amber-50/50 text-center border border-amber-950/10 font-bold py-1 rounded"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ceoTab === 'users' && (
              <div className="bg-white rounded-3xl border border-amber-950/10 p-5 shadow-sm space-y-3">
                <h4 className="font-serif font-bold text-amber-950">Database Registered Accounts</h4>
                <p className="text-[10px] text-amber-900/40">All registered system user identities (Simulated / Supabase synced)</p>
                
                <div className="divide-y divide-amber-900/5 pt-2">
                  {userList.map(usr => (
                    <div key={usr.id} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-amber-950">{usr.name}</span>
                        <span className="block text-[10px] text-amber-900/40">Email: {usr.email}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full font-mono text-[9px] uppercase font-bold ${
                        usr.role === 'ceo' ? 'bg-purple-100 text-purple-800' :
                        usr.role === 'staff' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {usr.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-stone-100/50 font-sans">
      {/* Top Header / Branding & Frame Selectors */}
      <header className="bg-amber-950 text-amber-50 py-3 px-4 shadow-lg flex flex-col sm:flex-row gap-3 items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌿</span>
          <div>
            <h1 className="font-serif font-bold text-lg md:text-xl text-white">Spice & Leaf</h1>
            <p className="text-[9px] text-amber-300 font-mono tracking-wider uppercase">Live Operations Workspace</p>
          </div>
        </div>

        {/* Devices simulator frame picker */}
        <div className="flex items-center gap-2 bg-amber-900/60 p-1 rounded-xl border border-amber-800/40 text-[10px] font-mono">
          <button 
            onClick={() => setDeviceFrame('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
              deviceFrame === 'desktop' ? 'bg-amber-950 text-yellow-400 shadow' : 'text-amber-100/60'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>DESKTOP VIEW</span>
          </button>
          <button 
            onClick={() => setDeviceFrame('ios')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
              deviceFrame === 'ios' ? 'bg-amber-950 text-yellow-400 shadow' : 'text-amber-100/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-yellow-500" />
            <span>📱 iOS (IPHONE)</span>
          </button>
          <button 
            onClick={() => setDeviceFrame('android')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
              deviceFrame === 'android' ? 'bg-amber-950 text-yellow-400 shadow' : 'text-amber-100/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
            <span>🤖 ANDROID (PIXEL)</span>
          </button>
        </div>

        {currentUser && (
          <div className="flex items-center gap-3 bg-amber-900/40 py-1.5 px-3 rounded-xl border border-amber-800/40 text-xs">
            <div>
              <span className="block font-bold text-white">{currentUser.name}</span>
              <span className="block text-[9px] text-amber-300 font-mono uppercase font-bold">Role: {currentUser.role}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="hover:text-red-400 transition-colors cursor-pointer p-1"
              title="Logout Safely"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Primary Workspace View Area */}
      <main className="flex-1 flex justify-center items-center py-6 px-4">
        {deviceFrame === 'desktop' ? (
          <div className="w-full max-w-5xl bg-white rounded-3xl border border-amber-900/10 shadow-xl overflow-hidden min-h-[580px] flex flex-col justify-between">
            {renderCoreUI()}
          </div>
        ) : deviceFrame === 'ios' ? (
          /* iOS High Fidelity Bezel Shell */
          <div className="relative w-[375px] h-[780px] bg-[#1a1a1a] rounded-[52px] shadow-2xl p-[11px] border-[5px] border-[#333333] ring-12 ring-black/10 flex flex-col overflow-hidden">
            {/* iOS Speaker & Notch trim */}
            <div className="absolute top-[16px] left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-50 flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-neutral-900 rounded-full mr-2"></span>
              <span className="w-10 h-1 bg-neutral-800 rounded"></span>
            </div>
            {/* Display screen */}
            <div className="flex-1 rounded-[42px] bg-[#fbf8f3] overflow-hidden relative flex flex-col justify-between pt-7">
              {renderCoreUI()}
            </div>
          </div>
        ) : (
          /* Android High-Fidelity Bezel Shell */
          <div className="relative w-[380px] h-[790px] bg-[#0c0c0c] rounded-[44px] shadow-2xl p-[10px] border-[4px] border-[#2c2c2c] ring-12 ring-black/10 flex flex-col overflow-hidden">
            {/* Hole Punch Camera Pin */}
            <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-black rounded-full z-50"></div>
            {/* Display screen */}
            <div className="flex-1 rounded-[34px] bg-[#fbf8f3] overflow-hidden relative flex flex-col justify-between pt-6">
              {renderCoreUI()}
            </div>
          </div>
        )}
      </main>

      {/* --- IN-APP ALERTS & TOASTS OVERLAY --- */}
      <div className="fixed top-16 right-4 z-50 max-w-sm w-full space-y-2 pointer-events-none">
        <AnimatePresence>
          {toastAlerts.map(toast => (
            <motion.div 
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="bg-amber-950 text-white p-4 rounded-2xl border border-amber-800/20 shadow-xl flex items-start gap-3 pointer-events-auto"
            >
              <span className="text-2xl mt-0.5">
                {toast.type === 'order_update' ? '🍛' : toast.type === 'stock_alert' ? '⚠️' : '🔔'}
              </span>
              <div>
                <h4 className="font-bold text-xs text-white">{toast.title}</h4>
                <p className="text-[10px] text-amber-200/80 mt-1 leading-relaxed">{toast.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* --- CUSTOMIZATION MODAL (OVERLAY) --- */}
      <AnimatePresence>
        {selectedFood && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl border border-amber-950/10 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs uppercase font-mono tracking-wider text-amber-900/50">CUSTOMISE DISH</span>
                  <h3 className="font-serif font-bold text-lg text-amber-950 flex items-center gap-1.5 mt-0.5">
                    <span>{selectedFood.icon}</span> {selectedFood.name}
                  </h3>
                </div>
                <button onClick={() => setSelectedFood(null)} className="p-1.5 bg-amber-50 rounded-full text-amber-950 cursor-pointer hover:bg-amber-100">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Portions chooser */}
                {selectedFood.sizes && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-amber-900/60 uppercase tracking-wide">Select Portion Size</label>
                    <div className="flex gap-2">
                      {selectedFood.sizes.map(sz => (
                        <button
                          key={sz.id}
                          onClick={() => setCustSize(sz.id)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                            custSize === sz.id 
                              ? 'bg-amber-950 text-white border-amber-950 shadow-sm' 
                              : 'bg-white text-amber-900/70 border-amber-950/10 hover:border-amber-950/30'
                          }`}
                        >
                          {sz.label} (x{sz.mult})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spice selection */}
                {selectedFood.spice && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-amber-900/60 uppercase tracking-wide">Spice Level</label>
                    <div className="flex gap-2">
                      {['Mild', 'Medium', 'Spicy'].map(spice => (
                        <button
                          key={spice}
                          onClick={() => setCustSpice(spice)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                            custSpice === spice 
                              ? 'bg-red-700 text-white border-red-700 shadow-sm' 
                              : 'bg-white text-amber-900/70 border-amber-950/10 hover:border-amber-950/30'
                          }`}
                        >
                          {spice}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Addons checkbox row */}
                {selectedFood.addons && selectedFood.addons.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-amber-900/60 uppercase tracking-wide">Add Extra Toppings</label>
                    <div className="space-y-1.5">
                      {selectedFood.addons.map(ad => (
                        <label 
                          key={ad.id} 
                          className="flex items-center justify-between p-2.5 rounded-xl border border-amber-950/5 hover:bg-amber-50/50 cursor-pointer text-xs"
                        >
                          <span className="flex items-center gap-2 font-medium text-amber-900">
                            <input 
                              type="checkbox" 
                              checked={custAddons.includes(ad.id)}
                              onChange={() => handleAddonToggle(ad.id)}
                              className="accent-amber-900"
                            />
                            {ad.label}
                          </span>
                          <span className="font-mono text-amber-950/60 font-semibold">+₹{ad.price}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special directions field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-amber-900/60 uppercase tracking-wide">Preparation Instructions</label>
                  <textarea
                    value={custNotes}
                    onChange={e => setCustNotes(e.target.value)}
                    placeholder="E.g. No onion, extra curry leaves, make it extra spicy..."
                    className="w-full bg-amber-50/20 border border-amber-950/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-700 font-sans"
                    rows={2}
                  />
                </div>

                {/* Stepper qty controls */}
                <div className="flex items-center justify-between border-t border-amber-900/5 pt-4 mt-2">
                  <div className="space-y-0.5">
                    <span className="block text-xs font-bold text-amber-900/60 uppercase">Quantity</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setCustQty(prev => Math.max(1, prev - 1))}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-950 w-8 h-8 rounded-full flex items-center justify-center font-bold cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono font-bold text-amber-950 text-sm">{custQty}</span>
                      <button 
                        onClick={() => {
                          if (custQty < selectedFood.stock) setCustQty(prev => prev + 1);
                          else addToast("⚠️ Stock Limit reached", "Cannot purchase more than available servings.", "system");
                        }}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-950 w-8 h-8 rounded-full flex items-center justify-center font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="block text-xs font-semibold text-amber-900/40">TOTAL ITEM PRICE</span>
                    <span className="font-mono font-bold text-amber-950 text-lg">₹{customizedUnitPrice * custQty}</span>
                  </div>
                </div>

                <button 
                  onClick={handleAddToCart}
                  className="w-full bg-red-700 text-white font-bold py-3.5 rounded-xl hover:bg-red-800 transition-colors shadow-lg cursor-pointer text-xs uppercase tracking-wide mt-2"
                >
                  Confirm & Add To Plate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CART DRAWER OVERLAY --- */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
            <div onClick={() => setIsCartOpen(false)} className="absolute inset-0"></div>
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="bg-white w-full max-w-md h-full relative z-10 flex flex-col justify-between shadow-2xl p-6"
            >
              <div>
                <div className="flex justify-between items-center border-b border-amber-900/10 pb-4">
                  <h3 className="font-serif font-bold text-lg text-amber-950 flex items-center gap-1.5">
                    <ShoppingBag className="w-5 h-5 text-red-700" />
                    Your Order Cart
                  </h3>
                  <button onClick={() => setIsCartOpen(false)} className="p-1.5 bg-amber-50 rounded-full text-amber-950 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {cart.length === 0 ? (
                  <div className="py-24 text-center text-amber-950/40 flex flex-col items-center justify-center">
                    <span className="text-5xl mb-3">🍽️</span>
                    <h4 className="font-semibold text-sm">Your plate is empty!</h4>
                    <p className="text-[10px] mt-1 max-w-xs">Return to menu and add some Chettinad specialties.</p>
                  </div>
                ) : (
                  <div className="space-y-4 py-4 max-h-[50vh] overflow-y-auto">
                    {cart.map(item => (
                      <div key={item.cartId} className="flex gap-3 bg-amber-50/20 p-3 rounded-2xl border border-amber-950/5">
                        <span className="text-3xl">{item.icon}</span>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-xs text-amber-950">{item.name}</h4>
                            <button 
                              onClick={() => setCart(prev => prev.filter(it => it.cartId !== item.cartId))}
                              className="text-red-700 hover:text-red-900 text-[10px] font-bold underline cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                          
                          <p className="text-[9px] text-amber-900/40">
                            Size: {item.sizeLabel || 'Reg'} · Spice: {item.spiceLevel || 'Medium'}
                            {item.addonsSelected.length > 0 && ` · Addons: ${item.addonsSelected.map(a => a.label).join(', ')}`}
                            {item.notes && ` · Notes: "${item.notes}"`}
                          </p>

                          <div className="flex justify-between items-center pt-2">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  if (item.qty > 1) {
                                    setCart(prev => prev.map(it => it.cartId === item.cartId ? { ...it, qty: it.qty - 1 } : it));
                                  } else {
                                    setCart(prev => prev.filter(it => it.cartId !== item.cartId));
                                  }
                                }}
                                className="bg-amber-100/80 text-amber-950 w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-mono text-[11px] font-bold text-amber-950">{item.qty}</span>
                              <button 
                                onClick={() => {
                                  const foodItem = menu.find(m => m.id === item.foodId);
                                  if (foodItem && item.qty < foodItem.stock) {
                                    setCart(prev => prev.map(it => it.cartId === item.cartId ? { ...it, qty: it.qty + 1 } : it));
                                  } else {
                                    addToast("⚠️ Stock Limit", "Cannot exceed raw kitchen inventory servings.", "system");
                                  }
                                }}
                                className="bg-amber-100/80 text-amber-950 w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <span className="font-mono text-xs font-bold text-amber-950">₹{item.price * item.qty}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-amber-900/10 pt-4 space-y-3">
                  <div className="space-y-1.5 text-xs text-amber-900/60 font-medium">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-mono">₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST (5%)</span>
                      <span className="font-mono">₹{tax.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Fee</span>
                      <span className="font-mono">{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</span>
                    </div>
                    {subtotal < 299 && (
                      <span className="block text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-1 rounded">
                        💡 Tip: Add ₹{299 - subtotal} more for Free Delivery!
                      </span>
                    )}
                    <div className="flex justify-between text-amber-950 font-bold border-t border-dashed border-amber-900/10 pt-2 font-mono text-sm">
                      <span>Total Amount</span>
                      <span>₹{grandTotal}</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleOpenCheckout}
                    className="w-full bg-red-700 text-white py-3.5 rounded-xl text-xs uppercase tracking-wide font-bold hover:bg-red-800 transition-colors shadow cursor-pointer mt-2"
                  >
                    Proceed To Checkout
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CHECKOUT MODAL OVERLAY --- */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-amber-950/10 p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-amber-900/10 pb-4 mb-4">
                <h3 className="font-serif font-bold text-lg text-amber-950 flex items-center gap-1.5">
                  <CreditCard className="w-5 h-5 text-amber-700" />
                  Secure Checkout
                </h3>
                <button onClick={() => setIsCheckoutOpen(false)} className="p-1.5 bg-amber-50 rounded-full text-amber-950 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handlePlaceOrder} className="space-y-4 text-xs">
                {/* Mode Select */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-amber-900/60 uppercase">Delivery Mode</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutMode('delivery')}
                      className={`flex-1 py-2 rounded-xl font-semibold border cursor-pointer ${
                        checkoutMode === 'delivery' 
                          ? 'bg-amber-950 text-white border-amber-950 shadow-sm' 
                          : 'bg-white text-amber-900/70 border-amber-950/10 hover:border-amber-950/30'
                      }`}
                    >
                      🚗 Home Delivery
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutMode('pickup')}
                      className={`flex-1 py-2 rounded-xl font-semibold border cursor-pointer ${
                        checkoutMode === 'pickup' 
                          ? 'bg-amber-950 text-white border-amber-950 shadow-sm' 
                          : 'bg-white text-amber-900/70 border-amber-950/10 hover:border-amber-950/30'
                      }`}
                    >
                      🥡 Self Pickup
                    </button>
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-amber-900/60 uppercase">Recipient Coordinates</label>
                  <input 
                    type="text"
                    value={custName}
                    onChange={e => setCustName(e.target.value)}
                    placeholder="Full recipient name"
                    className="w-full bg-amber-50/20 border border-amber-950/10 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-700"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text"
                      value={custPhone}
                      onChange={e => setCustPhone(e.target.value)}
                      placeholder="Mobile contact (10 digit)"
                      className="w-full bg-amber-50/20 border border-amber-950/10 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-700 font-mono"
                      required
                    />
                    <input 
                      type="text"
                      value={custTable}
                      onChange={e => setCustTable(e.target.value)}
                      placeholder="Table / flat no (Optional)"
                      className="w-full bg-amber-50/20 border border-amber-950/10 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-700"
                    />
                  </div>
                  {checkoutMode === 'delivery' && (
                    <input 
                      type="text"
                      value={custAddress}
                      onChange={e => setCustAddress(e.target.value)}
                      placeholder="Madurai delivery address coordinates"
                      className="w-full bg-amber-50/20 border border-amber-950/10 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-700"
                      required
                    />
                  )}
                </div>

                {/* Pay Options */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-amber-900/60 uppercase">Integrated Payment Gateway</label>
                  <div className="space-y-2">
                    <label className={`flex items-start justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      payMethod === 'upi' ? 'border-red-600 bg-red-50/5' : 'border-amber-950/10 hover:bg-amber-50/10'
                    }`}>
                      <span className="flex items-center gap-2 font-semibold text-amber-950">
                        <input 
                          type="radio" 
                          name="payment" 
                          checked={payMethod === 'upi'}
                          onChange={() => setPayMethod('upi')}
                          className="accent-red-700"
                        />
                        UPI — Instantly pay via GPay / PhonePe / Paytm
                      </span>
                    </label>

                    {payMethod === 'upi' && (
                      <div className="bg-amber-50/40 p-3 rounded-2xl border border-dashed border-amber-900/10 space-y-3">
                        <p className="text-[10px] text-amber-900/60 leading-relaxed">
                          Scan the dynamic order QR code below with any UPI application to authorize.
                        </p>
                        <div className="flex items-center gap-3">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`upi://pay?pa=spiceandleaf@upi&pn=SpiceLeaf&am=${grandTotal}&cu=INR&tn=Order`)}`}
                            alt="Scan to pay"
                            className="w-20 h-20 bg-white border rounded-xl"
                          />
                          <div className="font-mono text-[10px] text-amber-950 font-bold">
                            Merchant ID: spiceandleaf@upi
                            <span className="block text-[9px] font-normal text-amber-900/40 mt-1">Automatic verification over WebSockets on scan</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <label className={`flex items-start justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      payMethod === 'card' ? 'border-red-600 bg-red-50/5' : 'border-amber-950/10 hover:bg-amber-50/10'
                    }`}>
                      <span className="flex items-center gap-2 font-semibold text-amber-950">
                        <input 
                          type="radio" 
                          name="payment" 
                          checked={payMethod === 'card'}
                          onChange={() => setPayMethod('card')}
                          className="accent-red-700"
                        />
                        Credit / Debit Cards (Visa, Mastercard, RuPay)
                      </span>
                    </label>

                    {payMethod === 'card' && (
                      <div className="space-y-2 bg-amber-50/20 p-3 rounded-2xl border border-amber-950/5">
                        <input 
                          type="text" 
                          placeholder="Card number (16 digit)"
                          value={cardNumber}
                          onChange={e => setCardNumber(e.target.value)}
                          className="w-full bg-white border border-amber-950/15 rounded-xl px-3 py-2 text-[11px]"
                          required
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="text" 
                            placeholder="MM/YY"
                            value={cardExpiry}
                            onChange={e => setCardExpiry(e.target.value)}
                            className="bg-white border border-amber-950/15 rounded-xl px-3 py-2 text-[11px]"
                            required
                          />
                          <input 
                            type="password" 
                            placeholder="CVV"
                            value={cardCvv}
                            onChange={e => setCardCvv(e.target.value)}
                            className="bg-white border border-amber-950/15 rounded-xl px-3 py-2 text-[11px] font-mono"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <label className={`flex items-start justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      payMethod === 'cod' ? 'border-red-600 bg-red-50/5' : 'border-amber-950/10 hover:bg-amber-50/10'
                    }`}>
                      <span className="flex items-center gap-2 font-semibold text-amber-950">
                        <input 
                          type="radio" 
                          name="payment" 
                          checked={payMethod === 'cod'}
                          onChange={() => setPayMethod('cod')}
                          className="accent-red-700"
                        />
                        Cash on {checkoutMode === 'delivery' ? 'Delivery' : 'Pickup'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Confirm pricing footer */}
                <div className="flex justify-between items-center border-t border-amber-900/5 pt-4">
                  <div>
                    <span className="block text-[10px] font-semibold text-amber-900/40">GRAND CHECKOUT TOTAL</span>
                    <span className="font-mono text-base font-bold text-amber-950">₹{grandTotal}</span>
                  </div>
                  <button
                    type="submit"
                    disabled={isPaying}
                    className="bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-red-800 transition-colors shadow-lg cursor-pointer"
                  >
                    {isPaying ? 'Authorizing Payment...' : `Authorize & Pay ₹${grandTotal}`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
