import { useState, useEffect } from "react";
import { mockTransactions, mockProducts, parseTxDate } from "@/lib/mock";
import JsBarcode from "jsbarcode";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, Package, Store, Cpu, TrendingUp, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase().includes("admin") ?? true;

  const [transactions, setTransactions] = useState(() => [...mockTransactions]);
  const [products, setProducts] = useState(() => [...mockProducts]);
  const [isRevModalOpen, setIsRevModalOpen] = useState(false);

  useEffect(() => {
    const handleSync = () => {
      setTransactions([...mockTransactions]);
      setProducts([...mockProducts]);
    };
    window.addEventListener("db-sync-complete", handleSync);
    return () => window.removeEventListener("db-sync-complete", handleSync);
  }, []);

  const totalRev = transactions.reduce((sum, t) => sum + t.amount, 0);

  const todayTxs = transactions.filter(t => {
    const d = parseTxDate(t.time);
    if (!d) return false;
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  });

  const todayRev = todayTxs.reduce((sum, t) => sum + t.amount, 0);
  const todayTxsCount = todayTxs.length;

  const todayCash = todayTxs.filter(t => t.paymentMode === "Cash").reduce((sum, t) => sum + t.amount, 0);
  const todayUPI = todayTxs.filter(t => t.paymentMode === "UPI").reduce((sum, t) => sum + t.amount, 0);
  const todayCard = todayTxs.filter(t => t.paymentMode === "Card").reduce((sum, t) => sum + t.amount, 0);
  const todayCredit = todayTxs.filter(t => t.paymentMode === "Store Credit").reduce((sum, t) => sum + t.amount, 0);

  const allCash = transactions.filter(t => t.paymentMode === "Cash").reduce((sum, t) => sum + t.amount, 0);
  const allUPI = transactions.filter(t => t.paymentMode === "UPI").reduce((sum, t) => sum + t.amount, 0);
  const allCard = transactions.filter(t => t.paymentMode === "Card").reduce((sum, t) => sum + t.amount, 0);
  const allCredit = transactions.filter(t => t.paymentMode === "Store Credit").reduce((sum, t) => sum + t.amount, 0);

  const totalStockItems = products.reduce((sum, p) => {
    let prodSum = 0;
    Object.values(p.stock || {}).forEach(sizeObj => {
      Object.values(sizeObj || {}).forEach(qty => {
        prodSum += qty;
      });
    });
    return sum + prodSum;
  }, 0);

  // Dynamic variant-level low stock alerts
  const lowStockAlerts: { name: string; variant: string; qty: number }[] = [];
  products.forEach(p => {
    Object.entries(p.stock || {}).forEach(([size, colorObj]) => {
      Object.entries(colorObj || {}).forEach(([color, qty]) => {
        if (qty >= 0 && qty <= 5) {
          lowStockAlerts.push({
            name: p.name,
            variant: `${size} / ${color}`,
            qty
          });
        }
      });
    });
  });

  const handleTestPrint = (type: 'receipt' | 'barcode') => {
    const printEl = document.createElement('div');
    if (type === 'receipt') {
      printEl.id = 'tax-invoice';
      printEl.style.padding = '20px';
      printEl.innerHTML = `
        <div style="font-family: monospace; text-align: center; color: #141414;">
          <h2 style="margin: 0 0 5px 0; font-size: 18px; font-weight: bold; letter-spacing: 1px;">STREET RAGE</h2>
          <p style="margin: 0; font-size: 10px; line-height: 1.2;">1st Floor, RMZ Latitude, Hebbal<br/>Bengaluru 560024</p>
          <p style="margin: 10px 0; font-size: 10px;">------------------------------------</p>
          <h3 style="margin: 0 0 10px 0; font-size: 12px; font-weight: bold; text-transform: uppercase;">THERMAL PRINTER TEST</h3>
          <p style="margin: 5px 0; font-size: 10px;">Status: ONLINE</p>
          <p style="margin: 5px 0; font-size: 10px;">Model: SP-POS893UED</p>
          <p style="margin: 5px 0; font-size: 10px;">Connection: USB PRINTER</p>
          <p style="margin: 5px 0; font-size: 10px;">Time: ${new Date().toLocaleString()}</p>
          <p style="margin: 10px 0; font-size: 10px;">------------------------------------</p>
          <p style="margin: 0; font-size: 9px; letter-spacing: 1px;">BILL PRINTER READY</p>
        </div>
      `;
    } else {
      printEl.id = 'barcode-sticker';
      printEl.innerHTML = `
      <div style="font-family: monospace; text-align: center; font-size: 12px; width: 50mm; height: 50mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; background: white; color: black; box-sizing: border-box; padding: 8px 2px 8px 2px;">
        <div style="font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid #141414; width: 44mm; padding-bottom: 2px;">STREET RAGE</div>
        <div style="font-size: 10px; margin-top: 2px; color: #141414; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 44mm;">TEST STICKER</div>
        <div style="height: 16mm; display: flex; align-items: center; justify-content: center; overflow: hidden; margin: 2px 0; width: 44mm;">
          <svg id="barcode-svg" style="max-width: 100%; height: auto;"></svg>
        </div>
        <div style="font-size: 9px; letter-spacing: 1px; font-family: monospace; font-weight: bold; color: #666666;">SR-TEST-OK</div>
        <div style="font-size: 12px; font-weight: bold; border-top: 1px dashed #666666; width: 44mm; padding-top: 4px;">READY</div>
      </div>
      `;
    }

    const styleEl = document.createElement('style');
    styleEl.innerHTML = `@page { size: ${type === 'receipt' ? '80mm 200mm' : '50mm 50mm'}; margin: 0; }`;

    document.body.appendChild(printEl);
    document.head.appendChild(styleEl);

    if (type === 'barcode') {
      try {
        const svgEl = printEl.querySelector('#barcode-svg');
        if (svgEl) {
          JsBarcode(svgEl, "SR-TEST-OK", {
            format: "CODE128",
            width: 1.8,
            height: 40,
            displayValue: false,
            margin: 0,
            background: "transparent"
          });
        }
      } catch (err) {
        console.error("Test barcode generation error:", err);
      }
    }

    window.print();

    setTimeout(() => {
      document.body.removeChild(printEl);
      document.head.removeChild(styleEl);
    }, 500);
  };

  return (
    <div className="flex-1 p-8 overflow-auto bg-[#F5F5F3]">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex justify-between items-end"
      >
        <div>
          <h2 className="font-serif italic text-muted-foreground text-sm uppercase tracking-widest mb-1">Overview</h2>
          <h1 className="font-sans text-4xl tracking-tight text-[#141414] font-light">Retail <span className="font-medium">Dashboard</span></h1>
        </div>
        <div className="flex items-end gap-4">
          <div className="text-right">
            <div className="font-mono text-xs text-muted-foreground uppercase">Live status</div>
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium mt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              System Online
            </div>
          </div>
        </div>
      </motion.header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4"
      >
        {/* Total Revenue */}
        <Card 
          onClick={() => isAdmin && setIsRevModalOpen(true)}
          className={`col-span-1 md:col-span-2 p-6 rounded-2xl bg-white border border-transparent shadow-sm flex flex-col justify-between relative overflow-hidden min-h-[160px] transition-all duration-200 ${
            isAdmin ? 'cursor-pointer hover:shadow-md hover:border-[#E4E3E0] active:scale-[0.99]' : ''
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="text-sm font-medium text-[#666666] uppercase tracking-wider">Today's Revenue</div>
            {isAdmin && (
              <span className="text-[9px] font-mono text-muted-foreground bg-neutral-100 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                Click for Analysis
              </span>
            )}
          </div>
          {isAdmin ? (
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="font-sans text-5xl font-light tracking-tighter">₹{todayRev.toLocaleString('en-IN')}</span>
              <span className="text-sm text-emerald-600 flex items-center bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                <ArrowUpRight className="w-3 h-3 mr-1" />
                Live
              </span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground font-mono mt-auto py-2">Access Restricted (Admin Only)</div>
          )}
        </Card>

        {/* Total Bills */}
        <Card className="col-span-1 p-6 rounded-2xl bg-[#141414] text-white border-0 shadow-sm flex flex-col justify-between min-h-[160px]">
          <div className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">Total Bills Generated</div>
          {isAdmin ? (
            <div className="font-sans text-4xl tracking-tighter mt-auto">
              {todayTxsCount}
            </div>
          ) : (
            <div className="text-xs text-white/40 font-mono mt-auto py-2">Access Restricted (Admin Only)</div>
          )}
          <div className="text-xs text-white/60 mt-2">Today ({transactions.length} all-time)</div>
        </Card>

        {/* Total Products in Inventory */}
        <Card className="col-span-1 p-6 rounded-2xl bg-white border-0 shadow-sm flex flex-col justify-between min-h-[160px]">
          <div className="text-sm font-medium text-[#666666] uppercase tracking-wider mb-4">Total Products</div>
          <div className="font-sans text-4xl tracking-tighter mt-auto">
            {products.length} <span className="text-xs text-[#999999] font-mono font-normal">({totalStockItems} items)</span>
          </div>
          <div className="text-xs text-[#999999] mt-2">In stock</div>
        </Card>
      </motion.div>

      {/* Revenue Analysis Dialog */}
      <Dialog open={isRevModalOpen} onOpenChange={setIsRevModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white border border-[#E4E3E0] rounded-2xl shadow-lg p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-xl font-light text-[#141414] tracking-tight">
              Revenue <span className="font-semibold">Analysis</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              Breakdown of offline store sales revenue
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-6">
            {/* Top Cards for Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#F5F5F3] border border-[#E4E3E0] flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-[#666666] font-medium font-mono mb-1">Today's Revenue</span>
                <span className="text-2xl font-semibold text-[#141414] tracking-tight">₹{todayRev.toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-muted-foreground font-mono mt-1">{todayTxsCount} bills</span>
              </div>
              <div className="p-4 rounded-xl bg-[#141414] text-white flex flex-col justify-between">
                <span className="text-[10px] uppercase tracking-wider text-white/60 font-medium font-mono mb-1 font-bold">Total Revenue</span>
                <span className="text-2xl font-bold tracking-tight text-white">₹{totalRev.toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-white/60 font-mono mt-1">{transactions.length} bills</span>
              </div>
            </div>

            {/* Payment Split Section */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#141414] mb-3 font-mono flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                Payment Method Splits (All-Time)
              </h4>
              <div className="space-y-2.5">
                {[
                  { name: "Cash", value: allCash, count: transactions.filter(t => t.paymentMode === "Cash").length, color: "bg-emerald-500" },
                  { name: "UPI", value: allUPI, count: transactions.filter(t => t.paymentMode === "UPI").length, color: "bg-sky-500" },
                  { name: "Card", value: allCard, count: transactions.filter(t => t.paymentMode === "Card").length, color: "bg-indigo-500" },
                  { name: "Store Credit", value: allCredit, count: transactions.filter(t => t.paymentMode === "Store Credit").length, color: "bg-amber-500" },
                ].map(item => {
                  const pct = totalRev > 0 ? (item.value / totalRev) * 100 : 0;
                  return (
                    <div key={item.name} className="flex flex-col">
                      <div className="flex justify-between text-xs font-mono text-[#666666] mb-1">
                        <span className="font-sans text-[#141414] font-medium">{item.name} ({item.count})</span>
                        <span className="text-[#141414] font-bold">₹{item.value.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-muted-foreground">({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div className="w-full bg-[#F5F5F3] h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Today's Splits */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#141414] mb-3 font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Payment Method Splits (Today)
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#666666]">
                <div className="p-2.5 rounded-lg border border-[#E4E3E0] bg-[#FAFAFA] flex justify-between items-center">
                  <span>Cash:</span>
                  <span className="font-bold text-[#141414]">₹{todayCash.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-[#E4E3E0] bg-[#FAFAFA] flex justify-between items-center">
                  <span>UPI:</span>
                  <span className="font-bold text-[#141414]">₹{todayUPI.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-[#E4E3E0] bg-[#FAFAFA] flex justify-between items-center">
                  <span>Card:</span>
                  <span className="font-bold text-[#141414]">₹{todayCard.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-[#E4E3E0] bg-[#FAFAFA] flex justify-between items-center">
                  <span>Credit:</span>
                  <span className="font-bold text-[#141414]">₹{todayCredit.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        {/* Activity Feed */}
        <Card className="col-span-1 md:col-span-2 p-6 rounded-2xl bg-white border-0 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-[#666666] uppercase tracking-wider mb-6">Recent Bills</h3>
            {transactions.length === 0 ? (
              <div className="text-xs text-muted-foreground font-mono py-8 text-center">No recent bills found.</div>
            ) : (
              <div className="space-y-4">
                {transactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center py-3 border-b border-[#F0F0F0] last:border-0 hover:bg-[#FAFAFA] transition-colors -mx-4 px-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 text-blue-600">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#141414]">Invoice: {tx.id}</div>
                        <div className="text-xs text-[#999999]">{tx.time} {tx.customer && `• ${tx.customer}`}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      {isAdmin ? (
                        <div className="font-mono text-sm">₹{tx.amount.toLocaleString('en-IN')}</div>
                      ) : (
                        <div className="font-mono text-sm">₹***</div>
                      )}
                      <div className="text-xs text-[#999999]">{tx.items} {tx.items === 1 ? 'item' : 'items'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        
        {/* Low Stock Alerts */}
        <Card className="col-span-1 p-6 rounded-2xl bg-orange-50 border-0 shadow-sm border-orange-100 border text-orange-950 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-orange-800 uppercase tracking-wider mb-6 flex items-center">
              <Package className="w-4 h-4 mr-2" />
              Low Stock Alerts
            </h3>
            <div className="space-y-4">
              {lowStockAlerts.length === 0 ? (
                <p className="text-xs text-orange-700 italic py-4">No low stock alerts. All items are in adequate stock.</p>
              ) : (
                lowStockAlerts.slice(0, 4).map((alert, index) => (
                  <div key={index} className="p-3 bg-white/60 rounded-xl">
                    <div className="text-sm font-medium truncate">{alert.name}</div>
                    <div className="flex justify-between text-xs mt-1 text-orange-700">
                      <span>{alert.variant}</span>
                      <span className="font-mono font-bold">
                        {alert.qty === 0 ? "Out of stock" : `${alert.qty} left`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Hardware Status Widget */}
        <Card className="col-span-1 p-6 rounded-2xl bg-white border-0 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-[#666666] uppercase tracking-wider mb-6 flex items-center">
              <Cpu className="w-4 h-4 mr-2 text-[#999999]" />
              Hardware Status
            </h3>
            <div className="space-y-4">
              {/* Thermal Printer */}
              <div className="border-b border-[#F0F0F0] pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#141414]">Thermal Bill Printer</span>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-mono px-1.5 py-0.5 rounded">ONLINE</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-[#999999] font-mono">SP-POS893UED (80mm)</span>
                  <button 
                    onClick={() => handleTestPrint('receipt')} 
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-mono font-semibold"
                  >
                    Test Print
                  </button>
                </div>
              </div>

              {/* Barcode Scanner */}
              <div className="border-b border-[#F0F0F0] pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#141414]">Barcode Scanner</span>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-mono px-1.5 py-0.5 rounded">STANDBY</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-[#999999] font-mono">MJ2818A (USB-HID)</span>
                  <span className="text-[10px] text-[#999999] font-mono italic">Ready</span>
                </div>
              </div>

              {/* Barcode Printer */}
              <div className="pb-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#141414]">Barcode Printer</span>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-mono px-1.5 py-0.5 rounded">ONLINE</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-[#999999] font-mono">TVS LP 46 Dlite (50x25)</span>
                  <button 
                    onClick={() => handleTestPrint('barcode')} 
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-mono font-semibold"
                  >
                    Test Sticker
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
