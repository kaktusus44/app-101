import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Download,
  ExternalLink,
  FileText,
  Share2,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { PageHeader } from "../components/PageHeader";
import { useProjects } from "../projects";
import {
  buildProjectDocument,
  type ProjectDocumentEvent,
  type ProjectDocumentInput,
} from "../projectDocumentPdf";

type LegalType = "individual" | "self_employed" | "ip" | "ooo";
type Details = {
  legalType: LegalType;
  fullName: string;
  birthDate: string;
  passport: string;
  issuedBy: string;
  issueDate: string;
  departmentCode: string;
  registrationAddress: string;
  inn: string;
  ogrn: string;
  actualAddress: string;
  bankName: string;
  bankAccount: string;
  bik: string;
  correspondentAccount: string;
};
type Contract = { number: string; date: string; customerDetails: string };
type DocType = "acceptance" | "ks2" | "balance" | "expenses" | "estimate";
type FinanceEvent = ProjectDocumentEvent;
type SavedDocument = {
  id: string;
  type: DocType;
  title: string;
  fileName: string;
  snapshot: ProjectDocumentInput;
  createdAt: string;
  createdBy: string;
};
const types: { id: DocType; title: string; description: string }[] = [
  {
    id: "acceptance",
    title: "Акт приёмки работ",
    description: "Подтверждает выполнение этапа работ и гарантирует оплату",
  },
  {
    id: "ks2",
    title: "Форма КС-2",
    description: "Акт о приёмке выполненных работ по форме КС-2",
  },
  {
    id: "balance",
    title: "Детализация баланса",
    description: "Движение денежных средств по проекту",
  },
  {
    id: "expenses",
    title: "Ведомость расходов по статье",
    description: "Детализация расходов проекта",
  },
  {
    id: "estimate",
    title: "Сводный сметный расчёт",
    description: "Смета проекта",
  },
];
const emptyDetails: Details = {
  legalType: "ooo",
  fullName: "",
  birthDate: "",
  passport: "",
  issuedBy: "",
  issueDate: "",
  departmentCode: "",
  registrationAddress: "",
  inn: "",
  ogrn: "",
  actualAddress: "",
  bankName: "",
  bankAccount: "",
  bik: "",
  correspondentAccount: "",
};

