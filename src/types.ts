export type UserRole = 'customer' | 'staff' | 'ceo';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  address?: string;
}

export interface Addon {
  id: string;
  label: string;
  price: number;
}

export interface Size {
  id: string;
  label: string;
  mult: number;
}

export interface FoodItem {
  id: string;
  name: string;
  desc: string;
  category: string;
  price: number;
  icon: string;
  veg: boolean;
  spice: boolean;
  initialStock: number;
  stock: number;
  addons?: Addon[];
  sizes?: Size[];
}

export interface CartItem {
  cartId: string;
  foodId: string;
  name: string;
  icon: string;
  price: number;
  qty: number;
  spiceLevel?: string;
  sizeLabel?: string;
  addonsSelected: Addon[];
  notes?: string;
}

export type OrderStatus = 'placed' | 'accepted' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled';

export interface OrderTimeline {
  status: OrderStatus;
  timestamp: string;
  description: string;
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  mode: 'delivery' | 'pickup';
  items: CartItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  timestamp: string;
  timeline: OrderTimeline[];
  driverLocation?: { lat: number; lng: number; progress: number }; // progress 0 to 100
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'order_update' | 'stock_alert' | 'system';
}

export interface LiveStats {
  totalOrders: number;
  totalRevenue: number;
  popularItems: { name: string; count: number }[];
  lowStockCount: number;
}
