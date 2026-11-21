export interface VehicleItem {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: string;
  color: string;
  lot: string;
  status: string;
  notes: string;
  checked?: boolean;
}

export type PrintFormat = 'thermal58' | 'letter';

export type ThermalFontSize = 'compact' | 'normal' | 'large';
export type ThermalDensity = 'ultra' | 'compact' | 'normal';
export type BarcodeType = 'code128' | 'qr' | 'none';

export interface ThermalSettings {
  fontSize: ThermalFontSize;
  density: ThermalDensity;
  barcodeType: BarcodeType;
  showDetails: boolean;
  showLot: boolean;
  showCheckboxes: boolean;
  showDividers: boolean;
  paperWidthMm: number; // 58mm default
  customHeader: string;
  customFooter: string;
  showTimestamp: boolean;
}

export interface LetterSettings {
  companyName: string;
  yardName: string;
  documentTitle: string;
  supervisorName: string;
  showCheckboxes: boolean;
  showStats: boolean;
  notes: string;
  columnsPerPage: number;
  showQrCode: boolean;
}

export interface InventoryMeta {
  title: string;
  date: string;
  time: string;
  location: string;
  operator: string;
  notes: string;
}
