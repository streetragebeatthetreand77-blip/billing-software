import { useState, useMemo, ChangeEvent } from "react";
import { mockProducts, Product, GSTIN, STORE_ADDRESS, STORE_PHONE, mockCustomers, Customer, mockTransactions, Transaction, saveLocal, DEFAULT_PRODUCT_IMAGE } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ShoppingCart, Plus, Minus, X, ReceiptText, Printer, UserCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { saveTransactionToFirebase, saveCustomerToFirebase, saveProductToFirebase } from "@/lib/db";


interface CartItem extends Product {
  cartItemId: string;
  selectedSize: string;
  selectedColor: string;
  quantity: number;
  discountType?: 'percentage' | 'flat';
  discountValue?: number;
}

export function POS() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const updateItemDiscount = (cartItemId: string, type: 'percentage' | 'flat', value: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.cartItemId === cartItemId) {
        return {
          ...item,
          discountType: type,
          discountValue: value
        };
      }
      return item;
    }));
  };
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sizeSelection, setSizeSelection] = useState<string>("");
  const [colorSelection, setColorSelection] = useState<string>("");
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  
  // Customer linking state
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [linkedCustomer, setLinkedCustomer] = useState<Customer | null>(null);
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Card" | "UPI" | "Store Credit">("Cash");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isGstBill, setIsGstBill] = useState(true);
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);

  const categories = ["All", ...Array.from(new Set(mockProducts.map(p => p.category)))];

  const filteredProducts = useMemo(() => {
    return mockProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleProductClick = (product: Product) => {
    // If the product has only a single size and color variant, add it to cart instantly!
    const sizes = Object.keys(product.stock || {});
    if (sizes.length === 1) {
      const sizeName = sizes[0];
      const colors = Object.keys(product.stock[sizeName] || {});
      if (colors.length === 1) {
        const colorName = colors[0];
        const cartItemId = `${product.id}-${sizeName}-${colorName}`;
        setCart(prevCart => {
          const existingItem = prevCart.find(item => item.cartItemId === cartItemId);
          if (existingItem) {
            return prevCart.map(item => item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item);
          } else {
            return [...prevCart, { ...product, cartItemId, selectedSize: sizeName, selectedColor: colorName, quantity: 1 }];
          }
        });
        return;
      }
    }

    // Otherwise, open the modal for size/color selection
    setSelectedProduct(product);
    setSizeSelection("");
    setColorSelection("");
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    if (Object.keys(selectedProduct.stock).length > 0 && !sizeSelection) {
      alert("Please select a size");
      return;
    }
    if (sizeSelection && Object.keys(selectedProduct.stock[sizeSelection] || {}).length > 0 && !colorSelection) {
      alert("Please select a color");
      return;
    }

    const cartItemId = `${selectedProduct.id}-${sizeSelection}-${colorSelection}`;
    const existingItem = cart.find(item => item.cartItemId === cartItemId);

    if (existingItem) {
      setCart(cart.map(item => item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...selectedProduct, cartItemId, selectedSize: sizeSelection || "One Size", selectedColor: colorSelection || "Default", quantity: 1 }]);
    }

    setSelectedProduct(null);
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeCartItem = (cartItemId: string) => {
    setCart(cart.filter(item => item.cartItemId !== cartItemId));
  };

  // Tax calculation
  const billDetails = useMemo(() => {
    let subtotalRaw = 0;
    let totalItemDiscount = 0;
    let subtotalAfterItemDiscounts = 0;

    // Calculate raw item subtotals and item-level discounts
    const itemsWithItemDiscount = cart.map(item => {
      const itemSubtotal = item.price * item.quantity;
      const itemDiscountVal = item.discountValue || 0;
      const itemDiscountType = item.discountType || 'percentage';
      
      let itemDiscount = 0;
      if (itemDiscountType === 'percentage') {
        itemDiscount = Math.round(itemSubtotal * (itemDiscountVal / 100) * 100) / 100;
      } else {
        itemDiscount = itemDiscountVal;
      }
      itemDiscount = Math.min(itemDiscount, itemSubtotal);
      
      const itemSubtotalAfterDiscount = itemSubtotal - itemDiscount;
      
      subtotalRaw += itemSubtotal;
      totalItemDiscount += itemDiscount;
      subtotalAfterItemDiscounts += itemSubtotalAfterDiscount;

      return {
        ...item,
        itemSubtotal,
        itemDiscount,
        itemSubtotalAfterDiscount
      };
    });

    // Calculate overall invoice discount amount
    let overallDiscountAmount = 0;
    if (discountType === 'percentage') {
      overallDiscountAmount = Math.round(subtotalAfterItemDiscounts * (discountValue / 100) * 100) / 100;
    } else {
      overallDiscountAmount = discountValue;
    }
    overallDiscountAmount = Math.min(overallDiscountAmount, subtotalAfterItemDiscounts);

    // Proportional overall discount ratio
    const overallDiscountRatio = subtotalAfterItemDiscounts > 0 ? (overallDiscountAmount / subtotalAfterItemDiscounts) : 0;

    let discountedSubtotalRaw = 0;
    let cgstRaw = 0;
    let sgstRaw = 0;

    const items = itemsWithItemDiscount.map(item => {
      // Allocate overall invoice discount proportionally
      const allocatedOverallDiscount = Math.round(item.itemSubtotalAfterDiscount * overallDiscountRatio * 100) / 100;
      const itemDiscountedSubtotal = Math.max(0, item.itemSubtotalAfterDiscount - allocatedOverallDiscount);
      discountedSubtotalRaw += itemDiscountedSubtotal;

      // GST rule: < 1000 is 5% (2.5 + 2.5), >= 1000 is 12% (6 + 6)
      const isLowTax = item.price < 1000;
      const taxRate = isGstBill ? (isLowTax ? 0.05 : 0.12) : 0;
      const cgstRate = taxRate / 2;
      const sgstRate = taxRate / 2;

      const cgstAmount = Math.round(itemDiscountedSubtotal * cgstRate * 100) / 100;
      const sgstAmount = Math.round(itemDiscountedSubtotal * sgstRate * 100) / 100;

      cgstRaw += cgstAmount;
      sgstRaw += sgstAmount;

      return {
        ...item,
        totalItemDiscount: item.itemDiscount + allocatedOverallDiscount,
        itemDiscountAmount: item.itemDiscount,
        allocatedOverallDiscount,
        itemDiscountedSubtotal,
        taxRate: taxRate * 100,
        cgstAmount,
        sgstAmount,
        hsn: isLowTax ? '6205' : '6206'
      };
    });

    const subtotal = Math.round(subtotalRaw * 100) / 100;
    const totalDiscount = Math.round((totalItemDiscount + overallDiscountAmount) * 100) / 100;
    const discountedSubtotal = Math.round(discountedSubtotalRaw * 100) / 100;
    const totalCgst = Math.round(cgstRaw * 100) / 100;
    const totalSgst = Math.round(sgstRaw * 100) / 100;
    const total = Math.round((discountedSubtotal + totalCgst + totalSgst) * 100) / 100;

    return { 
      items, 
      subtotal, 
      totalItemDiscount: Math.round(totalItemDiscount * 100) / 100,
      totalOverallDiscount: Math.round(overallDiscountAmount * 100) / 100,
      totalDiscount, 
      discountedSubtotal, 
      totalCgst, 
      totalSgst, 
      total 
    };
  }, [cart, discountType, discountValue, isGstBill]);

  const handlePrintReceipt = () => {
    if (!currentTransaction) return;

    const tx = currentTransaction;
    const isGst = tx.isGst !== false;
    const discount = tx.discount || 0;
    const subtotal = tx.subtotal || 0;
    const cgst = tx.cgst || 0;
    const sgst = tx.sgst || 0;
    const finalAmount = tx.amount;

    const printEl = document.createElement('div');
    printEl.id = 'tax-invoice';

    const itemDiscountsTotal = tx.discountDetails?.itemDiscount || 0;
    const overallDiscountTotal = tx.discountDetails?.overallDiscount || 0;

    let htmlContent = `
      <div style="font-family: monospace; text-align: center; color: #141414; padding: 10px 4px 10px 4px;">
        <h2 style="margin: 0 0 5px 0; font-size: 20px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">STREET RAGE</h2>
        <p style="margin: 0; font-size: 10px; line-height: 1.2; color: #666666;">${STORE_ADDRESS.split(', ').join('<br/>')}</p>
        <p style="margin: 3px 0; font-size: 10px; color: #666666;">Tel: ${STORE_PHONE}</p>
        <p style="margin: 5px 0; font-size: 10px; color: #666666;">${isGst ? `GSTIN: ${GSTIN}` : 'ESTIMATE / NON-GST'}</p>
        <div style="margin: 10px 0; border-top: 1px dashed #CCCCCC; padding-top: 10px;">
          <h3 style="margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">${isGst ? 'TAX INVOICE' : 'RETAIL BILL'}</h3>
          <p style="margin: 5px 0 0 0; font-size: 9px; color: #999999;">${tx.time}</p>
        </div>
        
        <div style="text-align: left; background: #F9F9F9; padding: 6px; margin: 10px 0; font-size: 10px; border-radius: 4px;">
          <strong>Invoice ID:</strong> ${tx.id}<br/>
          <strong>Client:</strong> ${tx.customer || 'Walk-in Customer'}<br/>
          <strong>Payment Mode:</strong> ${tx.paymentMode || 'Cash'}
        </div>

        <table style="width: 100%; font-size: 10px; text-align: left; margin: 15px 0; border-collapse: collapse;">
          <thead>
            <tr style="border-b: 1px solid #CCCCCC;">
              <th style="padding: 4px 0;">Item / Desc</th>
              <th style="padding: 4px 0; text-align: center;">Qty</th>
              <th style="padding: 4px 0; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(tx.itemsList || []).map(item => {
              const rawItemTotal = item.price * item.quantity;
              const hasItemDisc = item.discountValue !== undefined && item.discountValue > 0;
              const itemDiscLabel = item.discountType === 'percentage' ? `${item.discountValue}%` : `Flat ₹${item.discountValue}`;
              const itemDiscAmt = item.discountAmount || 0;
              return `
                <tr style="border-b: 1px solid #EAEAEA;">
                  <td style="padding: 6px 0;">
                    <div>${item.name}</div>
                    <div style="font-size: 8px; color: #666666;">${item.selectedSize}/${item.selectedColor} | HSN: ${item.price < 1000 ? '6205' : '6206'}</div>
                    ${hasItemDisc ? `<div style="font-size: 8px; color: #10b981;">Disc: ${itemDiscLabel} (-₹${itemDiscAmt.toLocaleString()})</div>` : ''}
                  </td>
                  <td style="padding: 6px 0; text-align: center;">${item.quantity}</td>
                  <td style="padding: 6px 0; text-align: right;">
                    ${hasItemDisc ? `<span style="text-decoration: line-through; color: #999999; font-size: 8px; margin-right: 4px;">₹${rawItemTotal.toLocaleString()}</span>` : ''}
                    ₹${(rawItemTotal - itemDiscAmt).toLocaleString()}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="border-top: 1px solid #CCCCCC; padding-top: 8px; font-size: 10px; line-height: 1.5;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal:</span>
            <span>₹${subtotal.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
          </div>
          ${itemDiscountsTotal > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #10b981;">
              <span>• Product Discounts:</span>
              <span>-₹${itemDiscountsTotal.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
            </div>
          ` : ''}
          ${overallDiscountTotal > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #10b981;">
              <span>• Invoice Discount (${tx.discountType === 'percentage' ? `${tx.discountValue}%` : 'Flat'}):</span>
              <span>-₹${overallDiscountTotal.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
            </div>
          ` : ''}
          ${discount > 0 ? `
            <div style="display: flex; justify-content: space-between; color: #10b981; font-weight: bold; border-top: 1px dashed #EAEAEA; margin-top: 2px; padding-top: 2px;">
              <span>Total Discount:</span>
              <span>-₹${discount.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; color: #666666; ${discount > 0 ? '' : 'border-top: 1px dashed #EAEAEA; margin-top: 2px; padding-top: 2px;'}">
            <span>Taxable Value:</span>
            <span>₹${(subtotal - discount).toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #666666;">
            <span>CGST:</span>
            <span>₹${cgst.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #666666;">
            <span>SGST:</span>
            <span>₹${sgst.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 5px; border-top: 1px solid #141414; padding-top: 5px;">
            <span>Grand Total:</span>
            <span>₹${finalAmount.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
          </div>
        </div>
        
        <p style="margin: 25px 0 0 0; font-size: 9px; color: #999999; text-transform: uppercase; letter-spacing: 1px;">Thank you for shopping<br/>STREET RAGE Omnichannel POS</p>
      </div>
    `;

    if (isGst) {
      const hsnGroups: Record<string, {
        hsn: string;
        taxableValue: number;
        taxRate: number;
        cgst: number;
        sgst: number;
        total: number;
      }> = {};

      (tx.itemsList || []).forEach(item => {
        const itemHsn = item.price < 1000 ? '6205' : '6206';
        const rawItemSubtotal = item.price * item.quantity;
        const totalItemDiscountAmount = item.totalDiscount || item.discountAmount || 0;
        const taxable = Math.max(0, rawItemSubtotal - totalItemDiscountAmount);

        const isLowTax = item.price < 1000;
        const taxRatePercent = isLowTax ? 5 : 12;

        if (!hsnGroups[itemHsn]) {
          hsnGroups[itemHsn] = {
            hsn: itemHsn,
            taxableValue: 0,
            taxRate: taxRatePercent,
            cgst: 0,
            sgst: 0,
            total: 0
          };
        }

        const group = hsnGroups[itemHsn];
        group.taxableValue += taxable;
        group.cgst += item.cgst;
        group.sgst += item.sgst;
        group.total += (taxable + item.cgst + item.sgst);
      });

      htmlContent += `
        <div style="page-break-before: always; break-before: page; font-family: monospace; text-align: center; color: #141414; padding: 10px 4px 10px 4px;">
          <h2 style="margin: 0 0 5px 0; font-size: 16px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">TAX FILING SLIP</h2>
          <p style="margin: 0; font-size: 9px; color: #666666;">STREET RAGE BACKOFFICE COPY</p>
          <div style="margin: 10px 0; border-top: 1px dashed #CCCCCC; padding-top: 10px; text-align: left; font-size: 9px;">
            <strong>Invoice Ref:</strong> ${tx.id}<br/>
            <strong>Date:</strong> ${tx.time}<br/>
            <strong>GSTIN:</strong> ${GSTIN}
          </div>

          <table style="width: 100%; font-size: 8px; text-align: left; margin: 15px 0; border-collapse: collapse;">
            <thead>
              <tr style="border-b: 1px solid #CCCCCC; font-weight: bold;">
                <th style="padding: 4px 0;">HSN</th>
                <th style="padding: 4px 0; text-align: right;">Taxable (₹)</th>
                <th style="padding: 4px 0; text-align: right;">Rate</th>
                <th style="padding: 4px 0; text-align: right;">CGST (₹)</th>
                <th style="padding: 4px 0; text-align: right;">SGST (₹)</th>
                <th style="padding: 4px 0; text-align: right;">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(hsnGroups).map(group => `
                <tr style="border-b: 1px solid #EAEAEA;">
                  <td style="padding: 6px 0; font-weight: bold;">${group.hsn}</td>
                  <td style="padding: 6px 0; text-align: right;">${group.taxableValue.toFixed(2)}</td>
                  <td style="padding: 6px 0; text-align: right;">${group.taxRate}%</td>
                  <td style="padding: 6px 0; text-align: right;">${group.cgst.toFixed(2)}</td>
                  <td style="padding: 6px 0; text-align: right;">${group.sgst.toFixed(2)}</td>
                  <td style="padding: 6px 0; text-align: right;">${group.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="border-top: 1px solid #CCCCCC; padding-top: 8px; font-size: 9px; line-height: 1.5; text-align: left;">
            <div style="display: flex; justify-content: space-between;">
              <span>Total Taxable Amount:</span>
              <span>₹${(subtotal - discount).toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Total CGST Collected:</span>
              <span>₹${cgst.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Total SGST Collected:</span>
              <span>₹${sgst.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid #141414; padding-top: 5px; margin-top: 5px;">
              <span>Total Tax Collected:</span>
              <span>₹${(cgst + sgst).toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
            </div>
          </div>
          <p style="margin: 25px 0 0 0; font-size: 8px; color: #999999; text-transform: uppercase; letter-spacing: 1px;">SLIP END - RETAIN FOR AUDIT</p>
        </div>
      `;
    }

    printEl.innerHTML = htmlContent;

    const styleEl = document.createElement('style');
    styleEl.innerHTML = `@page { size: 80mm 200mm; margin: 0; }`;

    document.body.appendChild(printEl);
    document.head.appendChild(styleEl);

    window.print();

    setTimeout(() => {
      document.body.removeChild(printEl);
      document.head.removeChild(styleEl);
    }, 500);
  };

  return (
    <div className="flex h-full w-full bg-[#FAFAFA]">
      {/* Left side: Product Catalog */}
      <div className="w-2/3 flex flex-col border-r border-[#E4E3E0]">
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-sans tracking-tight text-[#141414]">Products</h1>
            <div className="w-64 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Scan Barcode or Search..." 
                className="pl-9 bg-white border-[#E4E3E0]"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (filteredProducts.length === 1) {
                      handleProductClick(filteredProducts[0]);
                      setSearchQuery("");
                    }
                  }
                }}
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar">
            {categories.map(cat => (
              <Badge 
                key={cat} 
                variant={selectedCategory === cat ? "default" : "outline"}
                className={`cursor-pointer rounded-full px-4 py-1 flex-shrink-0 ${selectedCategory === cat ? 'bg-[#141414] text-white' : 'font-normal text-[#666666] hover:bg-[#F0F0F0] border-[#E4E3E0]'}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <Card 
                key={product.id} 
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow uppercase-tracking group bg-white border-[#E4E3E0]"
                onClick={() => handleProductClick(product)}
              >
                <div className="aspect-[4/5] bg-gray-100 relative overflow-hidden">
                  <img src={product.imageUrl || DEFAULT_PRODUCT_IMAGE} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 text-[10px] font-mono tracking-wider shadow-sm rounded-sm">
                    {product.id}
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-xs text-[#999999] uppercase tracking-wider mb-1">{product.category}</div>
                  <div className="font-medium text-sm text-[#141414] line-clamp-1">{product.name}</div>
                  <div className="mt-2 font-mono text-sm tracking-tight text-[#141414]">₹{product.price.toLocaleString('en-IN')}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Right side: Cart & POS */}
      <div className="w-1/3 min-w-[400px] flex flex-col bg-white">
        <div className="p-6 border-b border-[#E4E3E0]">
          <h2 className="text-xl font-sans tracking-tight text-[#141414] flex items-center">
            <ShoppingCart className="w-5 h-5 mr-3 text-muted-foreground" />
            Current Invoice
          </h2>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#999999] space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#FAFAFA] flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-[#CCCCCC]" />
              </div>
              <p className="font-sans">Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.cartItemId} className="flex gap-3 items-start border-b border-[#F0F0F0] pb-4 group">
                  <div className="w-12 h-16 bg-gray-100 rounded-sm overflow-hidden flex-shrink-0">
                    <img src={item.imageUrl || DEFAULT_PRODUCT_IMAGE} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-[#141414] truncate">{item.name}</h3>
                    <div className="text-xs text-[#666666] mt-0.5 font-mono">
                      {item.selectedSize} | {item.selectedColor}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="font-mono text-sm">₹{item.price.toLocaleString('en-IN')}</div>
                      <div className="flex items-center gap-2 border border-[#E4E3E0] rounded-sm bg-[#FAFAFA]">
                        <button onClick={() => updateQuantity(item.cartItemId, -1)} className="px-2 py-0.5 text-[#666666] hover:bg-white transition-colors">-</button>
                        <span className="text-xs font-mono w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.cartItemId, 1)} className="px-2 py-0.5 text-[#666666] hover:bg-white transition-colors">+</button>
                      </div>
                    </div>
                    {/* Item-level Discount Input */}
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-dashed border-[#F0F0F0]">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">Item Disc:</span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={item.discountType || "percentage"}
                          onChange={(e) => updateItemDiscount(item.cartItemId, e.target.value as "percentage" | "flat", item.discountValue || 0)}
                          className="text-[10px] font-mono border border-[#E4E3E0] rounded px-1.5 py-0.5 bg-white text-[#141414]"
                        >
                          <option value="percentage">%</option>
                          <option value="flat">₹</option>
                        </select>
                        <Input
                          type="number"
                          min="0"
                          max={item.discountType === 'percentage' ? 100 : undefined}
                          value={item.discountValue || ""}
                          placeholder="0"
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateItemDiscount(item.cartItemId, item.discountType || "percentage", val >= 0 ? val : 0);
                          }}
                          className="h-6 w-20 text-[10px] font-mono border-[#E4E3E0] p-1 text-center bg-white"
                        />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeCartItem(item.cartItemId)} className="opacity-0 group-hover:opacity-100 p-1 text-[#999999] hover:text-red-500 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-[#FAFAFA] border-t border-[#E4E3E0]">
          {/* Bill Type Selector */}
          <div className="flex items-center justify-between mb-3 bg-white p-2.5 rounded-lg border border-[#E4E3E0]">
            <span className="text-xs font-semibold text-[#141414] uppercase tracking-wider">Bill Type</span>
            <div className="flex gap-1 bg-[#FAFAFA] p-0.5 rounded border border-[#E4E3E0]">
              <button
                type="button"
                className={`text-[10px] font-mono uppercase px-3 py-1 rounded transition-all ${isGstBill ? 'bg-[#141414] text-white font-bold' : 'text-[#666666] hover:text-[#141414]'}`}
                onClick={() => setIsGstBill(true)}
              >
                GST Bill
              </button>
              <button
                type="button"
                className={`text-[10px] font-mono uppercase px-3 py-1 rounded transition-all ${!isGstBill ? 'bg-[#141414] text-white font-bold' : 'text-[#666666] hover:text-[#141414]'}`}
                onClick={() => setIsGstBill(false)}
              >
                Non-GST
              </button>
            </div>
          </div>

          {/* Discount Section */}
          <div className="mb-4 bg-white p-2.5 rounded-lg border border-[#E4E3E0] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#141414] uppercase tracking-wider">Discount</span>
              <div className="flex gap-1 bg-[#FAFAFA] p-0.5 rounded border border-[#E4E3E0]">
                <button
                  type="button"
                  className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all ${discountType === 'percentage' ? 'bg-[#141414] text-white font-bold' : 'text-[#666666] hover:text-[#141414]'}`}
                  onClick={() => {
                    setDiscountType('percentage');
                    setDiscountValue(0);
                  }}
                >
                  %
                </button>
                <button
                  type="button"
                  className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all ${discountType === 'flat' ? 'bg-[#141414] text-white font-bold' : 'text-[#666666] hover:text-[#141414]'}`}
                  onClick={() => {
                    setDiscountType('flat');
                    setDiscountValue(0);
                  }}
                >
                  Flat (₹)
                </button>
              </div>
            </div>
            <Input
              type="number"
              min="0"
              max={discountType === 'percentage' ? 100 : undefined}
              value={discountValue || ""}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setDiscountValue(val >= 0 ? val : 0);
              }}
              placeholder={discountType === 'percentage' ? "Enter percentage (e.g. 10)" : "Enter amount (e.g. 500)"}
              className="h-8 text-xs font-mono border-[#E4E3E0]"
            />
          </div>

          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm text-[#666666]">
              <span>Subtotal</span>
              <span className="font-mono">₹{billDetails.subtotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            {(billDetails.totalItemDiscount > 0 || billDetails.totalOverallDiscount > 0) && (
              <>
                {billDetails.totalItemDiscount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 pl-2">
                    <span>• Product Discounts</span>
                    <span className="font-mono">-₹{billDetails.totalItemDiscount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                  </div>
                )}
                {billDetails.totalOverallDiscount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 pl-2">
                    <span>• Invoice Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Flat'})</span>
                    <span className="font-mono">-₹{billDetails.totalOverallDiscount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-emerald-700 font-medium border-t border-dashed border-[#E4E3E0] pt-1">
                  <span>Total Discount</span>
                  <span className="font-mono">-₹{billDetails.totalDiscount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-sm text-[#666666]">
                  <span>Taxable Subtotal</span>
                  <span className="font-mono">₹{billDetails.discountedSubtotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm text-[#666666]">
              <span>CGST</span>
              <span className="font-mono">₹{billDetails.totalCgst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between text-sm text-[#666666]">
              <span>SGST</span>
              <span className="font-mono">₹{billDetails.totalSgst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="border-t border-[#E4E3E0] pt-2 mt-2 flex justify-between font-medium text-lg text-[#141414]">
              <span>Total Grand</span>
              <span className="font-mono tracking-tighter">₹{billDetails.total.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
          </div>
          <Button 
            className="w-full bg-[#141414] hover:bg-[#333333] text-white py-6 rounded-lg text-sm tracking-wider uppercase disabled:opacity-50"
            disabled={cart.length === 0}
            onClick={() => {
              setCustomerPhone("");
              setCustomerName("");
              setCustomerEmail("");
              setLinkedCustomer(null);
              setIsCustomerModalOpen(true);
            }}
          >
            Checkout & Print
          </Button>
        </div>
      </div>

      {/* Product Selection Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white rounded-xl border-0 shadow-2xl">
          {selectedProduct && (
            <>
              <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center relative overflow-hidden">
                 <img src={selectedProduct.imageUrl || DEFAULT_PRODUCT_IMAGE} alt={selectedProduct.name} className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                 <h2 className="absolute bottom-4 left-6 text-white text-xl font-medium">{selectedProduct.name}</h2>
              </div>
              <div className="p-6">
                <div className="font-mono text-2xl tracking-tighter mb-6">₹{selectedProduct.price.toLocaleString('en-IN')}</div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#666666] uppercase tracking-wider mb-2 block">Select Size</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(selectedProduct.stock).map(size => (
                        <button
                          key={size}
                          className={`px-4 py-2 text-sm rounded-md transition-all border ${sizeSelection === size ? 'border-[#141414] bg-[#141414] text-white' : 'border-[#E4E3E0] hover:border-[#141414] text-[#141414]'}`}
                          onClick={() => {
                            setSizeSelection(size);
                            setColorSelection(""); // Reset color on size change
                          }}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {sizeSelection && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-xs font-medium text-[#666666] uppercase tracking-wider mb-2 block mt-4">Select Color</label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(selectedProduct.stock[sizeSelection] || {}).map(([color, qty]) => (
                          <button
                            key={color}
                            disabled={qty === 0}
                            className={`px-4 py-2 text-sm rounded-md transition-all border ${colorSelection === color ? 'border-[#141414] bg-[#141414] text-white' : 'border-[#E4E3E0] text-[#141414] hover:border-[#141414]'} disabled:opacity-30 disabled:hover:border-[#E4E3E0] disabled:cursor-not-allowed`}
                            onClick={() => setColorSelection(color)}
                          >
                            {color} <span className="ml-1 opacity-60 text-xs">({qty})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <Button className="w-full py-6 uppercase tracking-widest text-xs" onClick={addToCart}>
                    Add to Cart
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Customer Linkage Modal */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#FAFAFA] border-0 shadow-2xl p-0 overflow-hidden rounded-xl">
          <div className="p-6 border-b border-[#E4E3E0] bg-white">
            <DialogHeader>
              <DialogTitle className="font-sans text-xl tracking-tight text-[#141414] flex items-center">
                <UserCircle className="w-5 h-5 mr-2 text-[#666666]" />
                Client Details
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-[#999999] font-mono mt-2">Enter phone number to lookup or create client</p>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase font-medium text-[#666666] tracking-wider block">Phone Number</label>
              <div className="flex gap-2">
                <Input 
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder="e.g. 9876543210"
                  className="font-mono border-[#E4E3E0]"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const cleanPhone = customerPhone.trim().replace(/[-\s+]/g, "");
                      const last10 = cleanPhone.slice(-10);
                      if (cleanPhone.length < 10 || !/^\d+$/.test(last10)) {
                        setValidationError("Please enter a valid 10-digit phone number.");
                        return;
                      }
                      setValidationError(null);
                      const found = mockCustomers.find(c => c.phone.replace(/[-\s+]/g, "").includes(last10));
                      if (found) {
                        setLinkedCustomer(found);
                        setCustomerName(found.name);
                        setCustomerEmail(found.email);
                      } else {
                        setLinkedCustomer(null);
                        setCustomerName("");
                        setCustomerEmail("");
                      }
                    }
                  }}
                />
                <Button 
                  variant="outline" 
                  className="px-4 border-[#E4E3E0] text-[#141414]"
                  onClick={() => {
                    const cleanPhone = customerPhone.trim().replace(/[-\s+]/g, "");
                    const last10 = cleanPhone.slice(-10);
                    if (cleanPhone.length < 10 || !/^\d+$/.test(last10)) {
                      setValidationError("Please enter a valid 10-digit phone number.");
                      return;
                    }
                    setValidationError(null);
                    const found = mockCustomers.find(c => c.phone.replace(/[-\s+]/g, "").includes(last10));
                    if (found) {
                      setLinkedCustomer(found);
                      setCustomerName(found.name);
                      setCustomerEmail(found.email);
                    } else {
                      setLinkedCustomer(null);
                      setCustomerName("");
                      setCustomerEmail("");
                    }
                  }}
                >
                  Lookup
                </Button>
              </div>
            </div>

            {linkedCustomer ? (
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-emerald-900">{linkedCustomer.name}</div>
                  <div className="text-xs text-emerald-700 font-mono mt-0.5">{linkedCustomer.phone}</div>
                </div>
                <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-200">Found</Badge>
              </div>
            ) : customerPhone.length >= 8 ? (
              <div className="animate-in fade-in slide-in-from-top-2 space-y-4 pt-2">
                <div className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">New Client Registration</div>
                <div className="space-y-2">
                  <label className="text-xs uppercase font-medium text-[#666666] tracking-wider block">Full Name</label>
                  <Input 
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter full name"
                    className="border-[#E4E3E0]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase font-medium text-[#666666] tracking-wider block">Email (Optional)</label>
                  <Input 
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="Enter email address"
                    type="email"
                    className="border-[#E4E3E0]"
                  />
                </div>
              </div>
            ) : null}

            {validationError && (
              <p className="text-[10px] text-red-500 font-mono text-center bg-red-50 border border-red-100 p-2.5 rounded-lg">
                {validationError}
              </p>
            )}

            {/* Payment Mode Selector */}
            <div className="space-y-2 pt-2 border-t border-[#E4E3E0]">
              <label className="text-xs uppercase font-medium text-[#666666] tracking-wider block">Payment Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {(["Cash", "Card", "UPI", "Store Credit"] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    className={`py-2 px-3 text-xs font-mono rounded-md border text-center transition-all ${
                      paymentMode === mode 
                        ? 'border-[#141414] bg-[#141414] text-white font-bold' 
                        : 'border-[#E4E3E0] hover:border-[#141414] bg-white text-[#666666]'
                    }`}
                    onClick={() => setPaymentMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-white border-t border-[#E4E3E0] flex gap-3">
             <Button 
                variant="outline"
                className="w-1/2 border-[#E4E3E0] text-[#666666] hover:bg-[#FAFAFA] hover:text-[#141414] py-6 uppercase tracking-widest text-xs"
                onClick={() => {
                  setLinkedCustomer(null);
                  const newInvoiceId = `INV-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2, '0')}-${String(Math.floor(Math.random()*1000)).padStart(3, '0')}`;                   const newTx: Transaction = {
                    id: newInvoiceId,
                    type: "offline",
                    time: new Date().toLocaleString(),
                    items: cart.reduce((acc, item) => acc + item.quantity, 0),
                    amount: billDetails.total,
                    status: "Completed",
                    customer: "Walk-in Customer",
                    paymentMode: paymentMode,
                    discount: billDetails.totalDiscount,
                    discountType: discountType,
                    discountValue: discountValue,
                    subtotal: billDetails.subtotal,
                    cgst: billDetails.totalCgst,
                    sgst: billDetails.totalSgst,
                    isGst: isGstBill,
                    discountDetails: {
                      itemDiscount: billDetails.totalItemDiscount,
                      overallDiscount: billDetails.totalOverallDiscount
                    },
                    itemsList: billDetails.items.map(item => ({
                      id: item.id,
                      name: item.name,
                      selectedSize: item.selectedSize,
                      selectedColor: item.selectedColor,
                      quantity: item.quantity,
                      price: item.price,
                      cgst: item.cgstAmount,
                      sgst: item.sgstAmount,
                      discountType: item.discountType,
                      discountValue: item.discountValue,
                      discountAmount: item.itemDiscount,
                      totalDiscount: item.totalItemDiscount
                    }))
                  };
                  mockTransactions.unshift(newTx);

                  // Deduct from inventory
                  cart.forEach(cartItem => {
                    const p = mockProducts.find(prod => prod.id === cartItem.id);
                    if (p && p.stock[cartItem.selectedSize] && p.stock[cartItem.selectedSize][cartItem.selectedColor] !== undefined) {
                      p.stock[cartItem.selectedSize][cartItem.selectedColor] = Math.max(0, p.stock[cartItem.selectedSize][cartItem.selectedColor] - cartItem.quantity);
                      saveProductToFirebase(p);
                    }
                  });

                  // Cache persistence
                  saveLocal("transactions", mockTransactions);
                  saveLocal("products", mockProducts);

                  // Firebase DB updates
                  saveTransactionToFirebase(newTx);
                  setCurrentTransaction(newTx);

                  setIsCustomerModalOpen(false);
                  setIsReceiptModalOpen(true);
                }}
              >
                Walk-in Checkout
              </Button>

              <Button 
                className="w-1/2 bg-[#141414] hover:bg-[#333333] text-white py-6 uppercase tracking-widest text-xs disabled:opacity-50"
                disabled={!customerPhone || (!linkedCustomer && !customerName)}
                onClick={() => {
                  if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
                    setValidationError("Please enter a valid email address.");
                    return;
                  }

                  let finalCustomer = linkedCustomer;
                  if (!linkedCustomer && customerName && customerPhone) {
                     const newCust: Customer = {
                       id: `C${Math.floor(Math.random() * 100000)}`,
                       name: customerName,
                       phone: customerPhone,
                       email: customerEmail,
                       totalSpent: 0,
                       purchaseHistory: []
                     };
                     mockCustomers.unshift(newCust); // register to mock for simple state sharing
                     setLinkedCustomer(newCust);
                     finalCustomer = newCust;
                  }

                  // Generate Bill & Update Inventory
                  const newInvoiceId = `INV-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2, '0')}-${String(Math.floor(Math.random()*1000)).padStart(3, '0')}`;                   const newTx: Transaction = {
                    id: newInvoiceId,
                    type: "offline",
                    time: new Date().toLocaleString(),
                    items: cart.reduce((acc, item) => acc + item.quantity, 0),
                    amount: billDetails.total,
                    status: "Completed",
                    customer: finalCustomer ? finalCustomer.name : undefined,
                    paymentMode: paymentMode,
                    discount: billDetails.totalDiscount,
                    discountType: discountType,
                    discountValue: discountValue,
                    subtotal: billDetails.subtotal,
                    cgst: billDetails.totalCgst,
                    sgst: billDetails.totalSgst,
                    isGst: isGstBill,
                    discountDetails: {
                      itemDiscount: billDetails.totalItemDiscount,
                      overallDiscount: billDetails.totalOverallDiscount
                    },
                    itemsList: billDetails.items.map(item => ({
                      id: item.id,
                      name: item.name,
                      selectedSize: item.selectedSize,
                      selectedColor: item.selectedColor,
                      quantity: item.quantity,
                      price: item.price,
                      cgst: item.cgstAmount,
                      sgst: item.sgstAmount,
                      discountType: item.discountType,
                      discountValue: item.discountValue,
                      discountAmount: item.itemDiscount,
                      totalDiscount: item.totalItemDiscount
                    }))
                  };
                  mockTransactions.unshift(newTx);

                  // Update customer spend
                  if (finalCustomer) {
                    finalCustomer.totalSpent = Math.round((finalCustomer.totalSpent + billDetails.total) * 100) / 100;
                    finalCustomer.purchaseHistory.unshift(newTx);
                  }

                  // Deduct from inventory
                  cart.forEach(cartItem => {
                    const p = mockProducts.find(prod => prod.id === cartItem.id);
                    if (p && p.stock[cartItem.selectedSize] && p.stock[cartItem.selectedSize][cartItem.selectedColor] !== undefined) {
                      p.stock[cartItem.selectedSize][cartItem.selectedColor] = Math.max(0, p.stock[cartItem.selectedSize][cartItem.selectedColor] - cartItem.quantity);
                      saveProductToFirebase(p);
                    }
                  });

                  // Cache persistence
                  saveLocal("transactions", mockTransactions);
                  saveLocal("customers", mockCustomers);
                  saveLocal("products", mockProducts);

                  // Firebase DB updates
                  saveTransactionToFirebase(newTx);
                  if (finalCustomer) {
                    saveCustomerToFirebase(finalCustomer);
                  }
                  setCurrentTransaction(newTx);

                  setIsCustomerModalOpen(false);
                  setIsReceiptModalOpen(true);
                }}
              >
                Confirm & Pay
              </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Receipt Modal */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="sm:max-w-[450px] bg-[#f9f9f9] border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Tax Invoice</DialogTitle>
          </DialogHeader>
          <div className="p-4" id="tax-invoice-preview">
            {/* Minimalist Receipt Design */}
            <div className="text-center mb-6">
              <h2 className="font-sans font-bold text-2xl tracking-tight mb-1 uppercase">STREET RAGE</h2>
              <p className="text-xs text-[#666666] font-mono whitespace-pre-line">{STORE_ADDRESS.split(', ').join('\n')}</p>
              <p className="text-xs text-[#666666] font-mono mt-1">Tel: {STORE_PHONE}</p>
              <p className="text-xs font-mono mt-2">{isGstBill ? `GSTIN: ${GSTIN}` : "ESTIMATE / NON-GST"}</p>
              <div className="mt-4 pt-4 border-t border-dashed border-[#CCCCCC]">
                <h3 className="font-sans font-semibold tracking-widest text-xs uppercase">{isGstBill ? "Tax Invoice" : "Retail Bill / Estimate"}</h3>
                <p className="text-[10px] text-[#666666] font-mono mt-1">{new Date().toLocaleString()}</p>
                
                {linkedCustomer && (
                  <div className="mt-3 p-2 bg-[#F0F0F0] rounded-sm text-center">
                    <p className="text-[10px] uppercase font-bold text-[#141414] tracking-wider">Customer Details</p>
                    <p className="text-[10px] text-[#666666] mt-1 line-clamp-1">{linkedCustomer.name} | {linkedCustomer.phone}</p>
                  </div>
                )}
                <div className="mt-2 text-xs font-mono border-t border-dashed border-[#CCCCCC] pt-2">
                  <span>Payment Mode: </span>
                  <span className="font-semibold">{paymentMode}</span>
                </div>
              </div>
            </div>

            <div className="w-full">
              <table className="w-full text-xs font-mono mb-4 text-left">
                <thead>
                  <tr className="border-b border-[#CCCCCC]">
                    <th className="py-2 font-medium">Item / HSN</th>
                    <th className="py-2 text-center font-medium">Qty</th>
                    <th className="py-2 text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {billDetails.items.map(item => {
                    const rawItemTotal = item.price * item.quantity;
                    const hasItemDisc = item.discountValue !== undefined && item.discountValue > 0;
                    const itemDiscLabel = item.discountType === 'percentage' ? `${item.discountValue}%` : `Flat ₹${item.discountValue}`;
                    return (
                      <tr key={item.cartItemId}>
                        <td className="py-3">
                          <div className="font-sans font-medium line-clamp-1">{item.name}</div>
                          <div className="text-[10px] text-[#666666]">{item.selectedSize}/{item.selectedColor} | HSN: {item.hsn}</div>
                          {hasItemDisc && (
                            <div className="text-[9px] text-emerald-600 font-medium">Disc: {itemDiscLabel} (-₹{item.itemDiscount.toLocaleString()})</div>
                          )}
                        </td>
                        <td className="py-3 text-center">{item.quantity}</td>
                        <td className="py-3 text-right">
                          {hasItemDisc && (
                            <span className="text-decoration: line-through text-[#999999] text-[9px] mr-2">₹{rawItemTotal.toLocaleString()}</span>
                          )}
                          ₹{(rawItemTotal - item.itemDiscount).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="border-t border-[#CCCCCC] pt-3 pb-3 space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#666666]">Subtotal</span>
                  <span>₹{billDetails.subtotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                {billDetails.totalItemDiscount > 0 && (
                  <div className="flex justify-between text-xs font-mono text-emerald-600">
                    <span>• Product Discounts</span>
                    <span>-₹{billDetails.totalItemDiscount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                  </div>
                )}
                {billDetails.totalOverallDiscount > 0 && (
                  <div className="flex justify-between text-xs font-mono text-emerald-600">
                    <span>• Invoice Discount</span>
                    <span>-₹{billDetails.totalOverallDiscount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                  </div>
                )}
                {billDetails.totalDiscount > 0 && (
                  <div className="flex justify-between text-xs font-mono text-emerald-600 font-bold border-t border-dashed border-[#EAEAEA] pt-1">
                    <span>Total Discount</span>
                    <span>-₹{billDetails.totalDiscount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-mono border-t border-dashed border-[#EAEAEA] pt-1">
                  <span className="text-[#666666]">Taxable Amount</span>
                  <span>₹{billDetails.discountedSubtotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-xs font-mono text-[#666666]">
                  <span>CGST</span>
                  <span>₹{billDetails.totalCgst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-xs font-mono text-[#666666]">
                  <span>SGST</span>
                  <span>₹{billDetails.totalSgst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
              </div>

              <div className="border-t-2 border-[#141414] pt-3 flex justify-between items-end">
                <span className="font-sans font-semibold uppercase tracking-wider text-sm">Grand Total</span>
                <span className="font-mono text-xl font-bold tracking-tighter">₹{billDetails.total.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              </div>
            </div>
            
            <div className="mt-8 text-center text-[10px] text-[#999999] uppercase tracking-widest font-mono">
              Thank you for shopping<br/>All exchanges within 14 days
            </div>
          </div>
          
          <DialogFooter className="mt-2 text-center flex-col sm:flex-col gap-2">
            <Button className="w-full bg-[#141414] text-white" onClick={() => {
              handlePrintReceipt();
              setCart([]);
              setDiscountValue(0);
              setIsReceiptModalOpen(false);
            }}>
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
            <Button variant="outline" className="w-full border-0 bg-transparent text-[#666666] hover:bg-[#EAEAEA]" onClick={() => setIsReceiptModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
