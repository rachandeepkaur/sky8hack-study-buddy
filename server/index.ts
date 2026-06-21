import "./env.js";
import { app } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);

app.listen(PORT, () => {
  console.log(`[server] Loop API on http://localhost:${PORT}`);
});
