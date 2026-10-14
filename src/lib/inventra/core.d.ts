type Fn = (...args: any[]) => any;
declare const Core: {
  parseISO: Fn; addDays: Fn; diffDays: Fn; todayISO: Fn; dailySeries: Fn; METHODS: any; forecast: Fn; backtest: Fn;
  weeklyPattern: Fn; chooseForecast: Fn; zForService: Fn; recommend: Fn; OPEN_PO: any; PENDING: any; openPOQty: Fn;
  recordSale: Fn; canDeleteProduct: Fn; archiveProduct: Fn; parseCSV: Fn; detectDelimiter: Fn; checkCSVText: Fn; FIELDS: any;
  detectMapping: Fn; readCSV: Fn; validateSalesCSV: Fn; mergeSales: Fn; validateProductsCSV: Fn; toStored: Fn;
  planProductImport: Fn; applyProductPlan: Fn; hashData: Fn; validateData: Fn; buildBackup: Fn; validateBackup: Fn;
  restoreData: Fn; DATA_KEYS: any;
};
export default Core;
