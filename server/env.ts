import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..");

dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, "server", ".env") });
