import { useState, useMemo } from "react";
import { mockReturns, ReturnRecord, mockProducts, mockTransactions, saveLocal, Transaction, TransactionItem, STORE_ADDRESS, STORE_PHONE, GSTIN } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, RotateCcw, AlertTriangle, ArrowRight, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { saveProductToFirebase, saveTransactionToFirebase, saveReturnToFirebase } from "@/lib/db";

export function Returns() {
  const [search, setSearch] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundTx, setFoundTx] = useState<Transaction | null>(null);
  const [selectedAction, setSelectedAction] = useState<"Refund to Source" | "Store Credit" | "Size Exchange" | null>(null);
  
  // Resolve item descriptions (creates a fallback item if itemsList is missing in legacy orders)
  const resolvedItemsList = useMemo<TransactionItem[]>(() => {
    if (!foundTx) return [];
    if (foundTx.itemsList && foundTx.itemsList.length > 0) {
      return foundTx.itemsList;
    }
    return [{
      id: "legacy",
      name: "Legacy Apparel / Casuals",
      selectedSize: "One Size",
      selectedColor: "Default",
      quantity: foundTx.items || 1,
      price: foundTx.amount,
      cgst: 0,
      sgst: 0
    }];
  }, [foundTx]);
  
  // Track selected items to return: record of "uniqueKey" -> boolean
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});
  const [exchangeSizes, setExchangeSizes] = useState<Record<string, string>>({});

  const [creditNoteOpen, setCreditNoteOpen] = useState(false);
  const [processedReturn, setProcessedReturn] = useState<ReturnRecord | null>(null);

  const handleSearch = () => {
    setSearchError(null);
    setFoundTx(null);
    setSelectedAction(null);
    setSelectedItems({});
    setReturnReasons({});
    setExchangeSizes({});

    const cleanSearch = search.trim();
    if (!cleanSearch) return;

    // Search in mockTransactions database
    const found = mockTransactions.find(t => t.id.toLowerCase() === cleanSearch.toLowerCase());
    if (found) {
      if (found.status === "Refunded") {
        setSearchError("This transaction has already been fully refunded.");
      } else {
        setFoundTx(found);
      }
    } else {
      setSearchError("Order ID / Invoice Number not found in database.");
    }
  };

  const refundAmount = useMemo(() => {
    if (!foundTx) return 0;
    return resolvedItemsList.reduce((sum, item, idx) => {
      const uniqueKey = `${item.id}-${item.selectedSize}-${item.selectedColor}-${idx}`;
      if (selectedItems[uniqueKey]) {
        return sum + item.price;
      }
      return sum;
    }, 0);
  }, [foundTx, selectedItems, resolvedItemsList]);

  const hasSelectedItems = useMemo(() => {
    return Object.values(selectedItems).some(Boolean);
  }, [selectedItems]);

  const isProcessDisabled = useMemo(() => {
    if (!selectedAction || !hasSelectedItems) return true;
    if (selectedAction === "Size Exchange") {
      // Check if any selected item is missing new size selection
      return Object.entries(selectedItems).some(([key, checked]) => {
        if (!checked) return false;
        return !exchangeSizes[key];
      });
    }
    return false;
  }, [selectedAction, selectedItems, exchangeSizes]);

  const handleProcessRMA = () => {
    if (!foundTx || isProcessDisabled) return;

    // Construct the ReturnRecord details
    const returnedItems = Object.entries(selectedItems)
      .filter(([_, checked]) => checked)
      .map(([key]) => {
        const parts = key.split("-");
        const itemIdx = parseInt(parts[parts.length - 1]);
        const item = resolvedItemsList[itemIdx];
        return {
          id: item.id,
          name: item.name,
          reason: returnReasons[key] || "Customer request",
          amount: item.price,
          originalSize: item.selectedSize,
          originalColor: item.selectedColor,
          newSize: exchangeSizes[key]
        };
      });

    const returnRecord: ReturnRecord = {
      id: `RET-${Math.floor(100000 + Math.random() * 900000)}`,
      orderId: foundTx.id,
      date: new Date().toLocaleString(),
      customer: foundTx.customer || "Walk-in Customer",
      type: selectedAction === "Size Exchange" ? "Size Exchange" : (selectedAction === "Store Credit" ? "Store Credit" : (selectedAction === "Refund to Source" ? "Refund to Source" : "Refund")),
      status: "Processed",
      items: returnedItems,
      totalRefund: selectedAction === "Size Exchange" ? 0 : refundAmount
    };

    setProcessedReturn(returnRecord);
    setCreditNoteOpen(true);
  };

  const handleConfirmReturnPrint = () => {
    if (!foundTx || !processedReturn) return;

    // Apply adjustments to stock levels in mockProducts
    processedReturn.items.forEach(item => {
      const prod = mockProducts.find(p => p.id === item.id || p.name.toLowerCase() === item.name.toLowerCase());
      if (prod) {
        // Restock original item
        if (prod.stock[item.originalSize]) {
          prod.stock[item.originalSize][item.originalColor] = (prod.stock[item.originalSize][item.originalColor] || 0) + 1;
        } else {
          prod.stock[item.originalSize] = { [item.originalColor]: 1 };
        }

        // Deduct exchange item
        if (processedReturn.type === "Size Exchange" && item.newSize) {
          if (prod.stock[item.newSize] && prod.stock[item.newSize][item.originalColor] !== undefined) {
            prod.stock[item.newSize][item.originalColor] = Math.max(0, prod.stock[item.newSize][item.originalColor] - 1);
          }
        }
        
        saveProductToFirebase(prod);
      }
    });

    // Update original transaction status if it's a refund, store credit, or refund to source
    if (processedReturn.type === "Refund" || processedReturn.type === "Refund to Source" || processedReturn.type === "Store Credit") {
      const tx = mockTransactions.find(t => t.id === foundTx.id);
      if (tx) {
        tx.status = "Refunded";
        saveTransactionToFirebase(tx);
      }
    }

    // Insert return record to mock database
    mockReturns.unshift(processedReturn);
    saveReturnToFirebase(processedReturn);

    // Save modifications to cache
    saveLocal("products", mockProducts);
    saveLocal("transactions", mockTransactions);
    saveLocal("returns", mockReturns);

    // Thermal Printer Slip Generation and Printing
    const printEl = document.createElement('div');
    printEl.id = 'tax-invoice';

    const storeAddress = STORE_ADDRESS;
    const storePhone = STORE_PHONE;
    const gstin = GSTIN;

    let label = "RETURN SLIP";
    let typeSection = "";

    if (processedReturn.type === "Refund to Source") {
      label = "REFUND RECEIPT";
      typeSection = `
        <strong>Refund Method:</strong> Refund to Source<br/>
        <strong>Refund Status:</strong> Completed (Processed)
      `;
    } else if (processedReturn.type === "Store Credit") {
      label = "CREDIT NOTE";
      typeSection = `
        <strong>Credit Note ID:</strong> ${processedReturn.id}<br/>
        <strong>Validity:</strong> 180 Days from Issue
      `;
    } else if (processedReturn.type === "Size Exchange") {
      label = "EXCHANGE SLIP";
      typeSection = `
        <strong>Exchange Status:</strong> Approved & Stocks Synced
      `;
    }

    let htmlContent = `
      <div style="font-family: monospace; text-align: center; color: #141414; padding: 10px 4px 10px 4px;">
        <h2 style="margin: 0 0 5px 0; font-size: 20px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">STREET RAGE</h2>
        <p style="margin: 0; font-size: 10px; line-height: 1.2; color: #666666;">${storeAddress.split(', ').join('<br/>')}</p>
        <p style="margin: 3px 0; font-size: 10px; color: #666666;">Tel: ${storePhone}</p>
        <p style="margin: 5px 0; font-size: 10px; color: #666666;">GSTIN: ${gstin}</p>
        
        <div style="margin: 10px 0; border-top: 1px dashed #CCCCCC; padding-top: 10px;">
          <h3 style="margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">${label}</h3>
          <p style="margin: 5px 0 0 0; font-size: 9px; color: #999999;">${processedReturn.date}</p>
        </div>
        
        <div style="text-align: left; background: #F9F9F9; padding: 6px; margin: 10px 0; font-size: 10px; border-radius: 4px; border: 1px solid #EAEAEA;">
          <strong>Slip Ref ID:</strong> ${processedReturn.id}<br/>
          <strong>Original Inv:</strong> ${processedReturn.orderId}<br/>
          <strong>Customer:</strong> ${processedReturn.customer}<br/>
          ${typeSection}
        </div>

        <table style="width: 100%; font-size: 10px; text-align: left; margin: 15px 0; border-collapse: collapse;">
          <thead>
            <tr style="border-b: 1px solid #CCCCCC; font-weight: bold;">
              <th style="padding: 4px 0;">Item Detail</th>
              <th style="padding: 4px 0; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${processedReturn.items.map(item => `
              <tr style="border-b: 1px solid #EAEAEA;">
                <td style="padding: 6px 0;">
                  <div>${item.name}</div>
                  <div style="font-size: 8px; color: #666666;">Original Size: ${item.originalSize} | Color: ${item.originalColor}</div>
                  <div style="font-size: 8px; color: #666666;">Reason: ${item.reason}</div>
                  ${item.newSize ? `<div style="font-size: 8px; color: #10b981; font-weight: bold;">Exchanged to Size: ${item.newSize}</div>` : ''}
                </td>
                <td style="padding: 6px 0; text-align: right; vertical-align: top;">₹${item.amount.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="border-top: 1px solid #CCCCCC; padding-top: 8px; font-size: 10px; line-height: 1.5;">
          ${processedReturn.type !== "Size Exchange" ? `
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 5px; border-top: 1px solid #141414; padding-top: 5px;">
              <span>Total Credit/Refunded:</span>
              <span>₹${processedReturn.totalRefund.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 5px; border-top: 1px solid #141414; padding-top: 5px;">
              <span>Net Exchange Diff:</span>
              <span>₹0.00</span>
            </div>
          `}
        </div>
        
        <p style="margin: 25px 0 0 0; font-size: 8px; color: #999999; text-transform: uppercase; letter-spacing: 1px;">
          ${processedReturn.type === "Store Credit" ? 'This note must be presented<br/>during future checkouts.' : 'Thank you for shopping<br/>STREET RAGE Omnichannel POS'}
        </p>
      </div>
    `;

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

    setCreditNoteOpen(false);
    setSearch("");
    setFoundTx(null);
    setProcessedReturn(null);
  };

  return (
    <div className="flex w-full h-full bg-[#FAFAFA]">
      <div className="flex-1 p-8 overflow-y-auto w-full max-w-4xl mx-auto">
        <h2 className="font-serif italic text-muted-foreground text-sm uppercase tracking-widest mb-1">RMA Processing</h2>
        <h1 className="font-sans text-4xl tracking-tight text-[#141414] font-light mb-8">Returns & <span className="font-medium">Exchanges</span></h1>

        {/* Search Bar */}
        <Card className="p-6 bg-white border-[#E4E3E0] shadow-sm mb-8">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#999999] w-5 h-5" />
              <Input 
                placeholder="Scan or enter Invoice ID (e.g. INV-202606-001)..." 
                className="pl-12 py-6 text-lg bg-[#FAFAFA] border-[#E4E3E0] focus-visible:ring-[#141414]"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setSearchError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button className="py-6 px-8 bg-[#141414] hover:bg-[#333333] text-white" onClick={handleSearch}>
              Lookup Invoice
            </Button>
          </div>
          {searchError && (
            <p className="text-xs text-red-500 font-mono mt-3 leading-relaxed bg-red-50 border border-red-100 p-2.5 rounded-lg">
              {searchError}
            </p>
          )}
        </Card>

        {foundTx && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 bg-white border-[#E4E3E0] shadow-sm">
                <div className="text-xs text-[#999999] uppercase tracking-wider mb-4 border-b border-[#E4E3E0] pb-2">Order Details</div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-2xl font-mono tracking-tighter text-[#141414]">{foundTx.id}</div>
                    <div className="text-sm text-[#666666] mt-1">{foundTx.time}</div>
                  </div>
                  <Badge variant="outline" className="bg-slate-50">{foundTx.status}</Badge>
                </div>
                <div className="text-sm font-medium text-[#141414] flex items-center">
                  <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3 text-xs">
                    {foundTx.customer ? foundTx.customer.substring(0, 2) : "WK"}
                  </span>
                  {foundTx.customer || "Walk-in Customer"}
                </div>
                {foundTx.paymentMode && (
                  <div className="text-xs text-[#999999] mt-3 font-mono">Paid via: <span className="font-semibold">{foundTx.paymentMode}</span></div>
                )}
              </Card>
              
              <Card className="p-6 bg-white border-[#E4E3E0] shadow-sm">
                 <div className="text-xs text-[#999999] uppercase tracking-wider mb-4 border-b border-[#E4E3E0] pb-2">Select Action</div>
                 <div className="flex flex-col gap-3">
                   {["Refund to Source", "Store Credit", "Size Exchange"].map(action => (
                     <button
                       key={action}
                       className={`p-3 text-sm text-left font-medium rounded-lg border transition-all ${selectedAction === action ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white text-[#141414] border-[#E4E3E0] hover:border-[#141414]'}`}
                       onClick={() => setSelectedAction(action as any)}
                     >
                       {action}
                     </button>
                   ))}
                 </div>
              </Card>
            </div>

            <Card className="bg-white border-[#E4E3E0] shadow-sm overflow-hidden">
               <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E3E0] text-xs font-semibold text-[#666666] uppercase tracking-wider">
                 Select Items in Invoice for Adjustment
               </div>
               <div className="divide-y divide-[#E4E3E0]">
                 {resolvedItemsList.length > 0 ? (
                   resolvedItemsList.map((item, i) => {
                     const uniqueKey = `${item.id}-${item.selectedSize}-${item.selectedColor}-${i}`;
                     const isChecked = !!selectedItems[uniqueKey];
                     return (
                       <div key={uniqueKey} className="p-6 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                           <input 
                             type="checkbox" 
                             checked={isChecked}
                             onChange={e => setSelectedItems(prev => ({ ...prev, [uniqueKey]: e.target.checked }))}
                             className="w-4 h-4 rounded border-[#E4E3E0] text-[#141414] focus:ring-[#141414] cursor-pointer"
                           />
                           <div>
                             <div className="font-medium text-[#141414]">{item.name}</div>
                             <div className="text-xs text-[#666666] mt-0.5 font-mono">
                               Size: {item.selectedSize} | Color: {item.selectedColor}
                             </div>
                           </div>
                         </div>
                         <div className="text-right flex flex-col items-end gap-2">
                            <div className="font-mono text-base">₹{item.price.toLocaleString()}</div>
                            {isChecked && (
                              <div className="flex flex-col gap-2 mt-2">
                                 <Input 
                                   placeholder="Reason for return..." 
                                   value={returnReasons[uniqueKey] || ""}
                                   onChange={e => setReturnReasons(prev => ({ ...prev, [uniqueKey]: e.target.value }))}
                                   className="text-xs border-[#E4E3E0] h-8 bg-white w-48"
                                 />
                                 {selectedAction === "Size Exchange" && (
                                   <select 
                                     className="border border-[#E4E3E0] text-xs rounded-md p-1.5 bg-white w-48 font-sans" 
                                     value={exchangeSizes[uniqueKey] || ""} 
                                     onChange={e => setExchangeSizes(prev => ({ ...prev, [uniqueKey]: e.target.value }))}
                                   >
                                     <option value="">New Size Selection</option>
                                     <option value="S">S</option>
                                     <option value="M">M</option>
                                     <option value="L">L</option>
                                     <option value="XL">XL</option>
                                     <option value="XXL">XXL</option>
                                     <option value="One Size">One Size</option>
                                   </select>
                                 )}
                              </div>
                            )}
                         </div>
                       </div>
                     );
                   })
                 ) : (
                   <p className="p-6 text-xs text-muted-foreground italic font-mono text-center">No detailed items recorded in this invoice.</p>
                 )}
               </div>
               
               <div className="p-6 bg-[#FAFAFA] border-t border-[#E4E3E0] flex justify-between items-center">
                 <div>
                   {selectedAction !== "Size Exchange" && hasSelectedItems && (
                     <>
                        <div className="text-xs text-[#666666] uppercase tracking-wider">Refund Amount</div>
                        <div className="font-mono text-xl font-bold tracking-tighter text-red-600">
                          -₹{refundAmount.toLocaleString()}
                        </div>
                     </>
                   )}
                 </div>
                 <Button 
                   className="bg-[#141414] hover:bg-[#333333] text-white px-8 uppercase text-xs tracking-wider"
                   disabled={isProcessDisabled}
                   onClick={handleProcessRMA}
                 >
                   Process {selectedAction ? selectedAction.split(' ')[0] : 'RMA'}
                 </Button>
               </div>
            </Card>
          </motion.div>
        )}
      </div>

      <Dialog open={creditNoteOpen} onOpenChange={open => {
        if (!open) {
          setCreditNoteOpen(false);
          setProcessedReturn(null);
        }
      }}>
        <DialogContent className="sm:max-w-[450px] bg-[#f9f9f9] border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center border-b border-[#CCCCCC] pb-4">
              <span className="font-serif italic text-2xl tracking-tight">STREET RAGE</span>
              <Badge variant="outline" className="font-mono uppercase text-[10px] bg-red-50 text-red-700 border-red-200">Credit Note</Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">Print Credit Note details</DialogDescription>
          </DialogHeader>
          {processedReturn && (
            <div className="py-4">
               <div className="grid grid-cols-2 gap-4 text-xs font-mono mb-6">
                  <div>
                    <div className="text-[#999999]">Note No.</div>
                    <div className="font-medium">{processedReturn.id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[#999999]">Date</div>
                    <div className="font-medium">{new Date(processedReturn.date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-[#999999]">Original Inv.</div>
                    <div className="font-medium">{processedReturn.orderId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[#999999]">GSTIN</div>
                    <div className="font-medium text-[10px]">29ABCDE1234F1Z5</div>
                  </div>
               </div>

               <div className="bg-white border border-[#EAEAEA] rounded-md p-3 mb-4">
                 <div className="text-[10px] uppercase text-[#666666] tracking-wider mb-2">Adjustments</div>
                 {processedReturn.items.map((item, i) => {
                   const taxRate = item.amount < 1000 ? 0.05 : 0.12;
                   const base = item.amount / (1 + taxRate);
                   const cgst = (item.amount - base) / 2;
                   return (
                     <div key={i} className="flex justify-between items-start text-xs font-mono border-b border-dashed border-[#EAEAEA] pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                       <div className="flex-1">
                         <span className="font-sans font-medium line-clamp-1">{item.name}</span>
                         <span className="block text-[#999999] text-[10px] mt-1">
                           Size: {item.originalSize} | Color: {item.originalColor} | Reason: {item.reason}
                         </span>
                         <span className="block text-[#999999] text-[10px] mt-0.5">Tax: {taxRate * 100}% | CGST: ₹{cgst.toFixed(2)} | SGST: ₹{cgst.toFixed(2)}</span>
                         {processedReturn.type === 'Size Exchange' && item.newSize && (
                           <span className="block text-emerald-600 text-[10px] mt-1 font-sans font-medium">Exchanged size: {item.newSize}</span>
                         )}
                       </div>
                       <span className="text-right ml-2">₹{item.amount.toLocaleString()}</span>
                     </div>
                   );
                 })}
               </div>

               {processedReturn.type !== 'Size Exchange' && (
                 <div className="text-right font-mono flex flex-col items-end border-t border-[#141414] pt-2">
                   <div className="text-xs text-[#666666] uppercase font-sans">Total Refund Credited</div>
                   <div className="text-xl font-bold tracking-tighter">₹{processedReturn.totalRefund.toLocaleString()}</div>
                 </div>
               )}
               
               {processedReturn.type === 'Size Exchange' && (
                 <div className="text-center font-sans text-sm font-medium text-emerald-700 bg-emerald-50 py-3 rounded-md border border-emerald-100">
                   Exchange Approved & Inventory Stock Synced
                 </div>
               )}
            </div>
          )}
          <DialogFooter>
             <Button className="w-full bg-[#141414] text-white" onClick={handleConfirmReturnPrint}>
                <FileText className="w-4 h-4 mr-2" />
                Print Credit Note
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
