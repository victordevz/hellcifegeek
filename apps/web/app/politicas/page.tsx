"use client";

import { useRouter } from "next/navigation";

export default function PoliciesPage() {
  const router = useRouter();

  return (
    <main className="policiesPage">
      <header className="policiesTopbar">
        <a href="/">Hellcife Geek</a>
        <button type="button" onClick={() => router.push("/")}>Voltar para loja</button>
      </header>

      <section className="policiesHero">
        <span>Termos, privacidade e regras</span>
        <h1>Políticas Hellcife Geek</h1>
        <p>Última atualização: 27/05/2026</p>
      </section>

      <section className="policyBlock">
        <h2>Política de vendas, entrega e garantia</h2>
        <p>A Hellcife Geek atua como loja de produtos colecionáveis, importados e itens geek. A plataforma permite que o cliente manifeste interesse pelos produtos e inicie a compra, podendo receber o item pessoalmente para conferência antes da conclusão do pagamento.</p>
        <p>Quando o produto for apresentado presencialmente ao cliente antes da conclusão da venda e o pagamento for feito na entrega, a compra é tratada como concluída no ato da entrega, após conferência visual e aceite do cliente. Quando houver contratação efetiva exclusivamente online ou fora do estabelecimento, os direitos obrigatórios previstos no Código de Defesa do Consumidor permanecem preservados, inclusive o direito de arrependimento quando aplicável.</p>
        <p>Produtos duráveis possuem garantia legal de 90 dias contra vícios aparentes ou ocultos, conforme regras obrigatórias do Código de Defesa do Consumidor. A garantia cobre defeitos de fabricação ou problemas que comprometam o uso normal do produto, não cobrindo mau uso, dano acidental, desgaste natural, queda, contato com líquidos, modificações, armazenamento inadequado ou avarias causadas após a entrega.</p>
        <p>Em caso de problema, o cliente deve entrar em contato informando nome, produto, data da compra, descrição do ocorrido e imagens ou vídeos quando possível. A Hellcife Geek poderá avaliar o caso e, quando cabível, providenciar reparo, troca, abatimento proporcional ou devolução conforme a legislação aplicável.</p>
      </section>

      <section className="policyBlock">
        <h2>Política de parceria</h2>
        <p>Parceiros aprovados pela Hellcife Geek recebem um código de cupom vinculado ao seu cadastro. Cada venda concluída com o uso desse código gera ao parceiro o direito a 5% sobre o valor total vendido naquela compra, salvo campanha ou ajuste específico acordado por escrito.</p>
        <p>O pagamento do valor devido ao parceiro será realizado em até 15 dias para vendas pagas via Pix e em até 30 dias para vendas pagas no cartão, sempre após a confirmação da venda elegível. Esses prazos existem para conferência operacional, confirmação de pagamento, validação da origem da venda e revisão de eventuais cancelamentos, devoluções, chargebacks ou inconsistências.</p>
        <p>Quando a venda acontecer fora da plataforma, mas o cliente indicar expressamente que veio por meio da parceria, a venda também poderá contar para o parceiro. Nesses casos, a Hellcife Geek fará o lançamento manual da venda no painel de parceria, com base nas informações internas da venda concluída.</p>
        <p>O painel de parceria exibe compras, valores, categorias, filtros de período, valor estimado a receber e a informação explícita de que o prazo de pagamento é de até 15 dias no Pix e até 30 dias no cartão por venda elegível. Os dados podem passar por revisão operacional para corrigir cancelamentos, erros de lançamento, fraudes, devoluções, vendas não pagas ou informações incompletas.</p>
        <p>O parceiro não pode prometer condições comerciais não autorizadas pela Hellcife Geek, representar a loja como funcionário, alterar regras de sorteio, prometer estoque reservado sem confirmação ou usar o cupom de modo fraudulento. A parceria pode ser pausada ou encerrada em caso de abuso, fraude, conduta inadequada ou descumprimento destas regras.</p>
      </section>

      <section className="policyBlock">
        <h2>Política de sorteios e Hellpoints</h2>
        <p>Hellpoints são pontos promocionais da plataforma e podem ser usados para comprar tickets de participação em sorteios internos. Ao usar Hellpoints para comprar tickets, o usuário entende que não haverá reembolso dos Hellpoints utilizados.</p>
        <p>Cada ticket equivale a uma entrada no sorteio. Um ticket insere o nome do usuário uma vez. Dez tickets inserem o mesmo nome dez vezes, aumentando a quantidade de entradas daquele usuário no sorteio.</p>
        <p>A Hellcife Geek não opera o sistema técnico de randomização do sorteio. O sorteio será realizado por plataforma terceira, escolhida pela Hellcife Geek, e sempre que possível haverá live mostrando o processo do início ao fim, incluindo preparação, inserção dos participantes e resultado.</p>
        <p>A Hellcife Geek se responsabiliza por organizar a promoção, informar regras básicas, registrar participantes e entregar o prêmio anunciado ao ganhador elegível. A plataforma terceira é responsável pelo mecanismo técnico usado para sortear, e a Hellcife Geek não controla internamente o algoritmo ou infraestrutura desse fornecedor.</p>
      </section>

      <section className="policyBlock">
        <h2>Política de privacidade e comunicações</h2>
        <p>Ao criar uma conta, a Hellcife Geek coleta dados como nome, e-mail, telefone, histórico de uso, compras, tickets, Hellpoints, cupons e informações necessárias para autenticação, atendimento, entrega, prevenção a fraude e cumprimento de obrigações legais.</p>
        <p>O e-mail e o telefone podem ser usados para comunicações operacionais, como confirmação de cadastro, suporte, informações de compra, entrega, segurança, alterações de termos e avisos importantes da conta.</p>
        <p>Com o consentimento do usuário, a Hellcife Geek também poderá enviar comunicações promocionais semanais ou eventuais sobre ofertas, eventos, drops, sorteios, campanhas de parceiros e novidades atípicas. O usuário pode solicitar a interrupção dessas comunicações a qualquer momento pelos canais de atendimento da loja.</p>
        <p>A Hellcife Geek não vende dados pessoais. Dados podem ser compartilhados com fornecedores necessários para hospedagem, armazenamento, autenticação, atendimento, analytics, pagamentos, entregas, cumprimento legal ou proteção contra fraude, sempre de acordo com a finalidade aplicável.</p>
        <p>O usuário pode solicitar acesso, correção, exclusão, portabilidade, informações sobre uso dos dados e revogação de consentimentos, observadas as hipóteses legais de guarda obrigatória ou legítima.</p>
      </section>

      <section className="policyBlock">
        <h2>Aceite dos termos</h2>
        <p>Ao se cadastrar e usar a plataforma, o usuário declara que leu e concorda com estas políticas, incluindo política de vendas, regras de parceria, regras de sorteios, Hellpoints e política de privacidade. O aceite é registrado no cadastro para fins de controle operacional e auditoria.</p>
      </section>
    </main>
  );
}
