import { Module } from "@nestjs/common";
import { JsonStoreService } from "./json-store.service";

@Module({
  providers: [JsonStoreService],
  exports: [JsonStoreService]
})
export class StorageModule {}
