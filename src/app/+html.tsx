import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const APP_NAME = "Kelimelik AI";
const THEME_COLOR = "#BC5A2A";
const BACKGROUND_COLOR = "#F7F3EC";
const BASE_PATH = "/vocab-coach-ai";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="application-name" content={APP_NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta
          name="description"
          content="Ezberleme. AI ile kullanmayı öğren."
        />
        <link rel="apple-touch-icon" href={`${BASE_PATH}/assets/images/icon.png`} />
        <ScrollViewStyleReset />
      </head>
      <body style={{ backgroundColor: BACKGROUND_COLOR }}>{children}</body>
    </html>
  );
}
