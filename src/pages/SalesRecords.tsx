import { useState } from "react";
import { mockTransactions, Transaction, STORE_ADDRESS, STORE_PHONE, GSTIN } from "@/lib/mock";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Printer, FileText, X, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SalesRecords() {
  const [search, setSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [gstFilter, setGstFilter] = useState<'all' | 'gst' | 'nongst'>('all');
  const [exportType, setExportType] = useState<'all' | 'gst' | 'nongst'>('all');

  const filtered = mockTransactions.filter(tx => {
    if (gstFilter === 'gst') {
      if (tx.isGst === false) return false;
    } else if (gstFilter === 'nongst') {
      if (tx.isGst !== false) return false;
    }
    return (
      tx.id.toLowerCase().includes(search.toLowerCase()) || 
      (tx.customer && tx.customer.toLowerCase().includes(search.toLowerCase())) ||
      tx.time.toLowerCase().includes(search.toLowerCase())
    );
  });

  const getTxDetails = (tx: Transaction) => {
    let discount = tx.discount || 0;
    let subtotal = tx.subtotal || 0;
    let cgst = tx.cgst || 0;
    let sgst = tx.sgst || 0;
    let itemDiscountsTotal = tx.discountDetails?.itemDiscount || 0;
    let overallDiscountTotal = tx.discountDetails?.overallDiscount || 0;
    let items: { 
      name: string; 
      info: string; 
      qty: number; 
      total: number; 
      price: number; 
      hsn?: string;
      discountType?: string;
      discountValue?: number;
      discountAmount?: number;
      totalDiscount?: number;
    }[] = [];

    if (tx.itemsList && tx.itemsList.length > 0) {
      tx.itemsList.forEach(item => {
        const itemSubtotal = item.price * item.quantity;
        items.push({
          name: item.name,
          info: `Size: ${item.selectedSize} | Color: ${item.selectedColor}`,
          qty: item.quantity,
          total: itemSubtotal,
          price: item.price,
          hsn: item.price < 1000 ? '6205' : '6206',
          discountType: item.discountType,
          discountValue: item.discountValue,
          discountAmount: item.discountAmount,
          totalDiscount: item.totalDiscount
        });
      });
      if (!subtotal) {
        tx.itemsList.forEach(item => {
          subtotal += item.price * item.quantity;
        });
      }
      if (!cgst) {
        tx.itemsList.forEach(item => {
          cgst += item.cgst || 0;
          sgst += item.sgst || 0;
        });
      }
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
        total: subtotal,
        price: tx.amount / tx.items,
        hsn: "6205"
      });
    }

    return { subtotal, discount, cgst, sgst, itemDiscountsTotal, overallDiscountTotal, items };
  };

  const handleReprint = (tx: Transaction) => {
    const { subtotal, discount, cgst, sgst, itemDiscountsTotal, overallDiscountTotal, items } = getTxDetails(tx);
    const isGst = tx.isGst !== false;

    const printEl = document.createElement('div');
    printEl.id = 'tax-invoice';

    let htmlContent = `
      <div style="font-family: monospace; text-align: center; color: #141414; padding: 10px 4px 10px 4px;">
        <h2 style="margin: 0 0 5px 0; font-size: 20px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">STREET RAGE</h2>
        <p style="margin: 0; font-size: 10px; line-height: 1.2; color: #666666;">${STORE_ADDRESS.split(', ').join('<br/>')}</p>
        <p style="margin: 3px 0; font-size: 10px; color: #666666;">Tel: ${STORE_PHONE}</p>
        <p style="margin: 5px 0; font-size: 10px; color: #666666;">${isGst ? `GSTIN: ${GSTIN}` : 'ESTIMATE / NON-GST'}</p>
        <div style="margin: 10px 0; border-top: 1px dashed #CCCCCC; padding-top: 10px;">
          <h3 style="margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">REPRINT TAX INVOICE</h3>
          <p style="margin: 5px 0 0 0; font-size: 9px; color: #999999;">${tx.time}</p>
        </div>
        
        <div style="text-align: left; background: #F9F9F9; padding: 6px; margin: 10px 0; font-size: 10px; border-radius: 4px;">
          <strong>Invoice ID:</strong> ${tx.id}<br/>
          <strong>Client:</strong> ${tx.customer || 'Walk-in Customer'}<br/>
          <strong>Payment Mode:</strong> ${tx.paymentMode || 'Cash'}<br/>
          <strong>Billed By:</strong> ${tx.createdBy || 'System Admin'}
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
            ${items.map(item => {
              const rawItemTotal = item.price * item.qty;
              const hasItemDisc = item.discountValue !== undefined && item.discountValue > 0;
              const itemDiscLabel = item.discountType === 'percentage' ? `${item.discountValue}%` : `Flat ₹${item.discountValue}`;
              const itemDiscAmt = item.discountAmount || 0;
              return `
                <tr style="border-b: 1px solid #EAEAEA;">
                  <td style="padding: 6px 0;">
                    <div>${item.name}</div>
                    <div style="font-size: 8px; color: #666666;">${item.info} | HSN: ${item.hsn || '6205'}</div>
                    ${hasItemDisc ? `<div style="font-size: 8px; color: #10b981;">Disc: ${itemDiscLabel} (-₹${itemDiscAmt.toLocaleString()})</div>` : ''}
                  </td>
                  <td style="padding: 6px 0; text-align: center;">${item.qty}</td>
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
            <span>₹${tx.amount.toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits: 2})}</span>
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

      items.forEach(item => {
        const itemHsn = item.hsn || '6205';
        const rawItemSubtotal = item.price * item.qty;
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
        group.cgst += item.cgst || 0;
        group.sgst += item.sgst || 0;
        group.total += (taxable + (item.cgst || 0) + (item.sgst || 0));
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

    // Clean up
    setTimeout(() => {
      document.body.removeChild(printEl);
      document.head.removeChild(styleEl);
    }, 500);
  };

  const handleExportCSV = (type: 'all' | 'gst' | 'nongst') => {
    // Columns to export
    const headers = [
      "Invoice ID",
      "Date & Time",
      "Customer",
      "Total Items",
      "Subtotal (Taxable)",
      "CGST (₹)",
      "SGST (₹)",
      "Discount (₹)",
      "Grand Total (₹)",
      "Status",
      "Payment Mode",
      "GST Bill?",
      "Created By"
    ];

    const txToExport = mockTransactions.filter(tx => {
      if (type === 'gst') {
        if (tx.isGst === false) return false;
      } else if (type === 'nongst') {
        if (tx.isGst !== false) return false;
      }
      if (search) {
        return (
          tx.id.toLowerCase().includes(search.toLowerCase()) || 
          (tx.customer && tx.customer.toLowerCase().includes(search.toLowerCase())) ||
          tx.time.toLowerCase().includes(search.toLowerCase())
        );
      }
      return true;
    });

    const rows = txToExport.map(tx => {
      const { subtotal, discount, cgst, sgst } = getTxDetails(tx);
      const isGstStr = tx.isGst !== false ? "Yes" : "No";
      const customerStr = tx.customer || "Walk-in Customer";
      const createdByStr = tx.createdBy || "System Admin";
      return [
        tx.id,
        tx.time,
        customerStr,
        tx.items,
        subtotal.toFixed(2),
        cgst.toFixed(2),
        sgst.toFixed(2),
        discount.toFixed(2),
        tx.amount.toFixed(2),
        tx.status,
        tx.paymentMode || "Cash",
        isGstStr,
        createdByStr
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => {
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `sales_report_${type}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-auto bg-[#F5F5F3] p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-serif italic text-muted-foreground text-sm uppercase tracking-widest mb-1">Records</h2>
          <h1 className="font-sans text-4xl tracking-tight text-[#141414] font-light">Sales <span className="font-medium">History</span></h1>
        </div>
        <div className="flex gap-3 items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search by invoice, customer, date..." 
              className="pl-9 bg-white border-0 shadow-sm animate-in fade-in"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-white p-1 rounded-xl border border-[#E4E3E0] shadow-sm">
            <button
              type="button"
              className={`text-xs font-mono uppercase px-3 py-1.5 rounded-lg transition-all ${gstFilter === 'all' ? 'bg-[#141414] text-white font-bold' : 'text-[#666666] hover:text-[#141414]'}`}
              onClick={() => setGstFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`text-xs font-mono uppercase px-3 py-1.5 rounded-lg transition-all ${gstFilter === 'gst' ? 'bg-[#141414] text-white font-bold' : 'text-[#666666] hover:text-[#141414]'}`}
              onClick={() => setGstFilter('gst')}
            >
              GST Bills
            </button>
            <button
              type="button"
              className={`text-xs font-mono uppercase px-3 py-1.5 rounded-lg transition-all ${gstFilter === 'nongst' ? 'bg-[#141414] text-white font-bold' : 'text-[#666666] hover:text-[#141414]'}`}
              onClick={() => setGstFilter('nongst')}
            >
              Non-GST
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={exportType} onValueChange={(val: any) => setExportType(val)}>
              <SelectTrigger className="w-32 bg-white text-xs font-mono h-9 border-[#E4E3E0]">
                <SelectValue placeholder="Export Type" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#E4E3E0]">
                <SelectItem value="all" className="text-xs font-mono">All Bills</SelectItem>
                <SelectItem value="gst" className="text-xs font-mono">GST Bills</SelectItem>
                <SelectItem value="nongst" className="text-xs font-mono">Non-GST</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => handleExportCSV(exportType)}
              className="bg-[#141414] text-white hover:bg-[#333333] shadow-sm tracking-wider uppercase text-xs flex items-center gap-2 h-9"
            >
              <Download className="w-3.5 h-3.5" />
              Export to Excel
            </Button>
          </div>
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
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider">Created By</TableHead>
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
                <TableCell className="py-4 text-xs font-mono text-[#666666] max-w-[150px] truncate" title={tx.createdBy || "System Admin"}>
                  {tx.createdBy || "System Admin"}
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
                <TableCell colSpan={7} className="h-32 text-center text-[#999999] text-sm">
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
            const { subtotal, discount, cgst, sgst, itemDiscountsTotal, overallDiscountTotal, items } = getTxDetails(selectedTx);
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
                    <div className="mt-1"><strong>Billed By:</strong> {selectedTx.createdBy || 'System Admin'}</div>
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
                      {items.map((item, idx) => {
                        const rawItemTotal = item.price * item.qty;
                        const hasItemDisc = item.discountValue !== undefined && item.discountValue > 0;
                        const itemDiscLabel = item.discountType === 'percentage' ? `${item.discountValue}%` : `Flat ₹${item.discountValue}`;
                        const itemDiscAmt = item.discountAmount || 0;
                        return (
                          <tr key={idx} className="border-b border-[#F0F0F0] last:border-0">
                            <td className="py-2">
                              <div className="font-sans font-medium">{item.name}</div>
                              <div className="text-[10px] text-[#666666]">{item.info}</div>
                              {hasItemDisc && (
                                <div className="text-[9px] text-emerald-600 font-medium">Disc: {itemDiscLabel} (-₹{itemDiscAmt.toLocaleString()})</div>
                              )}
                            </td>
                            <td className="py-2 text-center">{item.qty}</td>
                            <td className="py-2 text-right">
                              {hasItemDisc && (
                                <span className="text-decoration: line-through text-[#999999] text-[9px] mr-2">₹{rawItemTotal.toLocaleString()}</span>
                              )}
                              ₹{(rawItemTotal - itemDiscAmt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="border-t border-[#CCCCCC] pt-3 space-y-1 font-mono text-xs text-[#666666]">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{subtotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    {itemDiscountsTotal > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>• Product Discounts:</span>
                        <span>-₹{itemDiscountsTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                    )}
                    {overallDiscountTotal > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>• Invoice Discount (${selectedTx.discountType === 'percentage' ? `${selectedTx.discountValue}%` : 'Flat'}):</span>
                        <span>-₹{overallDiscountTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-bold border-t border-dashed border-[#EAEAEA] pt-1">
                        <span>Total Discount:</span>
                        <span>-₹{discount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-dashed border-[#EAEAEA] pt-1">
                      <span>Taxable Value:</span>
                      <span>₹{(subtotal - discount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
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
