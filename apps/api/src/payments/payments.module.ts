import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { EmailsModule } from "../emails/emails.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [StorageModule, AuthModule, EmailsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService]
})
export class PaymentsModule {}
