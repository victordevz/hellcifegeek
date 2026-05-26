import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { AppController } from "./app.controller";
import { ProductsModule } from "./products/products.module";
import { StorageModule } from "./storage/storage.module";
import { UploadsModule } from "./uploads/uploads.module";

@Module({
  imports: [StorageModule, AuthModule, CategoriesModule, ProductsModule, UploadsModule],
  controllers: [AppController]
})
export class AppModule {}
