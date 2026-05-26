import { Injectable, OnModuleInit } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Database } from "../domain";
import { seedDatabase } from "./seed-database";

const emptyDatabase = (): Database => ({
  users: [],
  categories: [],
  products: []
});

@Injectable()
export class JsonStoreService implements OnModuleInit {
  private readonly filePath = process.env.API_DB_PATH ?? join(process.cwd(), "data", "db.json");
  private data: Database = emptyDatabase();
  private ready: Promise<void> | null = null;

  async onModuleInit() {
    await this.load();
  }

  async read() {
    await this.ensureReady();
    return structuredClone(this.data);
  }

  async write(nextData: Database) {
    await this.ensureReady();
    this.data = structuredClone(nextData);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`, "utf8");
    return structuredClone(this.data);
  }

  private async ensureReady() {
    if (!this.ready) {
      this.ready = this.load();
    }

    await this.ready;
  }

  private async load() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.data = JSON.parse(raw) as Database;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== "ENOENT") {
        throw error;
      }

      this.data = structuredClone(seedDatabase);
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`, "utf8");
    }
  }
}
