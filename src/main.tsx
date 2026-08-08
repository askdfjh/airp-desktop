import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initRuntimeLog } from "@/lib/appLog";

// 尽早挂载全局错误/未捕获 Promise 捕获，抓取未 try-catch 的静默失败（StrictMode 防重）
initRuntimeLog();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
