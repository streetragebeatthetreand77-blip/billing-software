import { useState, ChangeEvent } from "react";
import { mockCustomers, Customer, saveLocal } from "@/lib/mock";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Mail, Phone, ShoppingBag, Store, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { saveCustomerToFirebase } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";

export function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase().includes("admin") ?? true;
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  if (!isAdmin) {
    const handleSaveForCashier = (savedCustomer: Customer) => {
      const newCust = [savedCustomer, ...customers];
      setCustomers(newCust);
      mockCustomers.unshift(savedCustomer);
      saveLocal("customers", mockCustomers);
      saveCustomerToFirebase(savedCustomer);
      alert("Customer registered successfully!");
      setFormKey(prev => prev + 1);
    };

    return (
      <div className="flex-1 overflow-auto bg-[#F5F5F3] p-8 flex justify-center items-center">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E4E3E0] overflow-hidden max-w-md w-full">
          <CustomerForm 
            key={formKey}
            customer={null}
            onSave={handleSaveForCashier}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[#F5F5F3] p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-serif italic text-muted-foreground text-sm uppercase tracking-widest mb-1">Customers</h2>
          <h1 className="font-sans text-4xl tracking-tight text-[#141414] font-light">Customer <span className="font-medium">Directory</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search name or phone..." 
              className="pl-9 bg-white border-0 shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button 
            className="bg-[#141414] text-white hover:bg-[#333333] shadow-sm tracking-wider uppercase text-xs"
            onClick={() => setIsAddMode(true)}
          >
            Add Customer
          </Button>
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
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider">Customer Name</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider">Contact</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider text-right">Total Spent</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(customer => (
              <TableRow key={customer.id} className="group border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors cursor-pointer">
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[#666666] uppercase font-bold text-[10px]">
                      {customer.name.substring(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-[#141414]">{customer.name}</div>
                      <div className="font-mono text-[10px] text-[#999999] mt-0.5">{customer.id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <div className="text-sm text-[#666666] font-mono">{customer.phone}</div>
                </TableCell>
                <TableCell className="py-3 text-right">
                  <div className="font-mono text-sm tracking-tight text-[#141414]">₹{customer.totalSpent.toLocaleString('en-IN')}</div>
                </TableCell>
                <TableCell className="py-3 text-right">
                  <Button 
                    variant="ghost" 
                    className="text-xs uppercase tracking-wider font-semibold text-[#666666] hover:text-[#141414]"
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setIsAddMode(false);
                    }}
                  >
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>

      {/* Global Customer Sheet */}
      <Sheet open={isAddMode || selectedCustomer !== null} onOpenChange={(open) => {
        if (!open) {
          setIsAddMode(false);
          setSelectedCustomer(null);
        }
      }}>
        <SheetContent className="bg-[#FAFAFA] border-l border-[#E4E3E0] sm:max-w-md w-full overflow-y-auto p-0 flex flex-col">
          {(!isAddMode && selectedCustomer) ? (
            <CustomerView 
              customer={selectedCustomer} 
              onEdit={() => setIsAddMode(true)} 
              onDelete={(id) => {
                const newCustomers = customers.filter(c => c.id !== id);
                setCustomers(newCustomers);
                const idx = mockCustomers.findIndex(c => c.id === id);
                if(idx !== -1) mockCustomers.splice(idx, 1);
                saveLocal("customers", mockCustomers);
                setSelectedCustomer(null);
              }}
            />
          ) : isAddMode ? (
            <CustomerForm 
              customer={selectedCustomer}
              onSave={(savedCustomer) => {
                if (!selectedCustomer) {
                  const newCust = [savedCustomer, ...customers];
                  setCustomers(newCust);
                  mockCustomers.unshift(savedCustomer);
                } else {
                  const newCust = customers.map(c => c.id === savedCustomer.id ? savedCustomer : c);
                  setCustomers(newCust);
                  const idx = mockCustomers.findIndex(c => c.id === savedCustomer.id);
                  if (idx !== -1) mockCustomers[idx] = savedCustomer;
                }
                saveLocal("customers", mockCustomers);
                saveCustomerToFirebase(savedCustomer);
                setIsAddMode(false);
                setSelectedCustomer(null);
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CustomerView({ customer, onEdit, onDelete }: { customer: Customer, onEdit: () => void, onDelete: (id: string) => void }) {
  return (
    <div className="flex flex-col min-h-full">
      <SheetHeader className="p-6 border-b border-[#E4E3E0] bg-white sticky top-0 z-10">
        <div className="flex gap-4 items-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-[#666666] uppercase font-bold text-xl shadow-sm">
            {customer.name.substring(0, 2)}
          </div>
          <div className="flex-1">
            <SheetTitle className="font-sans text-2xl tracking-tight text-[#141414] text-left">{customer.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs text-[#999999] text-left flex items-center mt-1">
              {customer.id}
            </SheetDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit} className="text-xs uppercase tracking-wider absolute top-6 right-6">Edit</Button>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <a href={`tel:${customer.phone}`} className="flex items-center text-xs text-[#666666] hover:text-[#141414] bg-[#FAFAFA] p-2 rounded-md border border-[#E4E3E0]">
            <Phone className="w-3 h-3 mr-2" /> {customer.phone}
          </a>
          <a href={`mailto:${customer.email}`} className="flex items-center text-xs text-[#666666] hover:text-[#141414] bg-[#FAFAFA] p-2 rounded-md border border-[#E4E3E0] truncate">
            <Mail className="w-3 h-3 mr-2" /> {customer.email}
          </a>
        </div>
      </SheetHeader>
      
      <div className="p-6 space-y-8 flex-1">
        {/* Spending Stats */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E4E3E0] shadow-sm">
            <div className="text-[10px] text-[#999999] uppercase tracking-wider mb-1">Lifetime Value</div>
            <div className="font-mono text-xl tracking-tighter">₹{customer.totalSpent.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <h3 className="text-xs font-semibold text-[#141414] uppercase tracking-wider mb-4 border-b border-[#E4E3E0] pb-2">Purchase Timeline</h3>
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#E4E3E0] before:to-transparent">
            {customer.purchaseHistory?.map((tx, i) => (
              <div key={tx.id} className="relative flex items-start p-3 bg-white border border-[#E4E3E0] rounded-lg shadow-sm">
                <div className="absolute top-4 -left-3 rounded-full w-2 h-2 bg-blue-500 shadow-[0_0_0_4px_#E3F2FD]" />
                <div className="flex-1 ml-2">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-medium text-sm text-[#141414]">{tx.id}</div>
                    <div className="font-mono text-sm tracking-tight text-[#141414]">₹{tx.amount.toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-[#666666] font-mono">
                    <div className="flex items-center">
                      <Store className="w-3 h-3 mr-1"/>
                      Retail Store
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {tx.time}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(!customer.purchaseHistory || customer.purchaseHistory.length === 0) && (
              <div className="text-center text-[#999999] text-xs py-4">No recent purchases found.</div>
            )}
          </div>
        </div>
        <div className="pt-4 border-t border-[#E4E3E0]">
          <Button variant="destructive" className="w-full py-6 text-xs uppercase tracking-widest" onClick={() => onDelete(customer.id)}>
            Delete Customer
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomerForm({ customer, onSave }: { customer: Customer | null, onSave: (c: Customer) => void }) {
  const [formData, setFormData] = useState<Customer>(customer || {
    id: `C${Math.floor(Math.random() * 100000)}`,
    name: "",
    phone: "",
    email: "",
    totalSpent: 0,
    purchaseHistory: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Full Name is required.";
    
    // Normalize phone number by removing spaces, dashes, or brackets
    const cleanPhone = formData.phone.replace(/[\s\-\(\)\+]/g, "");
    
    // Validate phone number: must be between 10 to 12 digits
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required.";
    } else if (cleanPhone.length < 10 || cleanPhone.length > 13 || isNaN(Number(cleanPhone))) {
      newErrors.phone = "Enter a valid phone number (10-12 digits).";
    }

    // Email format validation (optional field)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email.trim() && !emailRegex.test(formData.email.trim())) {
      newErrors.email = "Enter a valid email address.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formData);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[#E4E3E0] bg-white">
        <SheetHeader>
          <div className="flex gap-4 items-start mb-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-[#666666] uppercase font-bold text-xl shadow-sm">
              {formData.name ? formData.name.substring(0, 2) : "NE"}
            </div>
            <div>
              <SheetTitle className="font-sans text-xl tracking-tight text-[#141414] text-left">
                {customer ? "Edit Customer Details" : "New Customer"}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs text-[#999999] text-left mt-1">
                {formData.id}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
      </div>
      <div className="p-6 flex-1 bg-[#FAFAFA] space-y-4">
        <div className="space-y-1">
          <label className="text-xs uppercase font-medium text-[#666666] tracking-wider">Full Name</label>
          <Input name="name" value={formData.name} onChange={handleChange} placeholder="e.g. John Doe" className="border-[#E4E3E0]" />
          {errors.name && <p className="text-[10px] text-red-500 font-mono">{errors.name}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase font-medium text-[#666666] tracking-wider">Phone</label>
          <Input name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g. +91 9876543210" className="font-mono border-[#E4E3E0]" />
          {errors.phone && <p className="text-[10px] text-red-500 font-mono">{errors.phone}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase font-medium text-[#666666] tracking-wider">Email (Optional)</label>
          <Input name="email" value={formData.email} onChange={handleChange} placeholder="e.g. john@example.com" className="border-[#E4E3E0]" type="email" />
          {errors.email && <p className="text-[10px] text-red-500 font-mono">{errors.email}</p>}
        </div>
      </div>
      <div className="p-6 bg-white border-t border-[#E4E3E0]">
        <Button className="w-full bg-[#141414] hover:bg-[#333333] text-white py-6 text-xs uppercase tracking-widest" onClick={handleSave}>
          {customer ? "Save Changes" : "Create Customer"}
        </Button>
      </div>
    </div>
  );
}
