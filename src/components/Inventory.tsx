import React, { useState } from 'react';
import ReactBarcode from 'react-barcode';
import { Product, ProductVariant, ProductMovement } from '../types';
import { Plus, Edit2, Trash2, Package, Search, ChevronDown, Filter, MoreVertical, X, Shirt, Baby, Footprints, Watch, ShoppingBag, History as HistoryIcon, Barcode as BarcodeIcon, ShieldAlert, Boxes, Truck, Image as ImageIcon, Download } from 'lucide-react';
import { CATEGORIES } from '../data';
import { uploadImage } from '../utils/fileHelper';
import { decodeAzertyBarcode, isMangledAzertyBarcode, autoDecodeBarcodeIfMangled } from '../utils/barcodeHelper';

interface InventoryProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  movements: ProductMovement[];
  trackMovement: (productId: string, variantId: string, type: ProductMovement['type'], quantity: number, reason: string) => void;
}

const RenderProductIcon = ({ iconName, className }: { iconName: string, className?: string }) => {
  const getIconColor = (name: string) => {
    switch (name) {
      case 'Shirt': return 'text-amber-800 bg-amber-50';
      case 'Baby': return 'text-emerald-800 bg-emerald-50';
      case 'Footprints': return 'text-rose-800 bg-rose-50';
      case 'Watch': return 'text-indigo-800 bg-indigo-50';
      case 'ShoppingBag': return 'text-slate-800 bg-slate-50';
      default: return 'text-neutral-800 bg-neutral-50';
    }
  };

  const icons: Record<string, React.ReactNode> = {
    'Shirt': <Shirt className={className} />,
    'Baby': <Baby className={className} />,
    'Footprints': <Footprints className={className} />,
    'Watch': <Watch className={className} />,
    'ShoppingBag': <ShoppingBag className={className} />,
  };
  
  return (
    <div className={`w-full h-full flex items-center justify-center rounded-none border border-neutral-100 ${getIconColor(iconName)}`}>
      {icons[iconName] || <Shirt className={className} />}
    </div>
  );
};

