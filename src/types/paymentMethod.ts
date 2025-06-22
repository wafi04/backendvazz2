export interface PaymentMethod {
  name: string;
  id: number;
  type: string;
  createdAt: string | null;
  updatedAt: string | null;
  code: string;
  images: string;
  keterangan: string;
  minAmount: number | null;
  typeTax: string | null;
  taxAdmin: number | null;
  minExpired: number | null;
  maxExpired: number | null;
  maxAmount: number | null;
  isActive: string
}