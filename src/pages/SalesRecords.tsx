import { useState } from "react";
import { mockTransactions, Transaction, STORE_ADDRESS, STORE_PHONE, GSTIN } from "@/lib/mock";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Printer, FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { motion } from "framer-motion";

export function SalesRecords() {
  const [search, setSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const filtered = mockTransactions.filter(tx => 
    tx.id.toLowerCase().includes(search.toLowerCase()) || 
    (tx.customer && tx.customer.toLowerCase().includes(search.toLowerCase())) ||
    tx.time.toLowerCase().includes(search.toLowerCase())
  );

  const getTxDetails = (tx: Transaction) => {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let items: { name: string; info: string; qty: number; total: number }[] = [];

    if (tx.itemsList && tx.itemsList.length > 0) {
      tx.itemsList.forEach(item => {
        const itemSubtotal = item.price * item.quantity;
        subtotal += itemSubtotal;
        cgst += item.cgst;
        sgst += item.sgst;
        items.push({
          name: item.name,
          info: `Size: ${item.selectedSize} | Color: ${item.selectedColor}`,
          qty: item.quantity,
          total: itemSubtotal
        });
      });
    } else {
      const isLowTax = (tx.amount / tx.items) < 1000;
      const taxRate = isLowTax ? 0.05 : 0.12;
      subtotal = tx.amount / (1 + taxRate);
      cgst = (tx.amount - subtotal) / 2;
      sgst = cgst;
      items.push({
        name: "Linen Apparel / Casuals",
        info: "HSN: 6205 | Size: M | Color: Default",
        qty: tx.items,
        total: subtotal
      });
    }

    return { subtotal, cgst, sgst, items };
  };

  const handleReprint = (tx: Transaction) => {
    const { subtotal, cgst, sgst, items } = getTxDetails(tx);

    const printEl = document.createElement('div');
    printEl.id = 'tax-invoice';
    printEl.style.padding = '20px';
    printEl.innerHTML = `
      <div style="font-family: monospace; text-align: center; color: #141414; padding: 10px;">
        <h2 style="margin: 0 0 5px 0; font-size: 20px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">STREET RAGE</h2>
        <p style="margin: 0; font-size: 10px; line-height: 1.2; color: #666666;">${STORE_ADDRESS.split(', ').join('<br/>')}</p>
        <p style="margin: 3px 0; font-size: 10px; color: #666666;">Tel: ${STORE_PHONE}</p>
        <p style="margin: 5px 0; font-size: 10px; color: #666666;">GSTIN: ${GSTIN}</p>
        <div style="margin: 10px 0; border-top: 1px dashed #CCCCCC; padding-top: 10px;">
          <h3 style="margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">REPRINT TAX INVOICE</h3>
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
            ${items.map(item => `
              <tr style="border-b: 1px solid #EAEAEA;">
                <td style="padding: 6px 0;">
                  <div>${item.name}</div>
                  <div style="font-size: 8px; color: #666666;">${item.info}</div>
                </td>
                <td style="padding: 6px 0; text-align: center;">${item.qty}</td>
                <td style="padding: 6px 0; text-align: right;">₹${item.total.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="border-top: 1px solid #CCCCCC; padding-top: 8px; font-size: 10px; line-height: 1.5;">
          <div style="display: flex; justify-content: space-between;">
            <span>Taxable Value:</span>
            <span>₹${subtotal.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
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
            <span>₹${tx.amount.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
          </div>
        </div>
        
        <p style="margin: 25px 0 0 0; font-size: 9px; color: #999999; text-transform: uppercase; letter-spacing: 1px;">Thank you for shopping<br/>STREET RAGE Omnichannel POS</p>
      </div>
    `;

    const styleEl = document.createElement('style');
    styleEl.innerHTML = `@page { size: 80mm 200mm; margin: 0; }`;

    document.body.appendChild(printEl);
    document.head.appendChild(styleEl);

    window.print();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(printEl);
      document.head.removeChild(styleEl);
    }, 500);
  };

  return (
    <div className="flex-1 overflow-auto bg-[#F5F5F3] p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-serif italic text-muted-foreground text-sm uppercase tracking-widest mb-1">Records</h2>
          <h1 className="font-sans text-4xl tracking-tight text-[#141414] font-light">Sales <span className="font-medium">History</span></h1>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Search by invoice, customer, date..." 
            className="pl-9 bg-white border-0 shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-[#E4E3E0] overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-[#E4E3E0]">
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider">Invoice No</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider">Date & Time</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider">Customer</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider text-right">Items</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider text-right">Amount</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(tx => (
              <TableRow 
                key={tx.id} 
                onClick={() => setSelectedTx(tx)}
                className="group border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors cursor-pointer"
              >
                <TableCell className="py-4">
                  <div className="font-mono text-sm tracking-tight text-[#141414] font-medium">{tx.id}</div>
                </TableCell>
                <TableCell className="py-4 text-sm text-[#666666]">
                  {tx.time}
                </TableCell>
                <TableCell className="py-4 text-sm text-[#141414]">
                  {tx.customer || <span className="text-[#999999] italic">Walk-in</span>}
                </TableCell>
                <TableCell className="py-4 text-right font-mono text-[#666666]">
                  {tx.items}
                </TableCell>
                <TableCell className="py-4 text-right">
                  <div className="font-mono text-sm tracking-tight text-[#141414]">₹{tx.amount.toLocaleString('en-IN')}</div>
                </TableCell>
                <TableCell className="py-4 text-center">
                  <Badge 
                    variant="outline"
                    className={`font-mono text-[10px] uppercase font-medium px-2 py-0.5 ${
                      tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {tx.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-[#999999] text-sm">
                  No billing records found matching your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </motion.div>

      {/* Invoice Details Reprint Modal */}
      <Dialog open={selectedTx !== null} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="sm:max-w-[450px] bg-[#f9f9f9] border-0 shadow-2xl p-0 overflow-hidden">
          <div className="p-6 border-b border-[#E4E3E0] bg-white flex justify-between items-center">
            <DialogHeader>
              <DialogTitle className="font-sans text-xl tracking-tight text-[#141414]">Invoice Details</DialogTitle>
              <DialogDescription className="sr-only">Detailed look at transaction receipt history.</DialogDescription>
            </DialogHeader>
          </div>
          
          {selectedTx && (() => {
            const { subtotal, cgst, sgst, items } = getTxDetails(selectedTx);
            return (
              <div className="p-6 space-y-6">
                {/* Receipt Mock Preview */}
                <div className="bg-white border border-[#E4E3E0] rounded-xl p-5 shadow-inner">
                  <div className="text-center mb-4 border-b border-dashed border-[#CCCCCC] pb-4">
                    <h3 className="font-sans font-bold text-xl uppercase tracking-wider">STREET RAGE</h3>
                    <p className="text-[10px] font-mono text-[#666666] mt-1">{STORE_ADDRESS}</p>
                    <p className="text-[10px] font-mono text-[#666666] mt-0.5">Tel: {STORE_PHONE}</p>
                    <p className="text-[10px] font-mono text-[#666666] mt-0.5">GSTIN: {GSTIN}</p>
                    <p className="text-[10px] font-mono text-[#999999] mt-3">Invoice No: {selectedTx.id}</p>
                    <p className="text-[10px] font-mono text-[#999999]">{selectedTx.time}</p>
                  </div>
                  
                  <div className="text-left bg-[#F9F9F9] p-2 mb-4 text-[10px] font-mono rounded border border-[#E4E3E0]">
                    <div><strong>Client:</strong> {selectedTx.customer || 'Walk-in Customer'}</div>
                    <div className="mt-1"><strong>Payment Mode:</strong> {selectedTx.paymentMode || 'Cash'}</div>
                  </div>

                  <table className="w-full text-xs font-mono mb-4 text-left">
                    <thead>
                      <tr className="border-b border-[#CCCCCC] pb-1">
                        <th>Description</th>
                        <th className="text-center">Qty</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-b border-[#F0F0F0] last:border-0">
                          <td className="py-2">
                            <div className="font-sans font-medium">{item.name}</div>
                            <div className="text-[10px] text-[#666666]">{item.info}</div>
                          </td>
                          <td className="py-2 text-center">{item.qty}</td>
                          <td className="py-2 text-right">₹{item.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="border-t border-[#CCCCCC] pt-3 space-y-1 font-mono text-xs text-[#666666]">
                    <div className="flex justify-between">
                      <span>Taxable Value:</span>
                      <span>₹{subtotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CGST:</span>
                      <span>₹{cgst.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST:</span>
                      <span>₹{sgst.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between font-sans font-bold text-sm text-[#141414] border-t-2 border-[#141414] pt-2 mt-2">
                      <span>Grand Total</span>
                      <span>₹{selectedTx.amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="p-6 bg-white border-t border-[#E4E3E0] flex gap-3">
             <Button 
               className="w-1/2 bg-[#141414] text-white py-6"
               onClick={() => selectedTx && handleReprint(selectedTx)}
             >
               <Printer className="w-4 h-4 mr-2" />
               Reprint Receipt
             </Button>
             <Button 
               variant="outline" 
               className="w-1/2 border-[#E4E3E0] text-[#666666]"
               onClick={() => setSelectedTx(null)}
             >
               Close
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
