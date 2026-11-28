import type { AdminRestaurantAnalytics } from '@akeela/portal/models';

export type ExcelCellValue = string | number | null | undefined;
export interface ExcelRow {
  cells: ExcelCellValue[];
  style?: 'normal' | 'header' | 'title' | 'total';
}
export interface ExcelSheet {
  name: string;
  columns: number[];
  rows: ExcelRow[];
}

const encoder = new TextEncoder();

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnLetter(index: number): string {
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (cleaned || 'Sheet').slice(0, 31);
}

// Style indices matching styles.xml below:
// 0 = default text, 1 = header, 2 = title, 3 = total text, 4 = money/decimal, 5 = total money/decimal, 6 = integer, 7 = total integer
function cellStyleIndex(
  rowStyle: ExcelRow['style'],
  isNumber: boolean,
  isInt: boolean,
): number {
  if (rowStyle === 'header') return 1;
  if (rowStyle === 'title') return 2;
  if (rowStyle === 'total') {
    if (!isNumber) return 3;
    return isInt ? 7 : 5;
  }
  if (!isNumber) return 0;
  return isInt ? 6 : 4;
}

function buildWorksheetXml(sheet: ExcelSheet): string {
  const colsXml = sheet.columns
    .map(
      (width, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`,
    )
    .join('');

  const rowsXml = sheet.rows
    .map((row, rowIndex) => {
      const rNum = rowIndex + 1;
      const heightAttr =
        row.style === 'title'
          ? ' ht="26" customHeight="1"'
          : row.style === 'header'
            ? ' ht="24" customHeight="1"'
            : row.style === 'total'
              ? ' ht="22" customHeight="1"'
              : '';
      const cellsXml = row.cells
        .map((raw, colIndex) => {
          const ref = `${columnLetter(colIndex)}${rNum}`;
          if (raw === null || raw === undefined || raw === '') {
            const s = cellStyleIndex(row.style, false, false);
            return `<c r="${ref}" s="${s}"/>`;
          }
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            const isInt = Number.isInteger(raw);
            const s = cellStyleIndex(row.style, true, isInt);
            return `<c r="${ref}" s="${s}"><v>${raw}</v></c>`;
          }
          const s = cellStyleIndex(row.style, false, false);
          return `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${escapeXml(String(raw))}</t></is></c>`;
        })
        .join('');
      return `<row r="${rNum}"${heightAttr}>${cellsXml}</row>`;
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="20"/>' +
    `<cols>${colsXml}</cols>` +
    `<sheetData>${rowsXml}</sheetData>` +
    '</worksheet>'
  );
}

function buildStylesXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2">' +
    '<numFmt numFmtId="164" formatCode="#,##0.00"/>' +
    '<numFmt numFmtId="165" formatCode="#,##0"/>' +
    '</numFmts>' +
    '<fonts count="4">' +
    '<font><sz val="11"/><color rgb="FF132A26"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="13"/><color rgb="FF114B3C"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FF114B3C"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="5">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF114B3C"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEAF5F0"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF4F6F5"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="2">' +
    '<border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border>' +
    '<left style="thin"><color rgb="FFD8E2DE"/></left>' +
    '<right style="thin"><color rgb="FFD8E2DE"/></right>' +
    '<top style="thin"><color rgb="FFD8E2DE"/></top>' +
    '<bottom style="thin"><color rgb="FFD8E2DE"/></bottom>' +
    '<diagonal/>' +
    '</border>' +
    '</borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="8">' +
    // 0: default text
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
    // 1: header
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    // 2: title
    '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
    // 3: total label
    '<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
    // 4: money/decimal
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    // 5: total money/decimal
    '<xf numFmtId="164" fontId="3" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    // 6: integer
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    // 7: total integer
    '<xf numFmtId="165" fontId="3" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '</cellXfs>' +
    '</styleSheet>'
  );
}

// Precomputed CRC-32 table for ZIP archive entries
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const entries = files.map((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    return {
      nameBytes,
      dataBytes,
      crc: crc32(dataBytes),
      offset: 0,
    };
  });

  let localSize = 0;
  for (const entry of entries) {
    entry.offset = localSize;
    localSize += 30 + entry.nameBytes.length + entry.dataBytes.length;
  }

  let centralSize = 0;
  for (const entry of entries) {
    centralSize += 46 + entry.nameBytes.length;
  }

  const totalSize = localSize + centralSize + 22;
  const output = new Uint8Array(totalSize);
  const view = new DataView(output.buffer);

  let pos = 0;
  for (const entry of entries) {
    view.setUint32(pos, 0x04034b50, true); // Local file header signature
    view.setUint16(pos + 4, 20, true); // Version needed
    view.setUint16(pos + 6, 0x0800, true); // UTF-8 flag
    view.setUint16(pos + 8, 0, true); // Compression: store
    view.setUint16(pos + 10, 0, true); // Mod time
    view.setUint16(pos + 12, 0, true); // Mod date
    view.setUint32(pos + 14, entry.crc, true);
    view.setUint32(pos + 18, entry.dataBytes.length, true);
    view.setUint32(pos + 22, entry.dataBytes.length, true);
    view.setUint16(pos + 26, entry.nameBytes.length, true);
    view.setUint16(pos + 28, 0, true);
    pos += 30;
    output.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;
    output.set(entry.dataBytes, pos);
    pos += entry.dataBytes.length;
  }

  const centralOffset = pos;
  for (const entry of entries) {
    view.setUint32(pos, 0x02014b50, true); // Central directory signature
    view.setUint16(pos + 4, 20, true); // Version made by
    view.setUint16(pos + 6, 20, true); // Version needed
    view.setUint16(pos + 8, 0x0800, true); // UTF-8 flag
    view.setUint16(pos + 10, 0, true); // Store
    view.setUint16(pos + 12, 0, true);
    view.setUint16(pos + 14, 0, true);
    view.setUint32(pos + 16, entry.crc, true);
    view.setUint32(pos + 20, entry.dataBytes.length, true);
    view.setUint32(pos + 24, entry.dataBytes.length, true);
    view.setUint16(pos + 28, entry.nameBytes.length, true);
    view.setUint16(pos + 30, 0, true);
    view.setUint16(pos + 32, 0, true);
    view.setUint16(pos + 34, 0, true);
    view.setUint16(pos + 36, 0, true);
    view.setUint32(pos + 38, 0, true);
    view.setUint32(pos + 42, entry.offset, true);
    pos += 46;
    output.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;
  }

  // End of central directory record
  view.setUint32(pos, 0x06054b50, true);
  view.setUint16(pos + 4, 0, true);
  view.setUint16(pos + 6, 0, true);
  view.setUint16(pos + 8, entries.length, true);
  view.setUint16(pos + 10, entries.length, true);
  view.setUint32(pos + 12, centralSize, true);
  view.setUint32(pos + 16, centralOffset, true);
  view.setUint16(pos + 20, 0, true);

  return output;
}

export function buildXlsxBytes(sheets: ExcelSheet[]): Uint8Array {
  const safeSheets = sheets.map((s) => ({
    ...s,
    name: sanitizeSheetName(s.name),
  }));

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    safeSheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    '</Types>';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbookXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' +
    safeSheets
      .map(
        (sheet, i) =>
          `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
      )
      .join('') +
    '</sheets>' +
    '</workbook>';

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    safeSheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    `<Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>';

  const files: Array<{ name: string; content: string }> = [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    { name: 'xl/styles.xml', content: buildStylesXml() },
    ...safeSheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      content: buildWorksheetXml(sheet),
    })),
  ];

  return buildZip(files);
}

function toNum(value: string | number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const generatedAtFormatter = new Intl.DateTimeFormat('ar-EG', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Cairo',
});

export function buildRestaurantEarningsWorkbook({
  restId,
  restTitle,
  ownerName,
  periodLabel,
  analytics,
}: {
  restId: string;
  restTitle: string;
  ownerName: string;
  periodLabel: string;
  analytics: AdminRestaurantAnalytics;
}): Uint8Array {
  const kpis = analytics.kpis;
  const generatedAt = generatedAtFormatter.format(
    new Date(analytics.generated_at),
  );

  const summarySheet: ExcelSheet = {
    name: 'ملخص المكاسب',
    columns: [34, 24],
    rows: [
      { cells: [`تقرير مكاسب المطعم — ${restTitle}`, ''], style: 'title' },
      { cells: ['البند', 'القيمة'], style: 'header' },
      { cells: ['رقم المطعم', `#${restId}`] },
      { cells: ['اسم المطعم', restTitle] },
      { cells: ['اسم المالك', ownerName] },
      { cells: ['الفترة الزمنية', periodLabel] },
      { cells: ['تاريخ إنشاء التقرير (القاهرة)', generatedAt] },
      { cells: ['صافي مبيعات الطعام (ج.م)', toNum(kpis.food_revenue)] },
      { cells: ['إجمالي رسوم التوصيل (ج.م)', toNum(kpis.delivery_fees_total)] },
      { cells: ['إجمالي المبيعات GMV (ج.م)', toNum(kpis.gross_gmv)] },
      { cells: ['إيرادات الإضافات (ج.م)', toNum(kpis.addons_revenue)] },
      { cells: ['متوسط قيمة الطلب (ج.م)', toNum(kpis.avg_order_value)] },
      { cells: ['إجمالي الطلبات', kpis.total_orders] },
      { cells: ['الطلبات المسلّمة', kpis.delivered_orders] },
      { cells: ['الطلبات المرفوضة', kpis.rejected_orders] },
      { cells: ['الطلبات الملغاة', kpis.cancelled_orders] },
      { cells: ['نسبة الإتمام (%)', kpis.completion_rate] },
      { cells: ['نسبة القبول (%)', kpis.acceptance_rate] },
      { cells: ['العملاء الفريدون', kpis.unique_customers] },
      { cells: ['العملاء المتكررون', kpis.repeat_customers] },
    ],
  };

  let totalOrders = 0;
  let totalDelivered = 0;
  let totalFood = 0;
  let totalDelivery = 0;
  let totalGmv = 0;

  const dailyRows: ExcelRow[] = [
    {
      cells: [
        `التفصيل اليومي للمكاسب — ${restTitle} (${periodLabel})`,
        '',
        '',
        '',
        '',
        '',
      ],
      style: 'title',
    },
    {
      cells: [
        'التاريخ',
        'إجمالي الطلبات',
        'الطلبات المسلّمة',
        'صافي مبيعات الطعام (ج.م)',
        'رسوم التوصيل (ج.م)',
        'إجمالي المبيعات (ج.م)',
      ],
      style: 'header',
    },
  ];

  for (const point of analytics.daily_series) {
    const food = toNum(point.food_revenue);
    const fees = toNum(point.delivery_fees);
    const gmv = toNum(point.gross_gmv);
    totalOrders += point.orders;
    totalDelivered += point.delivered;
    totalFood += food;
    totalDelivery += fees;
    totalGmv += gmv;
    dailyRows.push({
      cells: [point.date, point.orders, point.delivered, food, fees, gmv],
    });
  }

  dailyRows.push({
    cells: [
      'الإجمالي',
      totalOrders,
      totalDelivered,
      Math.round(totalFood * 100) / 100,
      Math.round(totalDelivery * 100) / 100,
      Math.round(totalGmv * 100) / 100,
    ],
    style: 'total',
  });

  const dailySheet: ExcelSheet = {
    name: 'التفصيل اليومي',
    columns: [16, 16, 18, 24, 20, 22],
    rows: dailyRows,
  };

  const itemsRows: ExcelRow[] = [
    {
      cells: [
        `أكثر الأصناف مبيعاً — ${restTitle} (${periodLabel})`,
        '',
        '',
        '',
        '',
      ],
      style: 'title',
    },
    {
      cells: [
        'الصنف',
        'النوع',
        'الكمية المباعة',
        'الإيرادات (ج.م)',
        'الحصة (%)',
      ],
      style: 'header',
    },
    ...analytics.top_items.map((item) => ({
      cells: [
        item.item_name,
        item.item_type === 'offer' ? 'عرض' : 'منتج',
        item.units_sold,
        toNum(item.revenue),
        item.share_pct,
      ],
    })),
  ];

  const itemsSheet: ExcelSheet = {
    name: 'أكثر الأصناف مبيعاً',
    columns: [30, 14, 16, 20, 14],
    rows: itemsRows,
  };

  return buildXlsxBytes([summarySheet, dailySheet, itemsSheet]);
}

export function downloadRestaurantEarningsExcel(params: {
  restId: string;
  restTitle: string;
  ownerName: string;
  periodLabel: string;
  periodSlug: string;
  analytics: AdminRestaurantAnalytics;
}) {
  const bytes = buildRestaurantEarningsWorkbook(params);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `akeela-restaurant-${params.restId}-earnings-${params.periodSlug}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
