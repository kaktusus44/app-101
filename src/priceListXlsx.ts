import type { PriceItem, PriceList } from "./pricing";

export async function exportPriceListXlsx(list: PriceList) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "199";
  const positions = workbook.addWorksheet("Позиции");
  positions.columns = [
    { header: "Наименование", key: "name", width: 42 },
    { header: "Единица измерения", key: "unit", width: 20 },
    { header: "Себестоимость", key: "cost", width: 18 },
    { header: "Цена", key: "price", width: 18 },
  ];
  list.items.forEach((item) => positions.addRow(item));
  styleHeader(positions);
  const categories = workbook.addWorksheet("Категории");
  categories.columns = [{ header: "Категории", key: "name", width: 42 }];
  list.categories.forEach((item) => categories.addRow(item));
  styleHeader(categories);
  const templates = workbook.addWorksheet("Шаблоны");
  templates.columns = [{ header: "Шаблоны", key: "name", width: 42 }];
  list.templates.forEach((item) => templates.addRow(item));
  styleHeader(templates);
  download(
    await workbook.xlsx.writeBuffer(),
    `${safeFilename(list.name)}.xlsx`,
  );
}

export async function importPriceListXlsx(
  file: File,
): Promise<Omit<PriceItem, "id">[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("В книге нет листов");
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, index) =>
    headers.set(
      String(cell.value ?? "")
        .trim()
        .toLocaleLowerCase("ru-RU"),
      index,
    ),
  );
  const column = (names: string[]) =>
    names
      .map((name) => headers.get(name.toLocaleLowerCase("ru-RU")))
      .find(Boolean);
  const nameColumn = column(["Наименование", "Название", "name"]);
  const unitColumn = column([
    "Единица измерения",
    "Ед. изм.",
    "Единица",
    "unit",
  ]);
  const costColumn = column(["Себестоимость", "cost"]);
  const priceColumn = column(["Цена", "price"]);
  if (!nameColumn) throw new Error("Не найдена колонка «Наименование»");
  const items: Omit<PriceItem, "id">[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row.getCell(nameColumn));
    if (!name) return;
    items.push({
      name,
      unit: unitColumn ? cellText(row.getCell(unitColumn)) || "шт." : "шт.",
      cost: costColumn ? cellAmount(row.getCell(costColumn)) : 0,
      price: priceColumn ? cellAmount(row.getCell(priceColumn)) : 0,
    });
  });
  if (!items.length) throw new Error("В файле нет заполненных позиций");
  return items;
}

function styleHeader(sheet: import("exceljs").Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF168DDF" },
  };
  row.height = 24;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, sheet.columnCount) },
  };
}
function cellText(cell: import("exceljs").Cell) {
  const value = cell.value;
  if (value && typeof value === "object" && "result" in value)
    return String(value.result ?? "").trim();
  if (value && typeof value === "object" && "text" in value)
    return String(value.text ?? "").trim();
  return String(value ?? "").trim();
}
function cellAmount(cell: import("exceljs").Cell) {
  const parsed = Number(cellText(cell).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
function download(data: import("exceljs").Buffer, name: string) {
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "Прайс-лист";
}
