export interface Product {
  id: string; // Used as Barcode
  name: string;
  category: string;
  price: number; // Selling price
  costPrice: number;
  stock: Record<string, Record<string, number>>; // Size -> Color -> Stock
  hsn: string;
  imageUrl?: string;
}

export const DEFAULT_PRODUCT_IMAGE = "https://i.imgur.com/n3YfGtw_d.webp?maxwidth=760&fidelity=grand";

export interface TransactionItem {
  id: string;
  name: string;
  selectedSize: string;
  selectedColor: string;
  quantity: number;
  price: number;
  cgst: number;
  sgst: number;
  discountType?: "percentage" | "flat";
  discountValue?: number;
  discountAmount?: number;
  totalDiscount?: number;
}

export interface Transaction {
  id: string;
  type: "offline";
  time: string;
  amount: number;
  customer?: string;
  items: number;
  status: "Completed" | "Refunded";
  itemsList?: TransactionItem[];
  paymentMode?: "Cash" | "Card" | "UPI" | "Store Credit";
  discount?: number;
  discountType?: "percentage" | "flat";
  discountValue?: number;
  subtotal?: number;
  cgst?: number;
  sgst?: number;
  isGst?: boolean;
  discountDetails?: {
    itemDiscount: number;
    overallDiscount: number;
  };
  createdBy?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalSpent: number;
  purchaseHistory: Transaction[];
}

export interface ReturnRecord {
  id: string;
  orderId: string;
  date: string;
  customer: string;
  type: "Refund" | "Size Exchange" | "Store Credit" | "Refund to Source";
  status: "Processed" | "Pending" | "Rejected";
  items: { id?: string; name: string; reason: string; amount: number; originalSize: string; originalColor: string; newSize?: string }[];
  totalRefund: number;
}

// Local storage caching keys
const DB_PREFIX = "street_rage_";

const loadLocal = <T>(key: string, fallback: T): T => {
  const saved = localStorage.getItem(DB_PREFIX + key);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse stored local mock data", e);
    }
  }
  return fallback;
};

export const saveLocal = (key: string, data: any) => {
  localStorage.setItem(DB_PREFIX + key, JSON.stringify(data));
};

const initialProducts: Product[] = [];
const initialTransactions: Transaction[] = [];
const initialCustomers: Customer[] = [];
const initialReturns: ReturnRecord[] = [];

export const mockProducts: Product[] = loadLocal("products", initialProducts);
export const mockTransactions: Transaction[] = loadLocal("transactions", initialTransactions);
export const mockCustomers: Customer[] = loadLocal("customers", initialCustomers);
export const mockReturns: ReturnRecord[] = loadLocal("returns", initialReturns);

export const GSTIN = "29DULPK3195L1ZT";
export const STORE_ADDRESS = "43, Shivaji Rd, opp. to arfath function hall, Rajiv Gandhi Colony, Shivaji Nagar, Bengaluru, Karnataka 560051";
export const STORE_PHONE = "+91 8660117913";

export function parseTxDate(timeStr: string): Date | null {
  if (!timeStr) return null;
  
  // Try direct parsing first
  const direct = new Date(timeStr);
  if (!isNaN(direct.getTime())) {
    return direct;
  }
  
  try {
    // Match pattern for DD/MM/YYYY or YYYY/MM/DD
    const match = timeStr.match(/(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})/);
    if (match) {
      const part1 = parseInt(match[1], 10);
      const part2 = parseInt(match[2], 10);
      const part3 = parseInt(match[3], 10);
      
      let year = 2026;
      let month = 0;
      let day = 1;
      
      if (part1 > 1000) { // YYYY-MM-DD
        year = part1;
        month = part2 - 1;
        day = part3;
      } else if (part3 > 1000) { // DD-MM-YYYY or MM-DD-YYYY
        year = part3;
        if (part1 > 12) {
          day = part1;
          month = part2 - 1;
        } else if (part2 > 12) {
          day = part2;
          month = part1 - 1;
        } else {
          // Default to Indian format DD/MM/YYYY since it's Bengaluru
          day = part1;
          month = part2 - 1;
        }
      } else {
        // Short year? YY
        year = part3 + (part3 < 50 ? 2000 : 1900);
        day = part1;
        month = part2 - 1;
      }
      
      let hours = 0;
      let minutes = 0;
      let seconds = 0;
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        if (timeMatch[3]) {
          seconds = parseInt(timeMatch[3], 10);
        }
        if (timeMatch[4]) {
          const ampm = timeMatch[4].toUpperCase();
          if (ampm === "PM" && hours < 12) hours += 12;
          if (ampm === "AM" && hours === 12) hours = 0;
        }
      }
      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d;
    }
  } catch (e) {
    console.error("Error parsing date:", e);
  }
  return null;
}
