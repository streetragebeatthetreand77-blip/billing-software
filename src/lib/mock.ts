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
export const STORE_PHONE = "+91 78929 37265";