export function ProjectDocuments() {
  const { projectId = "" } = useParams();
  const { projects, loading: projectsLoading } = useProjects();
  const { user } = useAuth();
  const project = projects.find((item) => item.id === projectId);
  const [details, setDetails] = useState<Details>(() => ({
    ...emptyDetails,
    fullName: user?.organizationName || user?.name || "",
  }));
  const [contract, setContract] = useState<Contract>({ number: "", date: "", customerDetails: "" });
  const [editor, setEditor] = useState<"details" | "contract" | null>(null);
  const [type, setType] = useState<DocType | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [from, setFrom] = useState(() =>
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [events, setEvents] = useState<FinanceEvent[]>([]);
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfFileName, setPdfFileName] = useState("Документ.pdf");
  const [pdfError, setPdfError] = useState("");
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    Promise.all([
      api<{ events: FinanceEvent[] }>("/finance-events"),
      api<SavedDocument[]>(
        `/projects/${encodeURIComponent(projectId)}/documents`,
      ),
      api<Partial<Details>>("/document-settings"),
      api<Partial<Contract>>(`/projects/${encodeURIComponent(projectId)}/contract-settings`),
    ])
      .then(([finance, saved, savedDetails, savedContract]) => {
        setEvents(finance.events);
        setDocuments(saved);
        if (Object.keys(savedDetails).length) setDetails((current) => ({ ...current, ...savedDetails }));
        if (Object.keys(savedContract).length) setContract((current) => ({ ...current, ...savedContract }));
      })
      .catch(() => setEvents([]));
  }, [projectId]);
  const documentEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.projectId === projectId &&
          event.eventDate >= from &&
          event.eventDate <= to &&
          event.status === "confirmed",
      ),
    [events, projectId, from, to],
  );
  const canEdit = user?.role === "organization";
  if (projectsLoading)
    return (
      <main className="light-page">
        <div className="mobile-page">
          <p className="empty-state">Загрузка проекта…</p>
        </div>
      </main>
    );
  if (!project) return <Navigate to="/projects" replace />;
  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setPdfError("");
    try {
      if (editor === "details") {
        await api("/document-settings", { method: "PUT", body: JSON.stringify(details) });
      } else {
        await api(`/projects/${encodeURIComponent(projectId)}/contract-settings`, { method: "PUT", body: JSON.stringify(contract) });
      }
      setEditor(null);
    } catch (cause) {
      setPdfError(cause instanceof Error ? cause.message : "Не удалось сохранить настройки документов");
    } finally { setCreating(false); }
  }
  async function createDocument() {
    if (!type) return;
    setCreating(true);
    setPdfError("");
    try {
      const snapshot: ProjectDocumentInput = {
        type,
        project: {
          name: project!.name,
          customer: project!.customer,
          address: project!.address,
        },
        details,
        contract,
        events: documentEvents,
        from,
        to,
      };
      const blob = await generatePdf(buildProjectDocument(snapshot));
      const title = types.find((item) => item.id === type)?.title || "Документ";
      const saved = await api<{ id: string }>(
        `/projects/${encodeURIComponent(projectId)}/documents`,
        {
          method: "POST",
          body: JSON.stringify({ type, title, fileName, snapshot }),
        },
      );
      setDocuments((current) => [
        {
          id: saved.id,
          type,
          title,
          fileName,
          snapshot,
          createdAt: new Date().toISOString(),
          createdBy: user?.name || "",
        },
        ...current,
      ]);
      showBlob(blob, fileName);
    } catch {
      setPdfBlob(null);
      setPdfError(
        "Не удалось сформировать или сохранить PDF. Попробуйте ещё раз.",
      );
    } finally {
      setCreating(false);
    }
  }
  async function openSaved(document: SavedDocument) {
    setCreating(true);
    setPdfError("");
    try {
      setType(document.type);
      showBlob(
        await generatePdf(buildProjectDocument(document.snapshot)),
        document.fileName,
      );
    } catch {
      setPdfError("Не удалось открыть сохранённую версию документа");
    } finally {
      setCreating(false);
    }
  }
  function showBlob(blob: Blob, name: string) {
    setPdfBlob(blob);
    setPdfFileName(name);
    setPdfUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(blob);
    });
  }
  const fileName = type
    ? `${safeName(types.find((item) => item.id === type)?.title || "Документ")}_${safeName(project.name)}_${to.split("-").reverse().join("_")}.pdf`
    : "Документ.pdf";
  async function share() {
    if (!pdfBlob) return;
    const file = new File([pdfBlob], pdfFileName, { type: "application/pdf" });
    if (navigator.share && navigator.canShare?.({ files: [file] }))
      await navigator.share({
        title: types.find((item) => item.id === type)?.title,
        files: [file],
      });
    else download(pdfBlob, pdfFileName);
  }
  return (
    <main className="light-page">
      <div className="mobile-page project-documents-page">
        <PageHeader title="Документы" />
        <section className="documents-intro">
          <h2>Заполните данные для документов</h2>
          <p>
            Заполните реквизиты один раз — они будут автоматически подставляться
            в готовые документы.
          </p>
          <button onClick={() => canEdit && setEditor("details")}>
            <span className={isDetailsReady(details) ? "is-ready" : ""}>
              {isDetailsReady(details) ? <CheckCircle2 /> : <CircleAlert />}Мои
              реквизиты
            </span>
            <b>{isDetailsReady(details) ? "Изменить" : "Заполнить"}</b>
          </button>
          <button onClick={() => canEdit && setEditor("contract")}>
            <span
              className={contract.number && contract.date ? "is-ready" : ""}
            >
              {contract.number && contract.date ? (
                <CheckCircle2 />
              ) : (
                <CircleAlert />
              )}
              Параметры договора
            </span>
            <b>{contract.number && contract.date ? "Изменить" : "Заполнить"}</b>
          </button>
          <small>
            Реквизиты заказчика берутся из проекта:{" "}
            {project.customer || "заказчик не указан"}.
          </small>
        </section>
        <section className="document-builder">
          <button
            className="document-type-button"
            onClick={() => setTypeOpen(true)}
          >
            <span>
              <small>Документ</small>
              {type
                ? types.find((item) => item.id === type)?.title
                : "Выберите документ"}
            </span>
            <b>Выбрать</b>
          </button>
          {type && (
            <label className="document-period">
              <span>За период</span>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
              <i>—</i>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          )}
          <p>В документ попадут события проекта со статусом:</p>
          <ul>
            <li>
              <CheckCircle2 />
              подтверждённые организацией
            </li>
            <li>
              <CheckCircle2 />
              принятые заказчиком
            </li>
            <li>
              <XCircle />
              отклонённые не учитываются
            </li>
          </ul>
          {type && (
            <button
              className="primary-button"
              onClick={createDocument}
              disabled={creating}
            >
              <FileText />
              {creating ? "Формируем PDF…" : "Создать документ"}
            </button>
          )}
        </section>
        {documents.length > 0 && (
          <section className="saved-documents">
            <h2>Созданные документы</h2>
            {documents.map((document) => (
              <button key={document.id} onClick={() => void openSaved(document)}>
                <FileText />
                <span>
                  <strong>{document.title}</strong>
                  <small>
                    {new Date(document.createdAt).toLocaleString("ru-RU")} · {document.createdBy}
                  </small>
                </span>
                <ChevronRight />
              </button>
            ))}
          </section>
        )}
        {typeOpen && (
          <div className="sheet-backdrop" onClick={() => setTypeOpen(false)}>
            <section
              className="document-type-sheet"
              onClick={(event) => event.stopPropagation()}
            >
              <header>
                <button onClick={() => setTypeOpen(false)}>Отменить</button>
                <h2>Документ</h2>
                <span />
              </header>
              {types.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setType(item.id);
                    setTypeOpen(false);
                  }}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <ChevronRight />
                </button>
              ))}
            </section>
          </div>
        )}
        {editor && (
          <div className="sheet-backdrop">
            <form className="document-settings" onSubmit={saveSettings}>
              <PageHeader
                title={
                  editor === "details" ? "Реквизиты" : "Параметры договора"
                }
                onBack={() => setEditor(null)}
              />
              {editor === "details" ? (
                <DetailsFields value={details} onChange={setDetails} />
              ) : (
                <>
                  <input
                    placeholder="Номер договора"
                    value={contract.number}
                    onChange={(e) =>
                      setContract({ ...contract, number: e.target.value })
                    }
                  />
                  <input
                    type="date"
                    aria-label="Дата договора"
                    value={contract.date}
                    onChange={(e) =>
                      setContract({ ...contract, date: e.target.value })
                    }
                  />
                  <textarea
                    placeholder="Дополнительные реквизиты заказчика"
                    value={contract.customerDetails}
                    onChange={(e) =>
                      setContract({
                        ...contract,
                        customerDetails: e.target.value,
                      })
                    }
                  />
                </>
              )}
              <button className="primary-button">Сохранить</button>
            </form>
          </div>
        )}
        {pdfUrl && (
          <div className="sheet-backdrop document-preview-backdrop">
            <section className="document-preview">
              <header>
                <h2>{types.find((item) => item.id === type)?.title}</h2>
                <button
                  className="icon-button"
                  onClick={() => {
                    URL.revokeObjectURL(pdfUrl);
                    setPdfUrl("");
                    setPdfBlob(null);
                  }}
                  aria-label="Закрыть"
                >
                  <X />
                </button>
              </header>
              <iframe title="Предпросмотр документа" src={pdfUrl} />
              <footer>
                <button onClick={() => pdfBlob && download(pdfBlob, pdfFileName)}>
                  <Download />
                  Скачать
                </button>
                <button onClick={share}>
                  <Share2 />
                  Поделиться
                </button>
              </footer>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
function DetailsFields({
  value,
  onChange,
}: {
  value: Details;
  onChange: (value: Details) => void;
}) {
  const set =
    (key: keyof Details) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...value, [key]: event.target.value });
  return (
    <>
      <select value={value.legalType} onChange={set("legalType")}>
        <option value="individual">Физическое лицо</option>
        <option value="self_employed">Самозанятый</option>
        <option value="ip">ИП</option>
        <option value="ooo">ООО</option>
      </select>
      <input
        placeholder={value.legalType === "ooo" ? "Наименование" : "ФИО"}
        value={value.fullName}
        onChange={set("fullName")}
      />
      {value.legalType === "individual" && (
        <>
          <input
            type="date"
            aria-label="Дата рождения"
            value={value.birthDate}
            onChange={set("birthDate")}
          />
          <input
            placeholder="Серия и номер паспорта"
            value={value.passport}
            onChange={set("passport")}
          />
          <input
            placeholder="Кем выдан"
            value={value.issuedBy}
            onChange={set("issuedBy")}
          />
          <input
            type="date"
            aria-label="Когда выдан"
            value={value.issueDate}
            onChange={set("issueDate")}
          />
          <input
            placeholder="Код подразделения"
            value={value.departmentCode}
            onChange={set("departmentCode")}
          />
        </>
      )}
      {value.legalType !== "individual" && (
        <input
          placeholder={
            value.legalType === "ooo" ? "ИНН (10 цифр)" : "ИНН (12 цифр)"
          }
          value={value.inn}
          onChange={set("inn")}
        />
      )}{" "}
      {(value.legalType === "ip" || value.legalType === "ooo") && (
        <input
          placeholder="ОГРН / ОГРНИП"
          value={value.ogrn}
          onChange={set("ogrn")}
        />
      )}
      <input
        placeholder="Адрес места регистрации"
        value={value.registrationAddress}
        onChange={set("registrationAddress")}
      />
      {value.legalType === "ooo" && (
        <input
          placeholder="Фактический адрес"
          value={value.actualAddress}
          onChange={set("actualAddress")}
        />
      )}
      <h2>Банковские реквизиты</h2>
      <input
        placeholder="Наименование банка"
        value={value.bankName}
        onChange={set("bankName")}
      />
      <input
        placeholder="Расчётный счёт (20 цифр)"
        value={value.bankAccount}
        onChange={set("bankAccount")}
      />
      <input
        placeholder="БИК (9 цифр)"
        value={value.bik}
        onChange={set("bik")}
      />
      <input
        placeholder="Корреспондентский счёт (20 цифр)"
        value={value.correspondentAccount}
        onChange={set("correspondentAccount")}
      />
    </>
  );
}
function isDetailsReady(value: Details) {
  return Boolean(
    value.fullName &&
      (value.legalType === "individual" || value.inn) &&
      value.registrationAddress,
  );
}
function safeName(value: string) {
  return value.trim().replace(/[^\p{L}\p{N}]+/gu, "_") || "Документ";
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function generatePdf(
  definition: import("pdfmake/interfaces").TDocumentDefinitions,
) {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.vfs = pdfFonts as unknown as Record<string, string>;
  return new Promise<Blob>((resolve) =>
    pdfMake.createPdf(definition).getBlob(resolve),
  );
}
