import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/base.css";
import "./styles.css";
import App from "./App.jsx";
import { readBootstrap } from "./api.js";

const boot = readBootstrap();
const el = document.getElementById("model-map-root");
createRoot(el).render(<App boot={boot} />);
