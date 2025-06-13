import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Package, Search, Plus, Edit, Trash2, AlertTriangle, RefreshCw, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { productsApi, categoriesApi, unitsApi } from "@/services/api";
import { ProductDetailsModal } from "@/components/sales/ProductDetailsModal";
import { FilteredProductsModal } from "@/components/FilteredProductsModal";
import { Eye } from "lucide-react";
import { generateSKU } from "@/utils/skuGenerator";
import jsPDF from 'jspdf';

const Products = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isPdfExportDialogOpen, setIsPdfExportDialogOpen] = useState(false);
  const [selectedExportCategory, setSelectedExportCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20
  });
  const [filteredProductsModal, setFilteredProductsModal] = useState({
    open: false,
    title: '',
    filterType: 'all' as 'lowStock' | 'outOfStock' | 'inStock' | 'all'
  });
  const [productDetailsModal, setProductDetailsModal] = useState({
    open: false,
    product: null as any
  });

  useEffect(() => {
    fetchProducts(1);
    fetchCategories();
    fetchUnits();
  }, [searchTerm, categoryFilter]);

  const fetchCategories = async () => {
    try {
      const response = await categoriesApi.getAll();
      if (response.success && response.data) {
        console.log('Categories response:', response.data);
        const categoryList = [
          { value: "all", label: "All Categories" }
        ];
        
        if (Array.isArray(response.data)) {
          response.data.forEach((cat: any) => {
            if (typeof cat === 'string') {
              categoryList.push({ value: cat, label: cat });
            } else if (cat && typeof cat === 'object' && cat.name) {
              categoryList.push({ value: cat.name, label: cat.name });
            }
          });
        }
        
        setCategories(categoryList);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([
        { value: "all", label: "All Categories" },
        { value: "hinges", label: "Hinges & Hardware" },
        { value: "locks", label: "Locks & Security" },
        { value: "handles", label: "Handles & Knobs" },
        { value: "fasteners", label: "Fasteners & Screws" },
        { value: "sliding", label: "Sliding Systems" },
        { value: "tools", label: "Tools & Equipment" }
      ]);
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await unitsApi.getAll();
      if (response.success && response.data) {
        console.log('Units response:', response.data);
        const unitsList: any[] = [];
        
        if (Array.isArray(response.data)) {
          response.data.forEach((unit: any) => {
            if (typeof unit === 'string') {
              unitsList.push({ value: unit, label: unit });
            } else if (unit && typeof unit === 'object') {
              unitsList.push({ 
                value: unit.name || unit.value, 
                label: unit.label || unit.name || unit.value 
              });
            }
          });
        }
        
        setUnits(unitsList);
      }
    } catch (error) {
      console.error('Failed to fetch units:', error);
      setUnits([
        { value: "pieces", label: "Pieces" },
        { value: "kg", label: "Kilograms" },
        { value: "meters", label: "Meters" },
        { value: "liters", label: "Liters" },
        { value: "sets", label: "Sets" },
      ]);
    }
  };

  const fetchProducts = async (page = 1) => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20,
        status: 'active'
      };
      
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter !== 'all') params.category = categoryFilter;

      const response = await productsApi.getAll(params);
      
      if (response.success) {
        const productData = response.data.products || response.data || [];
        setProducts(Array.isArray(productData) ? productData : []);
        
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStockExportPDF = async (categoryToExport = "all") => {
    try {
      setExportLoading(true);
      
      // Fetch all products for export (without pagination)
      const params: any = { 
        limit: 10000, // Large number to get all products
        status: 'active' 
      };
      
      // Add category filter if not "all"
      if (categoryToExport !== "all") {
        params.category = categoryToExport;
      }
      
      const response = await productsApi.getAll(params);
      
      if (response.success) {
        const allProducts = response.data.products || response.data || [];
        
        // Create PDF
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.width;
        const pageHeight = pdf.internal.pageSize.height;
        const margin = 20;
        let yPos = margin;

        // Title
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        const title = categoryToExport === "all" ? 'Complete Stock Export Report' : `Stock Report - ${categoryToExport}`;
        pdf.text(title, pageWidth / 2, yPos, { align: 'center' });
        yPos += 15;

        // Export info
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Export Date: ${new Date().toLocaleString()}`, margin, yPos);
        yPos += 8;
        pdf.text(`Total Products: ${allProducts.length}`, margin, yPos);
        yPos += 8;
        if (categoryToExport !== "all") {
          pdf.text(`Category: ${categoryToExport}`, margin, yPos);
          yPos += 8;
        }

        // Calculate total stock value
        const totalStockValue = allProducts.reduce((total: number, product: any) => {
          return total + (product.stock * (product.costPrice || product.price));
        }, 0);
        pdf.text(`Total Stock Value: PKR ${totalStockValue.toLocaleString()}`, margin, yPos);
        yPos += 15;

        // Table headers
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        const headers = ['Product Name', 'SKU', 'Category', 'Stock', 'Unit', 'Price', 'Value'];
        const colWidths = [50, 30, 25, 20, 15, 25, 25];
        let xPos = margin;

        headers.forEach((header, index) => {
          pdf.text(header, xPos, yPos);
          xPos += colWidths[index];
        });
        yPos += 8;

        // Draw line under headers
        pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
        yPos += 3;

        // Table data
        pdf.setFont('helvetica', 'normal');
        allProducts.forEach((product: any) => {
          // Check if we need a new page
          if (yPos > pageHeight - 30) {
            pdf.addPage();
            yPos = margin;
          }

          xPos = margin;
          const rowData = [
            product.name.substring(0, 20) + (product.name.length > 20 ? '...' : ''),
            product.sku,
            product.category.substring(0, 12) + (product.category.length > 12 ? '...' : ''),
            product.stock.toString(),
            product.unit,
            product.price.toLocaleString(),
            (product.stock * (product.costPrice || product.price)).toLocaleString()
          ];

          rowData.forEach((data, index) => {
            pdf.text(data, xPos, yPos);
            xPos += colWidths[index];
          });
          yPos += 6;
        });

        // Footer
        yPos = pageHeight - 20;
        pdf.setFontSize(8);
        pdf.text(`Generated by Inventory Management System`, pageWidth / 2, yPos, { align: 'center' });

        // Save PDF
        const filename = categoryToExport === "all" 
          ? `stock_export_${new Date().toISOString().split('T')[0]}.pdf`
          : `stock_export_${categoryToExport}_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(filename);

        toast({
          title: "PDF Export Successful",
          description: `Exported ${allProducts.length} products to PDF${categoryToExport !== "all" ? ` for category: ${categoryToExport}` : ''}.`,
        });
      }
    } catch (error) {
      console.error('Failed to export stock to PDF:', error);
      toast({
        title: "PDF Export Failed",
        description: "Failed to export stock data to PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setExportLoading(false);
      setIsPdfExportDialogOpen(false);
    }
  };

  const handlePdfExportClick = () => {
    setIsPdfExportDialogOpen(true);
  };

  const handleConfirmPdfExport = () => {
    handleStockExportPDF(selectedExportCategory);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchProducts(page);
    }
  };

  const handleAddProduct = async (formData: any) => {
    try {
      const response = await productsApi.create(formData);
      if (response.success) {
        setIsDialogOpen(false);
        fetchProducts();
        toast({
          title: "Product Added",
          description: "New product has been added successfully.",
        });
      }
    } catch (error) {
      console.error('Failed to add product:', error);
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive"
      });
    }
  };

  const handleEditProduct = async (formData: any) => {
    try {
      const response = await productsApi.update(selectedProduct.id, formData);
      if (response.success) {
        setIsEditDialogOpen(false);
        setSelectedProduct(null);
        fetchProducts();
        toast({
          title: "Product Updated",
          description: "Product has been updated successfully.",
        });
      }
    } catch (error) {
      console.error('Failed to update product:', error);
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive"
      });
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    
    try {
      const response = await productsApi.delete(id);
      if (response.success) {
        fetchProducts();
        toast({
          title: "Product Deleted",
          description: "Product has been removed from inventory.",
        });
      }
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive"
      });
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    
    try {
      const response = await categoriesApi.create({ name: newCategory });
      if (response.success) {
        setNewCategory("");
        setIsCategoryDialogOpen(false);
        fetchCategories();
        toast({
          title: "Category Added",
          description: "New category has been added successfully.",
        });
      }
    } catch (error) {
      console.error('Failed to add category:', error);
      toast({
        title: "Error",
        description: "Failed to add category",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (product: any) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      hinges: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
      locks: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      handles: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
      fasteners: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
      sliding: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
      tools: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    };
    return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
  };

  const lowStockProducts = products.filter(product => product.stock <= product.minStock);

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;

    const { currentPage, totalPages } = pagination;
    const pages = [];

    pages.push(1);

    if (currentPage > 3) {
      pages.push('ellipsis-start');
    }

    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    for (let i = startPage; i <= endPage; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis-end');
    }

    if (totalPages > 1 && !pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              onClick={() => handlePageChange(currentPage - 1)}
              className={currentPage <= 1 ? "pointer-events-none opacity-50 cursor-not-allowed" : "cursor-pointer"}
            />
          </PaginationItem>
          
          {pages.map((page, index) => (
            <PaginationItem key={index}>
              {page === 'ellipsis-start' || page === 'ellipsis-end' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  onClick={() => handlePageChange(page as number)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          
          <PaginationItem>
            <PaginationNext 
              onClick={() => handlePageChange(currentPage + 1)}
              className={currentPage >= totalPages ? "pointer-events-none opacity-50 cursor-not-allowed" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  const openFilteredModal = (filterType: 'lowStock' | 'outOfStock' | 'inStock' | 'all', title: string) => {
    setFilteredProductsModal({
      open: true,
      title,
      filterType
    });
  };

  const openProductDetails = (product: any) => {
    setProductDetailsModal({
      open: true,
      product
    });
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex-1 p-6 space-y-6 min-h-screen bg-background">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-muted-foreground">Loading products...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 min-h-screen bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Products Management</h1>
            <p className="text-muted-foreground">Manage your inventory and product catalog</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="categoryName">Category Name</Label>
                  <Input
                    id="categoryName"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Enter category name"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddCategory} className="flex-1">Add Category</Button>
                  <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            onClick={handlePdfExportClick}
            disabled={exportLoading}
            className="bg-red-600 hover:bg-red-700 text-white border-red-600"
          >
            {exportLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            {exportLoading ? 'Exporting...' : 'PDF Export'}
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <ProductDialog 
              onSubmit={handleAddProduct} 
              onClose={() => setIsDialogOpen(false)} 
              categories={categories} 
              units={units}
            />
          </Dialog>
        </div>
      </div>

      {/* PDF Export Category Selection Dialog */}
      <Dialog open={isPdfExportDialogOpen} onOpenChange={setIsPdfExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Export Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="exportCategory">Choose which products to export:</Label>
              <Select value={selectedExportCategory} onValueChange={setSelectedExportCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleConfirmPdfExport} className="flex-1" disabled={exportLoading}>
                {exportLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                {exportLoading ? 'Exporting...' : 'Export PDF'}
              </Button>
              <Button variant="outline" onClick={() => setIsPdfExportDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openFilteredModal('all', 'All Products')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold text-blue-600">{pagination.totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openFilteredModal('inStock', 'Products In Stock')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">In Stock</p>
                <p className="text-2xl font-bold text-green-600">{products.filter(p => p.stock > p.minStock).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openFilteredModal('lowStock', 'Low Stock Products')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-red-600">{lowStockProducts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openFilteredModal('all', 'All Categories')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold text-purple-600">{categories.length - 1}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search products by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader>
          <CardTitle>
            Product Inventory 
            {pagination.totalItems > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({pagination.totalItems} total items)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg text-muted-foreground">Loading...</div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg text-muted-foreground">No products found</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
                {products.map((product) => (
                  <Card key={product.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground text-sm">{product.name}</h3>
                            <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge className={`text-xs ${getCategoryColor(product.category)}`}>
                              {product.category}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => openProductDetails(product)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-green-600">PKR {product.price?.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground">per {product.unit}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <Badge variant={product.stock <= product.minStock ? "destructive" : "default"}>
                            {product.stock} {product.unit}s
                          </Badge>
                          {product.stock <= product.minStock && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => openEditDialog(product)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {pagination.totalPages > 1 && (
                <div className="mt-6 flex justify-center">
                  {renderPagination()}
                </div>
              )}

              <div className="mt-4 text-center text-sm text-muted-foreground">
                Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems} products
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedProduct && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <ProductDialog 
            onSubmit={handleEditProduct} 
            onClose={() => {
              setIsEditDialogOpen(false);
              setSelectedProduct(null);
            }}
            categories={categories}
            units={units}
            initialData={selectedProduct}
            isEdit={true}
          />
        </Dialog>
      )}

      <FilteredProductsModal
        open={filteredProductsModal.open}
        onOpenChange={(open) => setFilteredProductsModal(prev => ({ ...prev, open }))}
        title={filteredProductsModal.title}
        products={products}
        filterType={filteredProductsModal.filterType}
      />

      <ProductDetailsModal
        open={productDetailsModal.open}
        onOpenChange={(open) => setProductDetailsModal(prev => ({ ...prev, open }))}
        product={productDetailsModal.product}
      />
    </div>
  );
};

const ProductDialog = ({ 
  onSubmit, 
  onClose, 
  categories, 
  units,
  initialData = null, 
  isEdit = false 
}: { 
  onSubmit: (data: any) => void; 
  onClose: () => void; 
  categories: any[];
  units: any[];
  initialData?: any;
  isEdit?: boolean;
}) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    sku: initialData?.sku || "",
    price: initialData?.price?.toString() || "",
    stock: initialData?.stock?.toString() || "",
    category: initialData?.category || "",
    unit: initialData?.unit || "",
    minStock: initialData?.minStock?.toString() || "",
    description: initialData?.description || "",
    costPrice: initialData?.costPrice?.toString() || "",
    maxStock: initialData?.maxStock?.toString() || ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock),
      minStock: parseInt(formData.minStock),
      costPrice: parseFloat(formData.costPrice),
      maxStock: parseInt(formData.maxStock)
    };
    onSubmit(submitData);
    if (!isEdit) {
      setFormData({ 
        name: "", sku: "", price: "", stock: "", category: "", 
        unit: "", minStock: "", description: "", costPrice: "", maxStock: "" 
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-generate SKU when name changes (only for new products)
      if (field === 'name' && !isEdit) {
        newData.sku = generateSKU(value);
      }
      
      return newData;
    });
  };

  const handleRegenerateSKU = () => {
    if (formData.name) {
      setFormData(prev => ({
        ...prev,
        sku: generateSKU(prev.name)
      }));
    }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Product' : 'Add New Product'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
          <div>
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="sku">SKU {!isEdit && '(Auto-generated)'}</Label>
            <div className="flex gap-1">
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleInputChange('sku', e.target.value)}
                placeholder={isEdit ? "Enter SKU" : "Auto-generated from name"}
                required
                className="flex-1"
              />
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateSKU}
                  disabled={!formData.name}
                  className="px-2"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="price">Price (PKR)</Label>
            <Input
              id="price"
              type="number"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="costPrice">Cost Price (PKR)</Label>
            <Input
              id="costPrice"
              type="number"
              value={formData.costPrice}
              onChange={(e) => handleInputChange('costPrice', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="stock">Stock Quantity</Label>
            <Input
              id="stock"
              type="number"
              value={formData.stock}
              onChange={(e) => handleInputChange('stock', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="minStock">Minimum Stock</Label>
            <Input
              id="minStock"
              type="number"
              value={formData.minStock}
              onChange={(e) => handleInputChange('minStock', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.filter(cat => cat.value !== "all").map((category) => (
                  <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="unit">Unit</Label>
            <Select value={formData.unit} onValueChange={(value) => handleInputChange('unit', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.value || unit.name} value={unit.value || unit.name}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter product description"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" className="flex-1">
            {isEdit ? 'Update Product' : 'Add Product'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </DialogContent>
  );
};

export default Products;
