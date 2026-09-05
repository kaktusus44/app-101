import { useState } from "react";
import { ExternalLink, Smartphone } from "lucide-react";
import { PageHeader } from "../components/PageHeader";

export function PhotoAlbumHelp() {
  const [platform, setPlatform] = useState<"android" | "ios">("android");
  return (
    <main className="light-page">
      <div className="mobile-page album-help-page">
        <PageHeader title="Общий фотоальбом" />
        <p className="album-help-lead">
          Фотографии хранятся в вашем облаке. В проекте сохраняется только
          ссылка, которую сможет открыть заказчик.
        </p>
        <div className="album-platform-tabs">
          <button
            className={platform === "android" ? "is-active" : ""}
            onClick={() => setPlatform("android")}
          >
            Android
          </button>
          <button
            className={platform === "ios" ? "is-active" : ""}
            onClick={() => setPlatform("ios")}
          >
            iPhone / iPad
          </button>
        </div>
        {platform === "android" ? (
          <section className="album-help-card">
            <Smartphone />
            <h2>Google Фото</h2>
            <ol>
              <li>Откройте Google Фото и создайте новый общий альбом.</li>
              <li>Добавьте первые фотографии и нажмите «Поделиться».</li>
              <li>
                Включите совместное редактирование, если другие участники должны
                добавлять фотографии.
              </li>
              <li>Выберите «Получить ссылку» и скопируйте её.</li>
              <li>
                Вернитесь в редактирование проекта и вставьте ссылку в поле
                фотоальбома.
              </li>
            </ol>
            <a
              href="https://support.google.com/photos/answer/6128849"
              target="_blank"
              rel="noreferrer"
            >
              Подробная инструкция <ExternalLink />
            </a>
          </section>
        ) : (
          <section className="album-help-card">
            <Smartphone />
            <h2>Общие альбомы iCloud</h2>
            <ol>
              <li>В настройках iCloud → Фото включите «Общие альбомы».</li>
              <li>В приложении «Фото» создайте новый общий альбом.</li>
              <li>При необходимости пригласите заказчика по его Apple ID.</li>
              <li>
                На вкладке «Люди» включите «Публичный сайт» и скопируйте ссылку.
              </li>
              <li>
                Вернитесь в редактирование проекта и вставьте ссылку в поле
                фотоальбома.
              </li>
            </ol>
            <p>
              На Android публичный альбом iCloud можно просматривать, но
              добавлять фотографии через него нельзя.
            </p>
            <a
              href="https://support.apple.com/guide/iphone/share-photos-and-videos-iphf28f17237/ios"
              target="_blank"
              rel="noreferrer"
            >
              Подробная инструкция <ExternalLink />
            </a>
          </section>
        )}
        <aside className="album-help-note">
          <strong>Важно</strong>
          <span>
            Не удаляйте альбом и не отключайте доступ к нему, пока проект
            активен. Иначе ссылка перестанет работать у заказчика.
          </span>
        </aside>
      </div>
    </main>
  );
}
