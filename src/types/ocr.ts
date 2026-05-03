export interface OcrParsed {
  date: string | null
  totalCents: number | null
  supplierName: string | null
  supplierCnpj: string | null
  suggestedAccountCode: string | null
  suggestedCorporateAccountId?: string | null
}
