import {
  Copy,
  Ellipsis,
  FileDown,
  FileUp,
  Pencil,
  Share2,
  Table2,
  Trash2,
} from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { PageHeader } from "../components/PageHeader";
import { usePricing } from "../pricing";
import { exportPriceListXlsx, importPriceListXlsx } from "../priceListXlsx";
import { exportPriceListPdf } from "./PriceListDetails";

export function PriceLists() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    priceLists,
    renamePriceList,
    duplicatePriceList,
    deletePriceList,
    importItems,
  } = usePricing();
  const canEdit = user?.role === "organization";
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [importTarget, setImportTarget] = useState("");
  const importInput = useRef<HTMLInputElement>(null);

  function rename(id: string, current: string) {
    const name = window.prompt("Новое название прайс-листа", current)?.trim();
    if (name) renamePriceList(id, name);
    setOpenMenu(null);
  }
  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !importTarget) return;
    try {
      const items = await importPriceListXlsx(file);
      importItems(importTarget, items);
      setNotice(`Импортировано позиций: ${items.length}`);
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Не удалось прочитать XLSX",
      );
    } finally {
      setImportTarget("");
    }
  }

  return (
    <main className="light-page">
      <div className="mobile-page price-lists-page">
        <PageHeader title="Прайс-листы" />
        <input
          ref={importInput}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={handleImport}
        />
        <section className="price-intro">
          <Table2 size={56} />
          <h2>Прайс-листы</h2>
          <p>
            • Прайс-лист упрощает управление ценами и снижает риск ошибок в
            отчётах.
          </p>
          <p>• Используйте разные прайс-листы для проектов.</p>
          <p>
            • Создавайте прайс-листы с подкатегориями для группировки позиций.
          </p>
        </section>
        {notice && (
          <p className="inline-notice" role="status">
            {notice}
          </p>
        )}
        <section className="price-list-stack">
          {priceLists.map((list) => (
            <article className="price-list-row" key={list.id}>
              <button
                className="price-list-main"
                onClick={() => navigate(`/price-lists/${list.id}`)}
              >
                <strong>{list.name}</strong>
                <span>
                  {list.categories.length} категорий, {list.templates.length}{" "}
                  шаблонов, {list.items.length} позиций
                </span>
              </button>
              {canEdit && (
                <button
                  className="dots-button"
                  onClick={() =>
                    setOpenMenu(openMenu === list.id ? null : list.id)
                  }
                  aria-label={`Действия с прайс-листом ${list.name}`}
                >
                  <Ellipsis />
                </button>
              )}
              {openMenu === list.id && (
                <div className="context-menu">
                  <button onClick={() => rename(list.id, list.name)}>
                    <Pencil />
                    Переименовать
                  </button>
                  <button
                    onClick={() => {
                      duplicatePriceList(list.id);
                      setOpenMenu(null);
                    }}
                  >
                    <Copy />
                    Дублировать
                  </button>
                  <button onClick={() => { exportPriceListPdf(list, "customer"); setOpenMenu(null); }}>
                    <Share2 />
                    PDF для заказчика
                  </button>
                  <button
                    onClick={() => {
                      void exportPriceListXlsx(list);
                      setOpenMenu(null);
                    }}
                  >
                    <FileDown />
                    Экспортировать в XLSX
                  </button>
                  <button
                    onClick={() => {
                      setImportTarget(list.id);
                      setOpenMenu(null);
                      window.setTimeout(() => importInput.current?.click(), 0);
                    }}
                  >
                    <FileUp />
                    Импортировать из XLSX
                  </button>
                  <button
                    className="danger-action"
                    onClick={() => {
                      if (window.confirm(`Удалить прайс-лист «${list.name}»?`))
                        deletePriceList(list.id);
                      setOpenMenu(null);
                    }}
                  >
                    <Trash2 />
                    Удалить
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
        {canEdit && (
          <button
            className="primary-button sticky-action"
            onClick={() => navigate("/price-lists/new")}
          >
            Добавить прайс-лист
          </button>
        )}
      </div>
    </main>
  );
}
