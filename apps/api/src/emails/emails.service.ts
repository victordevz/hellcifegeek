import { Injectable, Logger } from "@nestjs/common";
import { PaymentRecord, PartnerPurchaseItem } from "../domain";

type ResendPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

const resendApiUrl = "https://api.resend.com/emails";

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);

  async sendPurchaseCreatedEmail(payment: PaymentRecord) {
    await this.sendEmail({
      to: payment.userEmail,
      subject: "Recebemos seu pedido na Hellcife Geek",
      text: [
        "Recebemos seu pedido na Hellcife Geek.",
        `Total: ${this.formatCents(payment.totalCents)}.`,
        `Hellpoints previstos após aprovação do pagamento: ${payment.cashback}.`,
        "Finalize o pagamento Pix para liberar a separação do pedido."
      ].join("\n"),
      html: this.layout("Recebemos seu pedido", `
        <p>Seu pedido foi criado na Hellcife Geek.</p>
        <p><strong>Total:</strong> ${this.formatCents(payment.totalCents)}</p>
        <p><strong>Hellpoints previstos:</strong> ${payment.cashback} após a aprovação do pagamento.</p>
        <p>Finalize o pagamento Pix para liberar a separação do pedido.</p>
        ${this.itemsHtml(payment.items)}
      `)
    });
  }

  async sendAbandonedCartReminder(input: {
    userEmail: string;
    userName?: string;
    subtotalCents: number;
    items: PartnerPurchaseItem[];
  }) {
    const appUrl = process.env.APP_PUBLIC_URL ?? process.env.WEB_PUBLIC_URL ?? "https://hellcifegeek.com.br";

    await this.sendEmail({
      to: input.userEmail,
      subject: "Seu carrinho Hellcife Geek ainda está separado",
      text: [
        `Oi ${input.userName || "geek"}, seu carrinho ainda está te esperando.`,
        `Subtotal: ${this.formatCents(input.subtotalCents)}.`,
        "Volte para finalizar sua super compra antes que o estoque acabe.",
        appUrl
      ].join("\n"),
      html: this.layout("Seu carrinho ficou te esperando", `
        <p>Oi ${this.escapeHtml(input.userName || "geek")}, vimos que você deixou uma super compra no carrinho.</p>
        <p><strong>Subtotal:</strong> ${this.formatCents(input.subtotalCents)}</p>
        <p>Volte para finalizar antes que o estoque acabe.</p>
        ${this.itemsHtml(input.items)}
        <p><a href="${this.escapeHtml(appUrl)}">Voltar para a loja</a></p>
      `)
    });
  }

  async sendPaymentApprovedAdminEmail(payment: PaymentRecord) {
    const adminEmail = process.env.RESEND_ADMIN_EMAIL;

    if (!adminEmail) {
      return;
    }

    await this.sendEmail({
      to: adminEmail,
      subject: "Pagamento concluído na Hellcife Geek",
      text: [
        "Pagamento concluído.",
        `Cliente: ${payment.userEmail}.`,
        `Total: ${this.formatCents(payment.totalCents)}.`,
        `Pedido: ${payment.id}.`
      ].join("\n"),
      html: this.layout("Pagamento concluído", `
        <p>Um pagamento Pix foi aprovado.</p>
        <p><strong>Cliente:</strong> ${this.escapeHtml(payment.userEmail)}</p>
        <p><strong>Total:</strong> ${this.formatCents(payment.totalCents)}</p>
        <p><strong>Pedido:</strong> ${this.escapeHtml(payment.id)}</p>
        ${this.itemsHtml(payment.items)}
      `)
    });
  }

  private async sendEmail(input: Omit<ResendPayload, "from">) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL ?? "Hellcife Geek <onboarding@resend.dev>";

    if (!apiKey) {
      this.logger.warn("RESEND_API_KEY não configurada. Email ignorado.");
      return;
    }

    const response = await fetch(resendApiUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ ...input, from })
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Erro desconhecido");
      this.logger.warn(`Falha ao enviar email Resend: ${error}`);
    }
  }

  private layout(title: string, body: string) {
    return `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
        <h1 style="font-size:28px">${this.escapeHtml(title)}</h1>
        ${body}
        <p style="margin-top:28px;color:#667085;font-size:13px">Hellcife Geek</p>
      </div>
    `;
  }

  private itemsHtml(items: PartnerPurchaseItem[]) {
    if (items.length === 0) {
      return "";
    }

    return `
      <ul>
        ${items.map((item) => (
          `<li>${item.quantity}x ${this.escapeHtml(item.name)} - ${this.formatCents(item.priceCents * item.quantity)}</li>`
        )).join("")}
      </ul>
    `;
  }

  private formatCents(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value / 100);
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