export default function Inventory({ products, setProducts, movements, trackMovement }: InventoryProps) {
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'WHOLESALE' | 'HISTORY'>('ITEMS');
  const [selectedCat, setSelectedCat] = useState('Tous');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);

  // Editing state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // New Product Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[1]);
  const [newSubCategory, setNewSubCategory] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newIcon, setNewIcon] = useState('Shirt');
  const [newVariants, setNewVariants] = useState<ProductVariant[]>([]);
  
  // Custom states for wholesales and photo:
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [newIsWholesaleEnabled, setNewIsWholesaleEnabled] = useState(false);
  const [newWholesalePrice, setNewWholesalePrice] = useState('');
  const [newWholesaleMinQty, setNewWholesaleMinQty] = useState('10');
  const [newBulkPackQty, setNewBulkPackQty] = useState('12');

  // Wholesale bulk receive form state:
  const [wholesaleSelProdId, setWholesaleSelProdId] = useState('');
  const [wholesaleSelVarId, setWholesaleSelVarId] = useState('');
  const [wholesaleCartons, setWholesaleCartons] = useState('1');
  const [wholesaleSupplier, setWholesaleSupplier] = useState('');
  const [wholesalePiecesPerCarton, setWholesalePiecesPerCarton] = useState('12');

  const resetForm = (prod?: Product) => {
    if (prod) {
      setEditingProduct(prod);
      setNewName(prod.name);
      setNewCategory(prod.category);
      setNewSubCategory(prod.subCategory || '');
      setNewPrice(prod.basePrice.toString());
      setNewIcon(prod.imageColor);
      setNewImageUrl(prod.imageUrl || '');
      setNewIsWholesaleEnabled(!!prod.isWholesaleEnabled);
      setNewWholesalePrice(prod.wholesalePrice ? prod.wholesalePrice.toString() : '');
      setNewWholesaleMinQty(prod.wholesaleMinQty ? prod.wholesaleMinQty.toString() : '10');
      setNewBulkPackQty(prod.bulkPackQty ? prod.bulkPackQty.toString() : '12');
      setNewVariants(prod.variants);
    } else {
      setEditingProduct(null);
      setNewName('');
      setNewCategory(CATEGORIES[1]);
      setNewSubCategory('');
      setNewPrice('');
      setNewIcon('Shirt');
      setNewImageUrl('');
      setNewIsWholesaleEnabled(false);
      setNewWholesalePrice('');
      setNewWholesaleMinQty('10');
      setNewBulkPackQty('12');
      setNewVariants([
        { id: Date.now().toString(), size: 'Unique', color: 'Standard', stock: 10, barcode: `ZARA-${Math.floor(100000 + Math.random() * 900000)}` }
      ]);
    }
  };

  const handleOpenModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    resetForm(prod);
    setIsModalOpen(true);
  };

  const addVariant = () => {
    setNewVariants([...newVariants, { 
      id: (Date.now() + newVariants.length).toString(), 
      size: '', 
      color: '', 
      stock: 0, 
      barcode: `ZARA-${Math.floor(100000 + Math.random() * 900000)}` 
    }]);
  };

  const removeVariant = (id: string) => {
    if (newVariants.length > 1) {
      setNewVariants(newVariants.filter(v => v.id !== id));
    }
  };

  const updateVariant = (id: string, field: keyof ProductVariant, value: string | number) => {
    let finalValue = value;
    if (field === 'barcode' && typeof value === 'string') {
      if (isMangledAzertyBarcode(value)) {
        finalValue = decodeAzertyBarcode(value);
      }
    }
    setNewVariants(newVariants.map(v => v.id === id ? { ...v, [field]: finalValue } : v));
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseInt(newPrice) || 0;
    const parsedWholesalePrice = newWholesalePrice ? parseInt(newWholesalePrice) : undefined;
    const parsedWholesaleMinQty = newWholesaleMinQty ? parseInt(newWholesaleMinQty) : undefined;
    const parsedBulkPackQty = newBulkPackQty ? parseInt(newBulkPackQty) : undefined;

    if (editingProduct) {
      const updatedProducts = products.map(p => {
        if (p.id === editingProduct.id) {
          return {
            ...p,
            name: newName,
            category: newCategory,
            subCategory: newSubCategory,
            basePrice: parsedPrice,
            imageColor: newIcon,
            imageUrl: newImageUrl || undefined,
            isWholesaleEnabled: newIsWholesaleEnabled,
            wholesalePrice: parsedWholesalePrice,
            wholesaleMinQty: parsedWholesaleMinQty,
            bulkPackQty: parsedBulkPackQty,
            variants: newVariants
          };
        }
        return p;
      });
      setProducts(updatedProducts);
    } else {
      const newProduct: Product = {
        id: `PROD-${Date.now()}`,
        name: newName,
        category: newCategory,
        subCategory: newSubCategory,
        basePrice: parsedPrice,
        variants: newVariants,
        imageColor: newIcon,
        imageUrl: newImageUrl || undefined,
        isWholesaleEnabled: newIsWholesaleEnabled,
        wholesalePrice: parsedWholesalePrice,
        wholesaleMinQty: parsedWholesaleMinQty,
        bulkPackQty: parsedBulkPackQty
      };
      setProducts([...products, newProduct]);
    }
    setIsModalOpen(false);
  };

  const handleWholesaleSupplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wholesaleSelProdId || !wholesaleSelVarId) {
      alert("Veuillez sélectionner un article et une variante.");
      return;
    }

    const prod = products.find(p => p.id === wholesaleSelProdId);
    if (!prod) return;

    const cartonsNum = parseInt(wholesaleCartons) || 0;
    const piecesPerCarton = parseInt(wholesalePiecesPerCarton) || prod.bulkPackQty || 12;
    const totalNewQty = cartonsNum * piecesPerCarton;

    if (totalNewQty <= 0) {
      alert("Veuillez saisir un nombre valide de cartons.");
      return;
    }

    const updatedProducts = products.map(p => {
      if (p.id === wholesaleSelProdId) {
        return {
          ...p,
          variants: p.variants.map(v => {
            if (v.id === wholesaleSelVarId) {
              return { ...v, stock: v.stock + totalNewQty };
            }
            return v;
          })
        };
      }
      return p;
    });

    setProducts(updatedProducts);

    // Track movement
    trackMovement(
      wholesaleSelProdId,
      wholesaleSelVarId,
      'RESTOCK',
      totalNewQty,
      `Livraison en gros: +${cartonsNum} cartons de ${piecesPerCarton} pièces par ${wholesaleSupplier || 'Fournisseur Inconnu'}`
    );

    alert(`Fourniture enregistrée avec succès ! +${totalNewQty} pièces ajoutées au stock.`);
    
    // Reset form fields
    setWholesaleSelProdId('');
    setWholesaleSelVarId('');
    setWholesaleCartons('1');
    setWholesalePiecesPerCarton('12');
    setWholesaleSupplier('');
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCat === 'Tous' || p.category === selectedCat;
    const s = search.toLowerCase();
    const decodedS = decodeAzertyBarcode(s);
    const matchesName = p.name.toLowerCase().includes(s) || p.name.toLowerCase().includes(decodedS);
    const matchesSub = p.subCategory?.toLowerCase().includes(s) || p.subCategory?.toLowerCase().includes(decodedS);
    const matchesBarcode = p.variants.some(v => 
      v.barcode?.toLowerCase().includes(s) || 
      v.barcode?.toLowerCase().includes(decodedS)
    );
    return matchesCat && (matchesName || matchesSub || matchesBarcode);
  });

  const isLowStock = (product: Product) => {
    const total = product.variants.reduce((sum, v) => sum + v.stock, 0);
    return total < 5 && total > 0;
  };

  const isOutOfStock = (product: Product) => {
    return product.variants.reduce((sum, v) => sum + v.stock, 0) === 0;
  };

  const formatFCFA = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-white flex-1 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex justify-between items-end mb-12 border-b border-neutral-100 pb-8">
          <div>
            <h2 className="text-4xl font-black text-black tracking-tighter uppercase mb-2">Gestion des Stocks</h2>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.3em]">Contrôle inventaire et traçabilité des articles Zara</p>
          </div>
          <div className="flex gap-4">
             <div className="flex border-2 border-black p-1">
                <button 
                  onClick={() => setActiveTab('ITEMS')}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ITEMS' ? 'bg-black text-white' : 'bg-transparent text-black'}`}
                >
                  Articles
                </button>
                <button 
                  onClick={() => setActiveTab('WHOLESALE')}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'WHOLESALE' ? 'bg-black text-white' : 'bg-transparent text-black'}`}
                >
                  <Boxes className="w-3.5 h-3.5 mr-1.5 inline" /> Fourniture Gros
                </button>
                <button 
                  onClick={() => setActiveTab('HISTORY')}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'HISTORY' ? 'bg-black text-white' : 'bg-transparent text-black'}`}
                >
                  <HistoryIcon className="w-3.5 h-3.5 mr-1.5 inline" /> Historique
                </button>
                <div className="flex gap-2 border-l border-neutral-200 pl-4 ml-2">
                  <button
                    onClick={() => {
                      const csvContent = "data:text/csv;charset=utf-8," 
                        + "Nom,Prix,Categorie,SubCategory,Taille,Couleur,Stock,CodeBarre\n"
                        + "T-Shirt Basic,15000,Vêtements,Hauts,M,Noir,50,ZARA-123456\n"
                        + "Jeans Slim,25000,Vêtements,Bas,32,Bleu,30,ZARA-654321";
                      
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", "modele_import_produits.csv");
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-emerald-600 text-emerald-600 hover:bg-emerald-50 transition-all flex items-center"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 inline" /> Modèle CSV
                  </button>
                  <label className="cursor-pointer px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center">
                    <Plus className="w-3.5 h-3.5 mr-1.5 inline" /> Import Excel/CSV
                    <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const xlsx = await import('xlsx');
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const bstr = evt.target?.result;
                          const wb = xlsx.read(bstr, { type: 'binary' });
                          const wsname = wb.SheetNames[0];
                          const ws = wb.Sheets[wsname];
                          const data = xlsx.utils.sheet_to_json(ws);
                          
                          if (data && data.length > 0) {
                            const newProducts = [...products];
                            data.forEach((row: any) => {
                              // Adaptation base on standard Zara export/import Excel forms
                              const existingProduct = products.find(p => p.name === (row.Nom || row.Name));
                              
                              const rawBarcode = String(row.CodeBarre || row.Barcode || '');
                              const decodedBarcode = isMangledAzertyBarcode(rawBarcode) ? decodeAzertyBarcode(rawBarcode) : rawBarcode;
                              const finalBarcode = decodedBarcode || `ZARA-${Math.floor(100000 + Math.random() * 900000)}`;

                              if (existingProduct) {
                                // If the product exists, try adding a variant instead
                                const variantExists = existingProduct.variants.find(v => v.barcode === rawBarcode || v.barcode === decodedBarcode);
                                if (variantExists) {
                                  variantExists.stock += parseInt(row.Stock || 0);
                                  trackMovement(existingProduct.id, variantExists.id, 'RESTOCK', parseInt(row.Stock || 0), 'Import Excel (Update)');
                                } else {
                                  existingProduct.variants.push({
                                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                    size: row.Taille || row.Size || 'Unique',
                                    color: row.Couleur || row.Color || 'Standard',
                                    stock: parseInt(row.Stock || 0),
                                    barcode: finalBarcode
                                  });
                                }
                              } else {
                                const newProd: Product = {
                                  id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                  name: row.Nom || row.Name || 'Produit Importé',
                                  basePrice: parseInt(row.Prix || row.Price || 0),
                                  category: row.Categorie || row.Category || 'Accessoires',
                                  subCategory: row.SubCategory || '',
                                  imageColor: 'ShoppingBag',
                                  variants: [{
                                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                    size: row.Taille || row.Size || 'Unique',
                                    color: row.Couleur || row.Color || 'Standard',
                                    stock: parseInt(row.Stock || 0),
                                    barcode: finalBarcode
                                  }]
                                };
                                trackMovement(newProd.id, newProd.variants[0].id, 'RESTOCK', parseInt(row.Stock || 0), 'Import Excel (New)');
                                newProducts.push(newProd);
                              }
                            });
                            setProducts(newProducts);
                            alert(`${data.length} lignes importées ou mises à jour.`);
                          }
                        };
                        reader.readAsBinaryString(file);
                      } catch (err) {
                        alert("Erreur lors de l'import: " + err);
                      }
                    }}
                  />
                </label>
                </div>
             </div>
             <button 
               onClick={handleOpenModal}
               className="bg-black text-white px-8 py-3 text-xs font-black uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center shadow-xl shadow-black/10"
             >
               <Plus className="w-4 h-4 mr-2" /> Nouvel Article
             </button>
          </div>
        </div>

        {activeTab === 'ITEMS' ? (
          <>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-6 mb-10 items-center justify-between">
              <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto">
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setSelectedCat(cat)}
                    className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${selectedCat === cat ? 'bg-black text-white border-black' : 'bg-white text-neutral-400 border-neutral-200 hover:border-black hover:text-black'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Rechercher article..." 
                  value={search}
                  onChange={(e) => setSearch(autoDecodeBarcodeIfMangled(e.target.value))}
                  className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-100 text-xs font-bold focus:bg-white focus:border-black outline-none transition-all uppercase tracking-widest"
                />
              </div>
            </div>

            {/* Inventory List */}
            <div className="bg-white border border-neutral-100 shadow-sm overflow-x-auto">
               <table className="min-w-full text-left">
                 <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-100">
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Article</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Catégorie</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">État Stock</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Prix Unitaire</th>
                      <th className="p-6 text-right text-[10px] font-black uppercase tracking-widest text-neutral-400">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-neutral-50">
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors group">
                        <td className="p-6">
                           <div className="flex items-center gap-5">
                              <div className="w-12 h-12 flex-shrink-0 overflow-hidden bg-neutral-100 flex items-center justify-center relative border border-neutral-150">
                                 {p.imageUrl ? (
                                   <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                 ) : (
                                   <RenderProductIcon iconName={p.imageColor} className="w-6 h-6" />
                                 )}
                              </div>
                              <div>
                                 <p className="text-sm font-black text-black uppercase tracking-tight flex items-center gap-2">
                                   {p.name}
                                   {p.isWholesaleEnabled && <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase px-1 rounded-sm">Gros</span>}
                                 </p>
                                 <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">{p.subCategory}</p>
                              </div>
                           </div>
                        </td>
                        <td className="p-6">
                           <span className="text-[10px] font-black text-black uppercase tracking-[0.2em]">{p.category}</span>
                           {isOutOfStock(p) ? (
                             <span className="ml-3 px-2 py-0.5 bg-red-600 text-white text-[8px] font-black font-mono tracking-widest uppercase">Épuisé</span>
                           ) : isLowStock(p) ? (
                             <span className="ml-3 px-2 py-0.5 bg-red-100 text-red-600 border border-red-200 text-[8px] font-black font-mono tracking-widest uppercase">Stock Critique</span>
                           ) : null}
                        </td>
                        <td className="p-6">
                           <div className="grid grid-cols-2 gap-x-6 gap-y-1 min-w-[220px] max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                              {p.variants.map(v => (
                                <div key={v.id} className="flex items-center justify-between gap-3 border-b border-neutral-50 pb-1">
                                   <span className="text-[8px] font-bold text-neutral-400 uppercase whitespace-nowrap">{v.size} {v.color && `/ ${v.color}`}</span>
                                   <div className="flex items-center gap-1.5">
                                      <span className={`text-[10px] font-black ${v.stock <= 0 ? 'text-red-500' : v.stock < 5 ? 'text-orange-600' : 'text-black'}`}>
                                        {v.stock}
                                      </span>
                                      {v.stock < 5 && v.stock > 0 && <ShieldAlert className="w-2.5 h-2.5 text-orange-500" />}
                                   </div>
                                </div>
                              ))}
                           </div>
                        </td>
                        <td className="p-6">
                           <span className="font-black text-sm text-black">{formatFCFA(p.basePrice)}</span>
                        </td>
                        <td className="p-6 text-right">
                           <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => { setBarcodeProduct(p); setIsBarcodeModalOpen(true); }}
                                className="p-3 text-neutral-300 hover:text-black hover:bg-white transition-colors border border-transparent hover:border-black"
                                title="Générer Code-Barres"
                              >
                                <BarcodeIcon className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleOpenEditModal(p)}
                                className="p-3 text-neutral-300 hover:text-black hover:bg-white transition-colors border border-transparent hover:border-black"
                                title="Modifier l'article"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  if (confirm(`Voulez-vous vraiment supprimer l'article ZARA "${p.name}" ?`)) {
                                    setProducts(products.filter(item => item.id !== p.id));
                                  }
                                }}
                                className="p-3 text-neutral-300 hover:text-red-600 hover:bg-white transition-colors border border-transparent hover:border-red-600"
                                title="Supprimer l'article"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            </div>
          </>
        ) : activeTab === 'WHOLESALE' ? (
          /* Wholesale / Fournitures View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
             {/* Left side: Receive Form */}
             <div className="bg-white border border-neutral-100 p-8 shadow-sm h-fit">
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-2.5 bg-neutral-900 text-white"><Truck className="w-4 h-4" /></div>
                   <div>
                      <h3 className="font-black text-xs uppercase tracking-tight text-neutral-900">Livraison en Gros</h3>
                      <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">Entrée de stocks d'articles par carton</p>
                   </div>
                </div>

                <form onSubmit={handleWholesaleSupplySubmit} className="space-y-6">
                   <div>
                      <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Choisir l'Article Zara</label>
                      <select 
                        required 
                        value={wholesaleSelProdId} 
                        onChange={e => {
                          setWholesaleSelProdId(e.target.value);
                          const prod = products.find(p => p.id === e.target.value);
                          if (prod && prod.variants.length > 0) {
                            setWholesaleSelVarId(prod.variants[0].id);
                          } else {
                            setWholesaleSelVarId('');
                          }
                        }} 
                        className="w-full bg-neutral-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none border border-neutral-200 focus:border-black cursor-pointer"
                      >
                        <option value="">-- SÉLECTIONNER UN ARTICLE --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name.toUpperCase()} {p.isWholesaleEnabled ? '(PRODUIT EN GROS)' : '(DÉTAIL SEUL)'}
                          </option>
                        ))}
                      </select>
                   </div>

                   {wholesaleSelProdId && (
                      <div>
                         <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Choisir Variante</label>
                         <select 
                           required 
                           value={wholesaleSelVarId} 
                           onChange={e => setWholesaleSelVarId(e.target.value)} 
                           className="w-full bg-neutral-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none border border-neutral-200 focus:border-black cursor-pointer"
                         >
                           <option value="">-- CHOISIR LA FICHE VARIANTE --</option>
                           {products.find(p => p.id === wholesaleSelProdId)?.variants.map(v => (
                             <option key={v.id} value={v.id}>
                               {v.size.toUpperCase()} {v.color ? `/ ${v.color.toUpperCase()}` : ''} (Stock: {v.stock} pcs)
                             </option>
                           ))}
                         </select>
                      </div>
                   )}

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Packs/Cartons livrés</label>
                         <input 
                           required 
                           type="number" 
                           min="1" 
                           value={wholesaleCartons} 
                           onChange={e => setWholesaleCartons(e.target.value)} 
                           className="w-full bg-neutral-50 px-4 py-3 text-[11px] font-black outline-none border border-neutral-200 focus:border-black" 
                         />
                      </div>
                      <div>
                         <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Pièces par Carton</label>
                         <input 
                           required
                           type="number"
                           min="1"
                           value={wholesalePiecesPerCarton}
                           onChange={e => setWholesalePiecesPerCarton(e.target.value)}
                           className="w-full bg-neutral-50 px-4 py-3 text-[11px] font-black outline-none border border-neutral-200 focus:border-black text-black" 
                         />
                      </div>
                   </div>

                   <div>
                      <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Fournisseur</label>
                      <input 
                        required 
                        type="text" 
                        value={wholesaleSupplier} 
                        onChange={e => setWholesaleSupplier(e.target.value)} 
                        className="w-full bg-neutral-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none border border-neutral-200 focus:border-black" 
                        placeholder="Ex: GROSSISTE SÉNÉGAL, ZARA ESPAGNE" 
                      />
                   </div>

                   {wholesaleSelProdId && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100">
                         <p className="text-[8px] font-black text-emerald-800 uppercase tracking-widest">Calcul Entrée de Stock :</p>
                         <p className="text-xl font-black text-emerald-900 mt-1">
                            +{ (parseInt(wholesaleCartons) || 0) * (parseInt(wholesalePiecesPerCarton) || 12) } PIÈCES
                         </p>
                         <p className="text-[7px] font-semibold text-emerald-700 uppercase tracking-widest mt-1">qui rejoindront automatiquement la variante choisie.</p>
                      </div>
                   )}

                   <button 
                     type="submit" 
                     className="w-full py-4 bg-black hover:bg-neutral-800 text-white text-[10px] font-black uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-2"
                   >
                     <Plus className="w-3.5 h-3.5" /> Enregistrer la Fourniture
                   </button>
                </form>
             </div>

             {/* Right side: Catalog listing of wholesale garments */}
             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-neutral-100 p-8 shadow-sm">
                   <h3 className="text-xs font-black uppercase tracking-tight mb-1 text-neutral-900 font-mono">Suivi Stock & Approvisionnement Gros</h3>
                   <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mb-6 border-b border-neutral-100 pb-4">Seuls les vêtements ayant l'option vente en gros activée apparaissent ci-dessous.</p>

                   <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      {products.filter(p => p.isWholesaleEnabled).map(p => {
                         const totalUnits = p.variants.reduce((acc, v) => acc + v.stock, 0);
                         const isCritical = totalUnits < 15;
                         return (
                            <div key={p.id} className="p-5 border border-neutral-100 bg-neutral-50/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-black transition-colors rounded-none">
                               <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 flex-shrink-0 bg-neutral-150 overflow-hidden relative border border-neutral-100 flex items-center justify-center">
                                     {p.imageUrl ? (
                                       <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                     ) : (
                                       <RenderProductIcon iconName={p.imageColor} className="w-5 h-5 border-0" />
                                     )}
                                  </div>
                                  <div>
                                     <h4 className="text-xs font-black text-black uppercase">{p.name}</h4>
                                     <div className="flex gap-4 mt-1 text-[8px] font-bold text-neutral-400 uppercase tracking-widest">
                                        <span>Détail: {formatFCFA(p.basePrice)}</span>
                                        <span className="text-emerald-700 font-black">Gros: {formatFCFA(p.wholesalePrice || 0)}</span>
                                     </div>
                                  </div>
                               </div>

                               <div className="flex flex-wrap gap-4 items-center md:text-right border-t md:border-0 pt-3 md:pt-0 w-full md:w-auto">
                                  <div className="flex-1 md:flex-none">
                                     <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Minimum d'achat</p>
                                     <p className="text-[10px] font-black text-black uppercase mt-0.5">Dès {p.wholesaleMinQty || 10} pcs</p>
                                  </div>
                                  <div className="flex-1 md:flex-none">
                                     <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Conditionnement</p>
                                     <p className="text-[10px] font-black text-black uppercase mt-0.5">{p.bulkPackQty || 12} pcs/ctn</p>
                                  </div>
                                  <div className="flex-1 md:flex-none">
                                     <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Stock Disponible</p>
                                     <p className={`text-[10px] font-black uppercase mt-0.5 ${isCritical ? 'text-red-600' : 'text-neutral-900'}`}>{totalUnits} pcs ({Math.floor(totalUnits / (p.bulkPackQty || 12))} cartons)</p>
                                  </div>
                               </div>
                            </div>
                         );
                      })}
                      {products.filter(p => p.isWholesaleEnabled).length === 0 && (
                         <div className="p-10 text-center border border-dashed border-neutral-100 text-[10px] font-bold uppercase text-neutral-300">
                            Aucun article configuré en gros pour le moment. Modifiez la fiche d'un article pour activer le mode en gros.
                         </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        ) : (
          /* History View */
          <div className="bg-white border border-neutral-100 shadow-sm overflow-x-auto">
             <table className="min-w-full text-left">
                <thead>
                   <tr className="bg-neutral-50 border-b border-neutral-100">
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Date/Heure</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Article</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Type</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Quantité</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Raison</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {movements.length === 0 ? (
                    <tr><td colSpan={5} className="p-20 text-center text-neutral-300 text-[10px] font-bold uppercase tracking-widest">Aucun historique de mouvement</td></tr>
                  ) : (
                    movements.map(m => {
                      const prod = products.find(p => p.id === m.productId);
                      return (
                        <tr key={m.id} className="hover:bg-neutral-50/50">
                           <td className="p-6 text-[11px] font-bold text-neutral-400">{new Date(m.date).toLocaleString()}</td>
                           <td className="p-6">
                              <p className="text-[11px] font-black uppercase">{prod?.name || 'Inconnu'}</p>
                              <p className="text-[8px] text-neutral-400 font-bold uppercase">{m.variantId}</p>
                           </td>
                           <td className="p-6">
                              <span className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded ${m.type === 'SALE' ? 'bg-emerald-100 text-emerald-800' : m.type === 'RESTOCK' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                {m.type === 'SALE' ? 'Vente' : m.type === 'RESTOCK' ? 'Réassort' : 'Retour/Autre'}
                              </span>
                           </td>
                           <td className="p-6 font-black text-xs">{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                           <td className="p-6 text-[11px] font-bold text-neutral-500">{m.reason}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
             </table>
          </div>
        )}

      </div>

      {/* Barcode Generation Modal */}
      {isBarcodeModalOpen && barcodeProduct && (
        <div className="fixed inset-0 bg-neutral-900/60 z-[100] grid place-items-center overflow-y-auto p-4 py-12 backdrop-blur-sm">
           <div className="bg-white max-w-4xl w-full border-2 border-black p-10 animate-in zoom-in duration-200 relative">
              <button onClick={() => setIsBarcodeModalOpen(false)} className="absolute right-6 top-6 text-neutral-400 hover:text-black">
                 <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-8">Codes-Barres Zara</h3>
              <div id="barcode-print-area" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-10 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                 {barcodeProduct.variants.map(v => (
                   <div key={v.id} className="p-4 border border-neutral-100 flex flex-col items-center bg-neutral-50/30">
                      <p className="text-[8px] font-black uppercase text-neutral-400 mb-2 truncate w-full text-center">{v.color} / {v.size}</p>
                      <div className="bg-white border border-neutral-200 text-black p-2 w-full mb-3 flex flex-col items-center justify-center overflow-hidden">
                         <ReactBarcode 
                            value={v.barcode || 'ZARA-001'} 
                            width={1.5} 
                            height={40} 
                            fontSize={10} 
                            margin={0} 
                            displayValue={true} 
                            background="#ffffff" 
                            lineColor="#000000" 
                         />
                      </div>
                      <p className="text-[9px] font-black uppercase text-black">{formatFCFA(barcodeProduct.basePrice)}</p>
                   </div>
                 ))}
              </div>
              <div className="flex gap-4">
                 <button onClick={() => {
                   const printArea = document.getElementById('barcode-print-area');
                   if (printArea) {
                     printArea.style.maxHeight = 'none';
                     printArea.style.overflow = 'visible';
                     try {
                        import('../utils/print-helper').then(module => {
                            module.printElement('barcode-print-area', 'Codes Barres A4', 'A4');
                        });
                     } catch(e) { console.error(e) }
                     setTimeout(() => {
                        printArea.style.maxHeight = '60vh';
                        printArea.style.overflow = 'auto';
                     }, 1000);
                   }
                 }} className="flex-1 py-4 border border-black text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">Imprimer Étiquettes (A4)</button>
                 <button onClick={() => {
                   const printArea = document.getElementById('barcode-print-area');
                   if (printArea) {
                     printArea.className = 'flex flex-col gap-8 mb-10'; // Override for thermal
                     try {
                        import('../utils/print-helper').then(module => {
                            module.printElement('barcode-print-area', 'Codes Barres 58mm', '58mm');
                        });
                     } catch(e) { console.error(e) }
                     setTimeout(() => {
                        printArea.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-10 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar';
                     }, 1000);
                   }
                 }} className="flex-1 py-4 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-xl shadow-black/20">Imprimer Thermique (58mm)</button>
              </div>
           </div>
        </div>
      )}

      {/* Add New Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/90 z-[150] grid place-items-center overflow-y-auto p-4 py-12 backdrop-blur-sm">
           <div className="bg-white max-w-4xl w-full border-2 border-black my-8 animate-in zoom-in duration-200 relative flex flex-col h-fit max-h-[90vh]">
              <div className="p-8 border-b border-neutral-100 flex justify-between items-center bg-white sticky top-0 z-10">
                 <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Nouvel Article Zara</h3>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Configuration de la fiche produit et des stocks</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="text-neutral-300 hover:text-black transition-colors">
                    <X className="w-6 h-6" />
                 </button>
              </div>
              
              <form onSubmit={handleAddProduct} className="p-10 overflow-y-auto custom-scrollbar flex-1">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                    {/* General Info */}
                    <div className="space-y-8">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400 border-b border-neutral-100 pb-2">Informations Générales</h4>
                       <div>
                          <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Nom du Produit</label>
                          <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full text-lg font-black py-2 border-b-2 border-neutral-100 outline-none focus:border-black transition-all uppercase" placeholder="Ex: Chemise en Lin" />
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                          <div>
                             <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Catégorie</label>
                             <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full bg-neutral-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none border-b border-neutral-200 focus:border-black cursor-pointer">
                                {CATEGORIES.filter(c => c !== 'Tous').map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                          </div>
                          <div>
                             <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Sous-Catégorie</label>
                             <input type="text" value={newSubCategory} onChange={e => setNewSubCategory(e.target.value)} className="w-full text-[10px] font-black py-3 border-b-2 border-neutral-100 outline-none focus:border-black transition-all uppercase" placeholder="Ex: Robes d'été" />
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                          <div>
                             <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Prix de Base (FCFA)</label>
                             <input required type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full text-xl font-black py-2 border-b-2 border-neutral-100 outline-none focus:border-black transition-all" placeholder="0" />
                          </div>
                          <div>
                             <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Icône / Visuel</label>
                             <div className="flex gap-2">
                                {['Shirt', 'Baby', 'Footprints', 'Watch', 'ShoppingBag'].map(icon => (
                                   <button key={icon} type="button" onClick={() => setNewIcon(icon)} className={`p-2 border transition-all ${newIcon === icon ? 'border-black bg-black text-white' : 'border-neutral-100 text-neutral-400 hover:border-black'}`}>
                                      <div className="w-5 h-5 flex items-center justify-center">
                                         {icon === 'Shirt' && <Shirt className="w-4 h-4" />}
                                         {icon === 'Baby' && <Baby className="w-4 h-4" />}
                                         {icon === 'Footprints' && <Footprints className="w-4 h-4" />}
                                         {icon === 'Watch' && <Watch className="w-4 h-4" />}
                                         {icon === 'ShoppingBag' && <ShoppingBag className="w-4 h-4" />}
                                      </div>
                                   </button>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Article Photo Attachment & Wholesale Settings Group */}
                     <div className="space-y-6">
                        {/* Photo Attachment Container */}
                        <div className="p-4 bg-neutral-50/50 border border-neutral-100 flex flex-col md:flex-row gap-5 items-center">
                           {newImageUrl && (
                              <div className="w-16 h-16 bg-white border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center relative shadow-sm">
                                 <img src={newImageUrl} alt="Aperçu article" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                 <button type="button" onClick={() => setNewImageUrl('')} className="absolute inset-0 bg-neutral-950/80 text-white text-[7px] font-black uppercase transition-all opacity-0 hover:opacity-100 flex items-center justify-center">Supprimer</button>
                              </div>
                           )}
                           <div className="flex-1 w-full space-y-2">
                              <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block font-sans">Joindre une Photo de l'Article</label>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setIsUploadingPhoto(true); uploadImage(file).then(setNewImageUrl).finally(() => setIsUploadingPhoto(false)); if (false) { const reader = new FileReader();
                                    } if (false) { const dummy = () => {
                                      // noop
                                    };
                                    }
                                  }
                                }} 
                                className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 block w-full file:mr-4 file:py-1.5 file:px-3 file:border-0 file:bg-neutral-900 file:text-white file:text-[8px] file:font-black file:uppercase file:tracking-widest cursor-pointer" 
                              />
                              <p className="text-[7px] text-neutral-400 uppercase tracking-widest font-semibold">OU collez une URL d'image existante :</p>
                              <input 
                                type="url" 
                                value={newImageUrl} 
                                onChange={e => setNewImageUrl(e.target.value)} 
                                placeholder="Ex: https://static.zara.net/photos/..." 
                                className="w-full bg-white border border-neutral-200 px-3 py-2 text-[8px] outline-none focus:border-black font-semibold text-neutral-600"
                              />
                           </div>
                        </div>

                        {/* Wholesale configurations */}
                        <div className="p-4 bg-neutral-50/70 border border-neutral-150 space-y-4">
                           <div className="flex justify-between items-center">
                              <div>
                                 <h5 className="text-[9px] font-black uppercase tracking-widest text-neutral-900">Activer Tarif Gros / Pack</h5>
                                 <p className="text-[7px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">Autorise le prix réduit par lots et la livraison par cartons</p>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => setNewIsWholesaleEnabled(!newIsWholesaleEnabled)}
                                className={`w-10 h-5 px-0.5 flex items-center transition-colors rounded-full ${newIsWholesaleEnabled ? 'bg-emerald-600 justify-end' : 'bg-neutral-300 justify-start'}`}
                              >
                                 <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                              </button>
                           </div>

                           {newIsWholesaleEnabled && (
                              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-neutral-200/60 animate-in fade-in duration-200">
                                 <div>
                                    <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Prix de Gros (Unit.)</label>
                                    <input 
                                       required={newIsWholesaleEnabled}
                                       type="number" 
                                       value={newWholesalePrice} 
                                       onChange={e => setNewWholesalePrice(e.target.value)} 
                                       className="w-full bg-white px-2.5 py-2 text-[10px] font-black outline-none border border-neutral-200 focus:border-black" 
                                       placeholder="0"
                                    />
                                 </div>
                                 <div>
                                    <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Seuil Min. (Gros)</label>
                                    <input 
                                       required={newIsWholesaleEnabled}
                                       type="number" 
                                       value={newWholesaleMinQty} 
                                       onChange={e => setNewWholesaleMinQty(e.target.value)} 
                                       className="w-full bg-white px-2.5 py-2 text-[10px] font-black outline-none border border-neutral-200 focus:border-black" 
                                       placeholder="10"
                                    />
                                 </div>
                                 <div>
                                    <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Pièces / Carton</label>
                                    <input 
                                       required={newIsWholesaleEnabled}
                                       type="number" 
                                       value={newBulkPackQty} 
                                       onChange={e => setNewBulkPackQty(e.target.value)} 
                                       className="w-full bg-white px-2.5 py-2 text-[10px] font-black outline-none border border-neutral-200 focus:border-black" 
                                       placeholder="12"
                                    />
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>

                     {/* Variants Management */}
                    <div className="space-y-8">
                       <div className="flex justify-between items-center border-b border-neutral-100 pb-2">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400">Variantes & Stocks</h4>
                          <button type="button" onClick={addVariant} className="text-[9px] font-black uppercase tracking-widest text-neutral-900 flex items-center hover:opacity-100 opacity-60">
                             <Plus className="w-3 h-3 mr-1" /> Ajouter Variante
                          </button>
                       </div>
                       <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {newVariants.map((v, idx) => (
                             <div key={v.id} className="p-4 bg-neutral-50 border border-neutral-100 relative group animate-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-3 gap-4">
                                   <div>
                                      <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Taille</label>
                                      <input required type="text" value={v.size} onChange={e => updateVariant(v.id, 'size', e.target.value)} className="w-full bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest outline-none border border-neutral-200 focus:border-black" placeholder="S, M, 38..." />
                                   </div>
                                   <div>
                                      <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Couleur</label>
                                      <input required type="text" value={v.color} onChange={e => updateVariant(v.id, 'color', e.target.value)} className="w-full bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest outline-none border border-neutral-200 focus:border-black" placeholder="Noir, Blanc..." />
                                   </div>
                                   <div>
                                      <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Stock Initial</label>
                                      <input required type="number" value={v.stock} onChange={e => updateVariant(v.id, 'stock', parseInt(e.target.value) || 0)} className="w-full bg-white px-3 py-2 text-[9px] font-black outline-none border border-neutral-200 focus:border-black" />
                                   </div>
                                </div>
                                <div className="mt-3 flex justify-between items-center">
                                   <div className="flex-1">
                                      <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Code-Barres (Scan ou Manuel)</label>
                                      <div className="flex gap-2">
                                        <input type="text" value={v.barcode} onChange={e => updateVariant(v.id, 'barcode', e.target.value)} placeholder="Scanner ou écrire" className="w-full bg-white px-3 py-2 text-[8px] font-mono outline-none border border-neutral-200 focus:border-black" />
                                        <button type="button" onClick={() => updateVariant(v.id, 'barcode', `ZARA-${Math.floor(100000 + Math.random() * 900000)}`)} className="px-3 bg-black text-white text-[8px] font-bold tracking-widest uppercase hover:bg-neutral-800 transition-colors shrink-0">
                                          Générer
                                        </button>
                                      </div>
                                   </div>
                                   {newVariants.length > 1 && (
                                      <button type="button" onClick={() => removeVariant(v.id)} className="ml-4 p-2 text-neutral-300 hover:text-red-500 transition-colors">
                                         <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                   )}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="flex gap-4 pt-10 border-t border-neutral-100 sticky bottom-0 bg-white">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-neutral-400 border border-neutral-100 hover:text-black hover:border-black transition-all">Abandonner</button>
                    <button type="submit" className="flex-[2] py-5 bg-black text-white text-[10px] font-black uppercase tracking-[0.4em] hover:bg-neutral-800 transition-all shadow-2xl">Enregistrer l'Article Zara</button>
                 </div>
              </form>
           </div>
        </div>
      )}

    </div>
  );
}
