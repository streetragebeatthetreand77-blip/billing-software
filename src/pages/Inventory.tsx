import { useState, ChangeEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { mockProducts, Product, saveLocal, DEFAULT_PRODUCT_IMAGE } from "@/lib/mock";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, Upload, X, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { saveProductToFirebase, deleteProductFromFirebase } from "@/lib/db";

const generateEAN13 = () => {
  const base = "890" + Math.floor(100000000 + Math.random() * 900000000).toString();
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base[i]);
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return base + checkDigit;
};

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  result.push(cell.trim());
  return result;
}

export function Inventory() {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);

  // Bulk CSV Upload States
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFileError, setUploadFileError] = useState<string | null>(null);
  const [parsedSummary, setParsedSummary] = useState<string | null>(null);
  const [productsToImport, setProductsToImport] = useState<Product[]>([]);

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()));

  const getTotalStock = (stockMsg: Record<string, Record<string, number>>) => {
    let sum = 0;
    if (!stockMsg) return 0;
    Object.values(stockMsg).forEach(colorObj => {
      if (colorObj) {
        Object.values(colorObj).forEach(qty => {
          sum += qty;
        });
      }
    });
    return sum;
  };

  const downloadCsvTemplate = () => {
    const csvContent = "SKU,Name,Category,CostPrice,Price,HSN,Size,Color,Stock\n" +
      "8909999900012,Casual Linen Shirt,Casual,800,1500,6205,M,Navy,25\n" +
      "8909999900012,Casual Linen Shirt,Casual,800,1500,6205,L,Navy,10\n" +
      "8909999900013,Handloom Cotton Kurta,Ethnic,1200,2400,6211,One Size,Red,15\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "street_rage_inventory_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        setUploadFileError("CSV file is empty or missing headers.");
        return;
      }

      // Parse headers
      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
      const required = ["name", "category", "price", "size", "color", "stock"];
      const missing = required.filter(r => !headers.includes(r));
      if (missing.length > 0) {
        setUploadFileError(`Missing required headers: ${missing.join(", ")}`);
        return;
      }

      const productsMap: Record<string, Product> = {};
      const nameToGeneratedSku: Record<string, string> = {};

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });

        let sku = row.sku || "";
        const name = row.name || "";
        const category = row.category || "";
        const costPrice = parseFloat(row.costprice) || 0;
        const price = parseFloat(row.price) || 0;
        const hsn = row.hsn || "0000";
        const size = row.size || "One Size";
        const color = row.color || "Default";
        const stockQty = parseInt(row.stock) || 0;

        if (!name || !category || price <= 0) {
          continue; // skip invalid rows
        }

        if (!sku) {
          const normalizedName = name.toLowerCase().trim();
          if (nameToGeneratedSku[normalizedName]) {
            sku = nameToGeneratedSku[normalizedName];
          } else {
            sku = generateEAN13();
            nameToGeneratedSku[normalizedName] = sku;
          }
        }

        if (!productsMap[sku]) {
          productsMap[sku] = {
            id: sku,
            name,
            category,
            costPrice,
            price,
            hsn,
            imageUrl: row.imageurl || undefined,
            stock: {}
          };
        }

        if (!productsMap[sku].stock[size]) {
          productsMap[sku].stock[size] = {};
        }
        productsMap[sku].stock[size][color] = stockQty;
      }

      const list = Object.values(productsMap);
      if (list.length === 0) {
        setUploadFileError("No valid products found in CSV.");
      } else {
        setProductsToImport(list);
        setParsedSummary(`Successfully parsed ${lines.length - 1} rows. Found ${list.length} unique products.`);
        setUploadFileError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (productsToImport.length === 0) return;

    // Merge imports into state
    const currentProductsMap = { ...products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Product>) };
    
    productsToImport.forEach(item => {
      // Overwrite or append product details
      currentProductsMap[item.id] = item;
      
      // Update mockProducts array
      const idx = mockProducts.findIndex(p => p.id === item.id);
      if (idx !== -1) {
        mockProducts[idx] = item;
      } else {
        mockProducts.unshift(item);
      }
      
      // Save directly to Firebase
      saveProductToFirebase(item);
    });

    const updatedList = Object.values(currentProductsMap);
    setProducts(updatedList);
    saveLocal("products", mockProducts);

    // Reset upload state
    setIsUploadOpen(false);
    setProductsToImport([]);
    setParsedSummary(null);
  };

  return (
    <div className="flex-1 overflow-auto bg-[#F5F5F3] p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-serif italic text-muted-foreground text-sm uppercase tracking-widest mb-1">Database</h2>
          <h1 className="font-sans text-4xl tracking-tight text-[#141414] font-light">Inventory <span className="font-medium">Matrix</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search by SKU or name..." 
              className="pl-9 bg-white border-0 shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button 
            variant="outline"
            className="border-[#E4E3E0] text-[#141414] hover:bg-transparent hover:border-[#141414] shadow-sm tracking-wider uppercase text-xs font-mono"
            onClick={() => {
              setUploadFileError(null);
              setParsedSummary(null);
              setProductsToImport([]);
              setIsUploadOpen(true);
            }}
          >
            <Upload className="w-4 h-4 mr-2 text-[#666666]" />
            Bulk Upload
          </Button>
          <Button 
            className="bg-[#141414] text-white hover:bg-[#333333] shadow-sm tracking-wider uppercase text-xs"
            onClick={() => setIsAddMode(true)}
          >
            Add Product
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
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider w-[100px]">Image</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider">Product</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider">Category</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider text-right">Price</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider text-center">Stock</TableHead>
              <TableHead className="py-4 text-[#999999] font-mono text-[11px] uppercase tracking-wider text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(product => {
              const totalStock = getTotalStock(product.stock);
              const isLowStock = totalStock > 0 && totalStock <= 15;
              const isOutOfStock = totalStock === 0;

              return (
                <TableRow key={product.id} className="group border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors cursor-pointer">
                  <TableCell className="py-3">
                    <img src={product.imageUrl || DEFAULT_PRODUCT_IMAGE} alt={product.name} className="w-10 h-10 object-cover rounded-md" />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="font-medium text-sm text-[#141414] mb-0.5">{product.name}</div>
                    <div className="font-mono text-xs text-[#999999]">{product.id} • HSN: {product.hsn}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className="font-normal text-[#666666] border-[#E4E3E0] bg-white group-hover:bg-[#FAFAFA]">{product.category}</Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="font-mono text-sm tracking-tight text-[#141414]">₹{product.price.toLocaleString('en-IN')}</div>
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <Badge 
                      variant={isOutOfStock ? "destructive" : isLowStock ? "default" : "secondary"}
                      className={`font-mono text-xs font-medium px-2 py-0.5 ${
                        isOutOfStock ? 'bg-red-50 text-red-700 border border-red-200' :
                        isLowStock ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      {totalStock}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button 
                      variant="ghost" 
                      className="text-xs uppercase tracking-wider font-semibold text-[#666666] hover:text-[#141414]"
                      onClick={() => {
                        setSelectedProduct(product);
                        setIsAddMode(false);
                      }}
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </motion.div>

      {/* Global Product Sheet */}
      <Sheet open={isAddMode || selectedProduct !== null} onOpenChange={(open) => {
        if (!open) {
          setIsAddMode(false);
          setSelectedProduct(null);
        }
      }}>
        <SheetContent className="bg-[#FAFAFA] border-l border-[#E4E3E0] sm:max-w-md w-full overflow-y-auto p-0 flex flex-col">
          {(!isAddMode && selectedProduct) || isAddMode ? (
            <ProductForm 
              product={isAddMode ? null : selectedProduct} 
              onSave={(savedProduct) => {
                if (isAddMode) {
                  const newProducts = [savedProduct, ...products];
                  setProducts(newProducts);
                  mockProducts.unshift(savedProduct); // mutate mock
                } else {
                  const newProducts = products.map(p => p.id === savedProduct.id ? savedProduct : p);
                  setProducts(newProducts);
                  // Update mock
                  const idx = mockProducts.findIndex(p => p.id === savedProduct.id);
                  if (idx !== -1) mockProducts[idx] = savedProduct;
                }
                saveLocal("products", mockProducts);
                saveProductToFirebase(savedProduct);
                setIsAddMode(false);
                setSelectedProduct(null);
              }}
              onDelete={(id) => {
                const newProducts = products.filter(p => p.id !== id);
                setProducts(newProducts);
                // Update mock
                const idx = mockProducts.findIndex(p => p.id === id);
                if (idx !== -1) mockProducts.splice(idx, 1);
                saveLocal("products", mockProducts);
                deleteProductFromFirebase(id);
                setIsAddMode(false);
                setSelectedProduct(null);
              }}
              onCancel={() => {
                setIsAddMode(false);
                setSelectedProduct(null);
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Bulk CSV Upload Modal */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-[450px] bg-[#f9f9f9] border-0 shadow-2xl p-0 overflow-hidden rounded-xl">
          <div className="p-6 border-b border-[#E4E3E0] bg-white flex justify-between items-center">
            <DialogHeader>
              <DialogTitle className="font-sans text-xl tracking-tight text-[#141414]">Bulk Inventory Upload</DialogTitle>
              <DialogDescription className="sr-only">Upload and import inventory data from a CSV spreadsheet.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6">
            <div className="p-4 bg-white border border-[#E4E3E0] rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#141414]">Master CSV Template</h4>
                <p className="text-[10px] text-[#999999] mt-0.5">Use this sheet to populate product stocks</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="text-xs font-mono uppercase">
                <Download className="w-3.5 h-3.5 mr-2 text-[#666666]" />
                Template
              </Button>
            </div>

            <div className="border border-dashed border-[#CCCCCC] rounded-xl p-8 bg-white text-center flex flex-col items-center justify-center relative hover:bg-slate-50 transition-colors">
              <Upload className="w-8 h-8 text-[#999999] mb-3" />
              <div className="text-xs font-medium text-[#141414]">Drag & Drop your CSV file here, or click to browse</div>
              <input 
                type="file" 
                accept=".csv"
                onChange={handleCsvUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {uploadFileError && (
              <p className="text-[10px] text-red-500 font-mono text-center leading-relaxed bg-red-50 border border-red-100 p-2.5 rounded-lg">{uploadFileError}</p>
            )}

            {parsedSummary && (
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex items-center justify-between text-xs font-medium text-emerald-800">
                <span>{parsedSummary}</span>
                <Badge className="bg-[#141414] text-white">Ready</Badge>
              </div>
            )}
          </div>

          <div className="p-6 bg-white border-t border-[#E4E3E0] flex gap-3">
             <Button 
               className="w-1/2 bg-[#141414] hover:bg-[#333333] text-white py-6 text-xs uppercase tracking-widest disabled:opacity-50"
               disabled={productsToImport.length === 0}
               onClick={handleConfirmImport}
             >
               Import Products
             </Button>
             <Button 
               variant="outline" 
               className="w-1/2 border-[#E4E3E0] text-[#666666] hover:bg-[#FAFAFA]"
               onClick={() => setIsUploadOpen(false)}
             >
               Cancel
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductForm({ 
  product, 
  onSave,
  onDelete,
  onCancel 
}: { 
  product: Product | null, 
  onSave: (p: Product) => void,
  onDelete: (id: string) => void,
  onCancel: () => void
}) {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase().includes("admin") ?? true;

  const [formData, setFormData] = useState<Product>(() => {
    if (product) return product;
    return {
      id: generateEAN13(), // Auto-generate check-digit EAN-13 barcode by default!
      name: "",
      category: "",
      price: 0,
      costPrice: 0,
      stock: {},
      hsn: "",
      imageUrl: ""
    };
  });

  const getInitialSizes = () => {
    if (product && product.stock) {
      const keys = Object.keys(product.stock);
      if (keys.length > 0) return keys;
    }
    return ["M", "L", "XL"];
  };

  const getInitialColors = () => {
    if (product && product.stock) {
      const colorSet = new Set<string>();
      Object.values(product.stock).forEach(colorObj => {
        Object.keys(colorObj || {}).forEach(color => colorSet.add(color));
      });
      if (colorSet.size > 0) return Array.from(colorSet);
    }
    return ["White", "Navy"];
  };

  const [sizes, setSizes] = useState<string[]>(getInitialSizes());
  const [colors, setColors] = useState<string[]>(getInitialColors());
  const [stockMatrix, setStockMatrix] = useState<Record<string, Record<string, number>>>(() => {
    if (product && product.stock) return product.stock;
    const matrix: Record<string, Record<string, number>> = {};
    ["M", "L", "XL"].forEach(size => {
      matrix[size] = { "White": 0, "Navy": 0 };
    });
    return matrix;
  });

  const [newSizeInput, setNewSizeInput] = useState("");
  const [newColorInput, setNewColorInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addSizeTags = (sizesToAddStr: string) => {
    const cleanSizes = sizesToAddStr
      .split(",")
      .map(s => s.trim())
      .filter(s => s !== "");
    if (cleanSizes.length === 0) return;

    setSizes(prevSizes => {
      const nextSizes = [...prevSizes];
      const addedSizes: string[] = [];
      cleanSizes.forEach(sz => {
        if (!nextSizes.includes(sz)) {
          nextSizes.push(sz);
          addedSizes.push(sz);
        }
      });

      if (addedSizes.length > 0) {
        setStockMatrix(prevMatrix => {
          const nextMatrix = { ...prevMatrix };
          addedSizes.forEach(sz => {
            nextMatrix[sz] = {};
            colors.forEach(col => {
              nextMatrix[sz][col] = 0;
            });
          });
          return nextMatrix;
        });
      }
      return nextSizes;
    });
    setNewSizeInput("");
  };

  const removeSizeTag = (sizeToRemove: string) => {
    const nextSizes = sizes.filter(s => s !== sizeToRemove);
    setSizes(nextSizes);
    setStockMatrix(prev => {
      const next = { ...prev };
      delete next[sizeToRemove];
      return next;
    });
  };

  const addColorTags = (colorsToAddStr: string) => {
    const cleanColors = colorsToAddStr
      .split(",")
      .map(c => c.trim())
      .filter(c => c !== "");
    if (cleanColors.length === 0) return;

    setColors(prevColors => {
      const nextColors = [...prevColors];
      const addedColors: string[] = [];
      cleanColors.forEach(col => {
        if (!nextColors.includes(col)) {
          nextColors.push(col);
          addedColors.push(col);
        }
      });

      if (addedColors.length > 0) {
        setStockMatrix(prevMatrix => {
          const nextMatrix = { ...prevMatrix };
          sizes.forEach(sz => {
            if (!nextMatrix[sz]) nextMatrix[sz] = {};
            addedColors.forEach(col => {
              nextMatrix[sz][col] = 0;
            });
          });
          return nextMatrix;
        });
      }
      return nextColors;
    });
    setNewColorInput("");
  };

  const removeColorTag = (colorToRemove: string) => {
    const nextColors = colors.filter(c => c !== colorToRemove);
    setColors(nextColors);
    setStockMatrix(prev => {
      const next = { ...prev };
      sizes.forEach(size => {
        if (next[size]) {
          delete next[size][colorToRemove];
        }
      });
      return next;
    });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handlePrintBarcode = (p: Product) => {
    const printEl = document.createElement('div');
    printEl.id = 'barcode-sticker';
    printEl.innerHTML = `
      <div style="font-family: monospace; text-align: center; font-size: 12px; width: 50mm; height: 50mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; background: white; color: black; box-sizing: border-box; padding: 8px 2px 8px 2px;">
        <div style="font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid #141414; width: 44mm; padding-bottom: 2px;">STREET RAGE</div>
        <div style="font-size: 10px; margin-top: 2px; color: #141414; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 44mm;">${p.name}</div>
        <div style="height: 14mm; display: flex; align-items: center; justify-content: center; overflow: hidden; margin: 2px 0; width: 44mm;">
          <div class="font-barcode" style="font-size: 42px; line-height: 1.2; font-family: 'Libre Barcode 128', sans-serif;">*${p.id}*</div>
        </div>
        <div style="font-size: 9px; letter-spacing: 1px; font-family: monospace; font-weight: bold; color: #666666;">${p.id}</div>
        <div style="font-size: 12px; font-weight: bold; border-top: 1px dashed #666666; width: 44mm; padding-top: 4px;">MRP: ₹${p.price.toLocaleString('en-IN')}</div>
      </div>
    `;

    const styleEl = document.createElement('style');
    styleEl.innerHTML = `@page { size: 50mm 50mm; margin: 0; }`;

    document.body.appendChild(printEl);
    document.head.appendChild(styleEl);
    window.print();

    setTimeout(() => {
      document.body.removeChild(printEl);
      document.head.removeChild(styleEl);
    }, 500);
  };

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.id.trim()) newErrors.id = "Barcode / SKU is required.";
    if (!formData.name.trim()) newErrors.name = "Product Name is required.";
    if (!formData.category.trim()) newErrors.category = "Category is required.";
    if (formData.price <= 0) newErrors.price = "Selling price must be greater than zero.";
    if (formData.costPrice < 0) newErrors.costPrice = "Cost price cannot be negative.";
    if (!formData.hsn.trim()) newErrors.hsn = "HSN code is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      ...formData,
      stock: stockMatrix
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[#E4E3E0] bg-white">
        <SheetHeader>
          <div className="flex gap-4 items-start mb-4">
            <img src={formData.imageUrl || DEFAULT_PRODUCT_IMAGE} alt={formData.name || "New"} className="w-16 h-16 object-cover rounded-md" />
            <div>
              <SheetTitle className="font-sans text-xl tracking-tight text-[#141414] text-left">
                {product ? "Edit Product" : "New Product"}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs text-[#999999] text-left mt-1">
                Fill in the product details.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
      </div>
      <div className="p-6 flex-1 bg-[#FAFAFA] overflow-y-auto space-y-4">
        <div className="space-y-1">
          <label className="text-xs uppercase font-medium text-[#666666] tracking-wider">Barcode / ID</label>
          <div className="flex gap-2">
            <Input name="id" value={formData.id} onChange={handleChange} placeholder="e.g. 890123..." className="font-mono border-[#E4E3E0]" disabled={!!product} />
            {!product && (
              <Button type="button" variant="outline" className="text-xs font-mono uppercase px-3" onClick={() => setFormData(prev => ({ ...prev, id: generateEAN13() }))}>
                Regen
              </Button>
            )}
          </div>
          {errors.id && <p className="text-[10px] text-red-500 font-mono">{errors.id}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase font-medium text-[#666666] tracking-wider">Product Name</label>
          <Input name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Linen Shirt" className="border-[#E4E3E0]" />
          {errors.name && <p className="text-[10px] text-red-500 font-mono">{errors.name}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase font-medium text-[#666666] tracking-wider">Category</label>
          <Input name="category" value={formData.category} onChange={handleChange} placeholder="e.g. Ethnic" className="border-[#E4E3E0]" />
          {errors.category && <p className="text-[10px] text-red-500 font-mono">{errors.category}</p>}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {isAdmin ? (
            <div className="space-y-1">
              <label className="text-xs uppercase font-medium text-[#666666] tracking-wider">Cost Price</label>
              <Input type="number" name="costPrice" value={formData.costPrice || 0} onChange={handleChange} className="font-mono border-[#E4E3E0]" />
              {errors.costPrice && <p className="text-[10px] text-red-500 font-mono">{errors.costPrice}</p>}
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs uppercase font-medium text-[#666666] tracking-wider">Cost Price</label>
              <Input type="text" value="***" disabled className="font-mono border-[#E4E3E0] bg-gray-100 cursor-not-allowed" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs uppercase font-medium text-[#666666] tracking-wider">Selling Price</label>
            <Input type="number" name="price" value={formData.price} onChange={handleChange} className="font-mono border-[#E4E3E0]" />
            {errors.price && <p className="text-[10px] text-red-500 font-mono">{errors.price}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase font-medium text-[#666666] tracking-wider">HSN Code</label>
          <Input name="hsn" value={formData.hsn} onChange={handleChange} placeholder="e.g. 6205" className="font-mono border-[#E4E3E0]" />
          {errors.hsn && <p className="text-[10px] text-red-500 font-mono">{errors.hsn}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase font-medium text-[#666666] tracking-wider">Image URL</label>
          <Input name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://..." className="font-mono border-[#E4E3E0]" />
        </div>
        
        {/* Dynamic Size and Color Stock Grid Matrix */}
        <div className="pt-6 mt-6 border-t border-[#E4E3E0] space-y-4">
          <h3 className="text-sm font-semibold text-[#141414] uppercase tracking-wider mb-2">Sizes & Colors Matrix</h3>
          
          {/* Colors Tag Inputs */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-mono text-[#666666] tracking-wider block">Colors</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {colors.map(color => (
                <Badge key={color} variant="secondary" className="flex items-center gap-1 bg-white border border-[#E4E3E0] text-[#141414] font-mono font-normal py-1 px-2.5 rounded-full">
                  {color}
                  <button type="button" onClick={() => removeColorTag(color)} className="hover:text-red-500 font-bold ml-1 text-xs">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input 
                placeholder="Add new color (e.g. Blue)..." 
                value={newColorInput}
                onChange={e => {
                  const val = e.target.value;
                  if (val.includes(",")) {
                    const parts = val.split(",");
                    const lastPart = parts[parts.length - 1];
                    if (val.endsWith(",")) {
                      addColorTags(val);
                      setNewColorInput("");
                    } else {
                      const toAdd = parts.slice(0, -1).join(",");
                      addColorTags(toAdd);
                      setNewColorInput(lastPart);
                    }
                  } else {
                    setNewColorInput(val);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addColorTags(newColorInput);
                  }
                }}
                className="border-[#E4E3E0] bg-white font-mono text-xs"
              />
              <Button type="button" variant="outline" className="text-xs font-mono uppercase px-3" onClick={() => addColorTags(newColorInput)}>
                Add
              </Button>
            </div>
          </div>

          {/* Sizes Tag Inputs */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-mono text-[#666666] tracking-wider block">Sizes</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sizes.map(size => (
                <Badge key={size} variant="secondary" className="flex items-center gap-1 bg-white border border-[#E4E3E0] text-[#141414] font-mono font-normal py-1 px-2.5 rounded-full">
                  {size}
                  <button type="button" onClick={() => removeSizeTag(size)} className="hover:text-red-500 font-bold ml-1 text-xs">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input 
                placeholder="Add new size (e.g. S, XL)..." 
                value={newSizeInput}
                onChange={e => {
                  const val = e.target.value;
                  if (val.includes(",")) {
                    const parts = val.split(",");
                    const lastPart = parts[parts.length - 1];
                    if (val.endsWith(",")) {
                      addSizeTags(val);
                      setNewSizeInput("");
                    } else {
                      const toAdd = parts.slice(0, -1).join(",");
                      addSizeTags(toAdd);
                      setNewSizeInput(lastPart);
                    }
                  } else {
                    setNewSizeInput(val);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSizeTags(newSizeInput);
                  }
                }}
                className="border-[#E4E3E0] bg-white font-mono text-xs"
              />
              <Button type="button" variant="outline" className="text-xs font-mono uppercase px-3" onClick={() => addSizeTags(newSizeInput)}>
                Add
              </Button>
            </div>
            
            {/* Quick size chips */}
            <div className="flex flex-wrap gap-1 mt-2">
              {["S", "M", "L", "XL", "XXL", "One Size"].map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => addSizeTags(sz)}
                  className="text-[10px] font-mono bg-slate-50 hover:bg-slate-100 border border-[#E4E3E0] text-[#666666] px-2 py-0.5 rounded transition-colors"
                >
                  +{sz}
                </button>
              ))}
            </div>
          </div>

          {/* Table Matrix Editor */}
          {colors.length > 0 && sizes.length > 0 ? (
            <div className="overflow-x-auto border border-[#E4E3E0] rounded-xl bg-white shadow-sm p-4">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#F0F0F0]">
                    <th className="py-2 text-[#999999] font-mono uppercase tracking-wider">Color \\ Size</th>
                    {sizes.map(size => (
                      <th key={size} className="py-2 px-1 text-center font-mono uppercase tracking-wider text-[#141414] font-medium">{size}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {colors.map(color => (
                    <tr key={color} className="hover:bg-[#FAFAFA]">
                      <td className="py-3 font-semibold text-[#141414]">{color}</td>
                      {sizes.map(size => (
                        <td key={size} className="py-2 px-1 text-center">
                          <input 
                            type="number" 
                            min="0"
                            value={stockMatrix[size]?.[color] ?? 0}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setStockMatrix(prev => ({
                                ...prev,
                                [size]: {
                                  ...prev[size],
                                  [color]: val
                                }
                              }));
                            }}
                            className="w-16 text-center py-1.5 border border-[#E4E3E0] rounded-md bg-white font-mono text-xs focus:outline-none focus:border-[#141414]"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[10px] text-red-500 font-mono text-center py-2 bg-red-50 rounded-lg border border-red-100">
              Please enter at least one size and one color to open the stock matrix.
            </p>
          )}
        </div>
      </div>
      <div className="p-6 bg-white border-t border-[#E4E3E0] flex flex-col gap-3">
        <Button className="w-full bg-[#141414] hover:bg-[#333333] text-white py-6 text-xs uppercase tracking-widest" onClick={handleSave}>
          Save Product
        </Button>
        <Button 
          variant="outline" 
          className="w-full border-[#E4E3E0] text-[#141414] hover:bg-transparent hover:border-[#141414] py-6 text-xs uppercase tracking-widest font-mono"
          onClick={() => handlePrintBarcode(formData)}
        >
          Print Barcode Label
        </Button>
        {product && isAdmin && (
          <Button variant="destructive" className="w-full py-6 text-xs uppercase tracking-widest" onClick={() => onDelete(product.id)}>
            Delete Product
          </Button>
        )}
      </div>
    </div>
  );
}
