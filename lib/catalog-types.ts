export type Category = { id: number; name: string; sortOrder: number };
export type Attribute = { id: number; type: "series" | "glass" | "color" | "lock"; name: string; sortOrder: number };
export type Product = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  basePrice: number;
  description: string;
  defaultSeriesId: number | null;
  defaultGlassId: number | null;
  defaultSeries: string | null;
  defaultGlass: string | null;
  imageKey: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  productKey: string | null;
  designId: string | null;
  isCustom: boolean;
  updatedAt: string;
};
export type Settings = {
  id: number;
  companyName: string;
  logoKey: string | null;
  address: string;
  contactNumbers: string;
  email: string;
  tin: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankName: string;
  bankBranch: string;
  termsConditions: string;
  pdfHeader: string;
  updatedAt: string;
};

export type FinishedProjectItem = {
  id: string;
  name: string;
  category: "Windows" | "Doors" | "Others";
  itemCode?: string;
  quoteOption?: number;
  widthM?: number;
  heightM?: number;
  widthFt?: number;
  heightFt?: number;
  quantity?: number;
  rate?: number;
  total?: number;
  series?: string;
  glass?: string;
  color?: string;
  lock?: string;
  description?: string;
  imageDataUrl?: string;
  productId?: number | null;
};

export type FinishedProject = {
  id: number;
  projectName: string;
  clientName: string;
  projectAddress: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData?: string;
  items: FinishedProjectItem[];
  notes?: string;
  status: "completed" | "archived" | "in_progress" | "historical";
  createdAt: string;
  updatedAt: string;
};

export type FinishedProjectInput = Omit<FinishedProject, "id" | "createdAt" | "updatedAt"> & {
  id?: number;
};

export type Catalog = {
  settings: Settings;
  categories: Category[];
  products: Product[];
  attributes: Attribute[];
};
