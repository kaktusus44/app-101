import {
  CircleMinus,
  CirclePlus,
  CircleUserRound,
  QrCode,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const eventItems = [
  { type: "receipt", label: "Поступление", icon: CirclePlus, qr: false },
  { type: "report", label: "Отчёт", icon: CircleMinus, qr: true },
  { type: "transfer", label: "Перевод", icon: CircleUserRound, qr: false },
  { type: "estimate", label: "Смета", icon: CircleMinus, qr: false },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  returnTo: string;
  projectId?: string;
  counterpartyId?: string;
};

export function EventCreateMenu({
  open,
  onClose,
  returnTo,
  projectId = "",
  counterpartyId = "me",
}: Props) {
  const navigate = useNavigate();
  if (!open) return null;
  const openEvent = (type: string) => {
    onClose();
    navigate(
      `/counterparties/${encodeURIComponent(counterpartyId)}/events/new/${type}`,
      { state: { returnTo, projectId } },
    );
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="event-sheet"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
      >
        <div className="sheet-heading">
          <h2>Добавить событие</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X />
          </button>
        </div>
        {eventItems.map(({ type, label, icon: Icon, qr }) => (
          <div className="event-row" key={type}>
            <button className="event-action" onClick={() => openEvent(type)}>
              <Icon size={23} />
              {label}
            </button>
            {qr && (
              <button
                className="qr-button"
                onClick={() => openEvent("report")}
                aria-label="Сканировать QR-код"
              >
                <QrCode />
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
