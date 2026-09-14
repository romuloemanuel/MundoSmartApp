using System.Text.RegularExpressions;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Config;

public static class DocumentoChave
{
    private static readonly Regex Invalido = new("[^a-z0-9_]", RegexOptions.CultureInvariant);

    public static string Normalizar(string? chave)
    {
        var c = (chave ?? "").Trim().ToLowerInvariant().Replace(' ', '_');
        c = Invalido.Replace(c, "");
        if (c.Length > 40) c = c[..40];
        return c;
    }

    public static bool EhValida(string? chave)
    {
        var c = Normalizar(chave);
        return c.Length >= 2 && char.IsLetter(c[0]);
    }
}

public static class DocumentoModeloSeed
{
    /// <summary>Modelos oficiais regravados no seed (texto jurídico da loja).</summary>
    public static readonly string[] CodigosSincronizar = ["contrato-compra-venda", "contrato-venda", "termo-conscientizacao"];

    public static readonly (string Chave, string Rotulo, string Tipo)[] Variaveis =
    [
        ("compradora_razao_social", "Razão social da compradora (loja)", "texto"),
        ("compradora_cnpj", "CNPJ da compradora", "cnpj"),
        ("compradora_endereco", "Endereço da compradora (loja, fixo)", "texto"),
        ("compradora_representante", "Representante da loja", "texto"),
        ("compradora_representante_cargo", "Cargo do representante", "texto"),
        ("compradora_representante_cpf", "CPF do representante", "cpf"),
        ("vendedora_nome", "Nome do vendedor(a) (cliente)", "texto"),
        ("vendedora_cpf", "CPF ou CNPJ do vendedor(a)", "cpf"),
        ("vendedora_endereco", "Endereço do vendedor(a)", "endereco"),
        ("vendedora_telefone", "Telefone do vendedor(a)", "telefone"),
        ("vendedor_nome", "Nome do vendedor(a) / loja", "texto"),
        ("vendedor_cnpj", "CNPJ do vendedor(a)", "cnpj"),
        ("vendedor_endereco", "Endereço da loja (fixo)", "texto"),
        ("vendedor_telefone", "Telefone do vendedor(a)", "telefone"),
        ("comprador_nome", "Nome do comprador(a) (cliente)", "texto"),
        ("comprador_cpf", "CPF ou CNPJ do comprador(a)", "cpf"),
        ("comprador_rg", "RG do comprador", "texto"),
        ("comprador_endereco", "Endereço do comprador(a)", "endereco"),
        ("comprador_telefone", "Telefone do comprador(a)", "telefone"),
        ("aparelho_marca", "Marca do aparelho", "texto"),
        ("aparelho_modelo", "Modelo do aparelho", "texto"),
        ("aparelho_cor", "Cor do aparelho", "texto"),
        ("aparelho_capacidade", "Capacidade (ex.: 128GB)", "texto"),
        ("aparelho_imei", "IMEI / serial", "imei"),
        ("acessorios", "Acessórios entregues", "texto"),
        ("estado_aparelho", "Estado de conservação", "texto"),
        ("valor", "Valor", "moeda"),
        ("valor_extenso", "Valor por extenso", "texto"),
        ("forma_pagamento", "Forma de pagamento", "texto"),
        ("garantia_clausula_6_meses", "Garantia estendida (um item)", "texto"),
        ("cidade", "Cidade", "texto"),
        ("foro", "Foro / comarca", "texto"),
        ("data", "Data e hora", "data_hora"),
        ("observacoes", "Observações", "paragrafo"),
    ];

    public static IReadOnlyList<DocumentoModeloData> Modelos() =>
    [
        new DocumentoModeloData
        {
            Codigo = "contrato-compra-venda",
            Tipo = DocumentoTipos.Contrato,
            Titulo = "Contrato de compra de celular seminovo",
            Ordem = 1,
            Ativo = true,
            ImprimirDuasVias = true,
            Variaveis = Vars(
                "compradora_razao_social", "compradora_cnpj", "compradora_endereco",
                "compradora_representante", "compradora_representante_cargo", "compradora_representante_cpf",
                "vendedora_nome", "vendedora_cpf", "vendedora_endereco", "vendedora_telefone",
                "aparelho_marca", "aparelho_modelo", "aparelho_cor", "aparelho_capacidade",
                "aparelho_imei", "acessorios", "estado_aparelho",
                "valor", "forma_pagamento", "cidade", "foro", "data"),
            Corpo =
                "CONTRATO PARTICULAR DE COMPRA DE CELULAR SEMINOVO\n" +
                "COMPRADORA: {{compradora_razao_social}}, inscrito no CNPJ {{compradora_cnpj}}, " +
                "com sede na {{compradora_endereco}}, neste ato representado por {{compradora_representante}}, " +
                "{{compradora_representante_cargo}}, CPF: {{compradora_representante_cpf}}\n" +
                "VENDEDOR(A): {{vendedora_nome}}, inscrito(a) no CPF/CNPJ {{vendedora_cpf}}, residente na {{vendedora_endereco}}, " +
                "telefone número {{vendedora_telefone}}\n" +
                "1. OBJETO\n" +
                "1.1. O(A) VENDEDOR(A) vende à COMPRADORA o seguinte aparelho celular usado:\n" +
                "- Marca/Modelo: {{aparelho_marca}} {{aparelho_modelo}}\n" +
                "- Cor: {{aparelho_cor}}\n" +
                "- Capacidade: {{aparelho_capacidade}}\n" +
                "- IMEI/Serial: {{aparelho_imei}}\n" +
                "- Acessórios entregues: {{acessorios}}\n" +
                "1.2. O aparelho é entregue no estado em que se encontra, após vistoria e aceite da COMPRADORA.\n" +
                "2. ESTADO DO APARELHO\n" +
                "2.1. O(A) VENDEDOR(A) declara que o aparelho apresenta as seguintes condições, já conhecidas pela COMPRADORA: {{estado_aparelho}}.\n" +
                "2.2. A COMPRADORA declara ter examinado o aparelho e concordado com suas condições de uso, aparência e funcionamento.\n" +
                "3. ORIGEM E LEGITIMIDADE\n" +
                "3.1. O(A) VENDEDOR(A) declara, sob sua responsabilidade, ser legítimo(a) possuidor(a) do aparelho e que o bem:\n" +
                "a) não é produto de furto, roubo ou origem ilícita;\n" +
                "b) não possui bloqueio, ônus ou restrição de sua ciência;\n" +
                "c) corresponde ao IMEI/serial informado neste contrato.\n" +
                "3.2. Constatada falsidade em qualquer declaração, o(a) VENDEDOR(A) responderá por perdas e danos.\n" +
                "4. PREÇO E PAGAMENTO\n" +
                "4.1. O preço ajustado é de {{valor}}\n" +
                "4.2. O pagamento será feito da seguinte forma: {{forma_pagamento}}\n" +
                "4.3. Com a efetiva quitação, considera-se encerrada a obrigação de pagamento.\n" +
                "5. ENTREGA E DESBLOQUEIO\n" +
                "5.1. O(A) VENDEDOR(A) entrega o aparelho livre de senha, conta Google, iCloud, bloqueio remoto ou qualquer vinculação pessoal.\n" +
                "5.2. O(A) VENDEDOR(A) se compromete a remover seus dados e, se necessário, restaurar o aparelho às configurações de fábrica antes da entrega.\n" +
                "6. RESPONSABILIDADE LEGAL\n" +
                "6.1. As partes reconhecem que a presente compra é regida pela legislação aplicável, respondendo o(a) VENDEDOR(A) por eventual vício oculto ou evicção, na forma da lei.\n" +
                "7. FORO\n" +
                "7.1. Fica eleito o foro da comarca de {{foro}} para dirimir qualquer controvérsia decorrente deste contrato.\n" +
                "E, por estarem de acordo, assinam o presente instrumento em duas vias de igual teor.\n" +
                "{{data}}, {{cidade}}\n" +
                "VENDEDOR(A): {{vendedora_nome}}\n" +
                "Assinatura:_____________________________\n" +
                "CPF/CNPJ: {{vendedora_cpf}}\n" +
                "COMPRADORA: {{compradora_razao_social}}\n" +
                "Assinatura:____________________________\n" +
                "CNPJ: {{compradora_cnpj}}",
        },
        new DocumentoModeloData
        {
            Codigo = "contrato-venda",
            Tipo = DocumentoTipos.Contrato,
            Titulo = "Contrato de venda de celular seminovo",
            Ordem = 2,
            Ativo = true,
            ImprimirDuasVias = true,
            Variaveis = Vars(
                "vendedor_nome", "vendedor_cnpj", "vendedor_endereco", "vendedor_telefone",
                "compradora_representante", "compradora_representante_cargo", "compradora_representante_cpf",
                "comprador_nome", "comprador_cpf", "comprador_endereco", "comprador_telefone",
                "aparelho_marca", "aparelho_modelo", "aparelho_cor", "aparelho_capacidade",
                "aparelho_imei", "acessorios", "estado_aparelho",
                "valor", "forma_pagamento", "garantia_clausula_6_meses",
                "cidade", "foro", "data"),
            Corpo =
                "CONTRATO PARTICULAR DE COMPRA E VENDA DE CELULAR SEMINOVO\n" +
                "VENDEDORA: {{vendedor_nome}}, inscrita no CNPJ {{vendedor_cnpj}}, " +
                "com sede na {{vendedor_endereco}}, telefone número {{vendedor_telefone}}, " +
                "neste ato representada por {{compradora_representante}}, " +
                "{{compradora_representante_cargo}}, CPF: {{compradora_representante_cpf}}\n" +
                "COMPRADOR(A): {{comprador_nome}}, inscrito(a) no CPF/CNPJ {{comprador_cpf}}, " +
                "residente no endereço {{comprador_endereco}}, telefone {{comprador_telefone}}\n" +
                "1. OBJETO\n" +
                "1.1. A VENDEDORA vende ao(à) COMPRADOR(A) o seguinte aparelho celular usado:\n" +
                "- Marca/Modelo: {{aparelho_marca}} {{aparelho_modelo}}\n" +
                "- Cor: {{aparelho_cor}}\n" +
                "- Capacidade: {{aparelho_capacidade}}\n" +
                "- IMEI/Serial: {{aparelho_imei}}\n" +
                "- Acessórios: {{acessorios}}\n" +
                "1.2. O aparelho é entregue no estado em que se encontra, após vistoria e aceite do(a) COMPRADOR(A).\n" +
                "2. ESTADO DO APARELHO\n" +
                "2.1. A VENDEDORA declara que o aparelho apresenta as seguintes condições, já conhecidas pelo(a) COMPRADOR(A): {{estado_aparelho}}.\n" +
                "2.2. O(A) COMPRADOR(A) declara ter examinado o aparelho e concordado com suas condições de uso, aparência e funcionamento.\n" +
                "3. ORIGEM E LEGITIMIDADE\n" +
                "3.1. A VENDEDORA declara, sob sua responsabilidade, ser legítima possuidora do aparelho e que o bem:\n" +
                "a) não é produto de furto, roubo ou origem ilícita;\n" +
                "b) não possui bloqueio, ônus ou restrição de sua ciência;\n" +
                "c) corresponde ao IMEI/serial informado neste contrato.\n" +
                "3.2. Constatada falsidade em qualquer declaração, a VENDEDORA responderá por perdas e danos.\n" +
                "4. PREÇO E PAGAMENTO\n" +
                "4.1. O preço ajustado é de {{valor}}\n" +
                "4.2. O pagamento será feito da seguinte forma: {{forma_pagamento}}\n" +
                "4.3. Com a efetiva quitação, considera-se encerrada a obrigação de pagamento.\n" +
                "5. ENTREGA E DESBLOQUEIO\n" +
                "5.1. A VENDEDORA entrega o aparelho livre de senha, conta Google, iCloud, bloqueio remoto ou qualquer vinculação pessoal.\n" +
                "5.2. A VENDEDORA se compromete a remover seus dados e, se necessário, restaurar o aparelho às configurações de fábrica antes da entrega.\n" +
                "6. DA GARANTIA\n" +
                "6.1. A VENDEDORA oferece 3 (três) meses de garantia restrita exclusivamente aos defeitos funcionais de fabricação ou vício oculto que afetem os seguintes componentes: ligação, botões, tela, câmera, áudio e carregamento.\n" +
                "6.2. EXCLUSÕES DA GARANTIA: A garantia prevista no item 6.1 perde total validade e NÃO ABRANGE defeitos ou danos decorrentes de:\n" +
                "a) Quedas, impactos ou batidas que causem danos físicos externos ou internos;\n" +
                "b) Contato com líquidos, umidade ou oxidação;\n" +
                "c) Mau uso, negligência ou imperícia por parte do usuário;\n" +
                "d) Violação do aparelho, rompimento de selos/lacres de segurança, tentativa de conserto ou abertura por assistência técnica não autorizada pela VENDEDORA.\n" +
                "{{garantia_clausula_6_meses}}\n" +
                "7. RESPONSABILIDADE LEGAL\n" +
                "7.1. As partes reconhecem que a presente compra e venda é regida pela legislação aplicável, respondendo a VENDEDORA por eventual vício oculto ou evicção, na forma da lei.\n" +
                "8. FORO\n" +
                "8.1. Fica eleito o foro da comarca de {{foro}} para dirimir qualquer controvérsia decorrente deste contrato.\n" +
                "E, por estarem de acordo, assinam o presente instrumento em duas vias de igual teor.\n" +
                "{{data}}, {{cidade}}\n" +
                "COMPRADOR(A): {{comprador_nome}}\n" +
                "Assinatura:_____________________________\n" +
                "CPF/CNPJ: {{comprador_cpf}}\n" +
                "VENDEDORA: {{vendedor_nome}}\n" +
                "Assinatura:____________________________\n" +
                "CNPJ: {{vendedor_cnpj}}",
        },
        new DocumentoModeloData
        {
            Codigo = "termo-conscientizacao",
            Tipo = DocumentoTipos.Termo,
            Titulo = "Termo de ciência e conscientização",
            Ordem = 3,
            Ativo = true,
            Variaveis = Vars(
                "vendedor_nome", "vendedor_cnpj", "vendedor_endereco",
                "comprador_nome", "comprador_cpf", "comprador_endereco",
                "cidade", "data"),
            Corpo =
                "TERMO DE CIÊNCIA E CONSCIENTIZAÇÃO DO USO DE APARELHO CELULAR\n" +
                "EMPRESA: {{vendedor_nome}}, inscrita no CNPJ {{vendedor_cnpj}}, com sede na {{vendedor_endereco}}.\n" +
                "CLIENTE / COMPRADOR(A): {{comprador_nome}}, inscrito(a) no CPF/CNPJ {{comprador_cpf}}, " +
                "residente e domiciliado(a) na {{comprador_endereco}}.\n" +
                "Pelo presente instrumento, o(a) CLIENTE declara estar ciente, de acordo e devidamente orientado(a) acerca das recomendações técnicas, limitações de uso e cuidados essenciais referentes ao aparelho celular adquirido nesta data, observando-se as seguintes diretrizes:\n" +
                "1. DA RESISTÊNCIA À ÁGUA E POEIRA (IP67 / IP68)\n" +
                "1.1. O(A) CLIENTE está ciente de que, tratando-se de um aparelho seminovo, submetido a manutenções prévias, trocas de peças ou simplesmente pelo desgaste natural do uso e tempo de fabricação, as vedações originais de fábrica contra água, umidade e poeira já não possuem a mesma eficácia original.\n" +
                "1.2. Recomenda-se evitar o contato do aparelho com líquidos (chuva, piscina, banho, mar ou quedas acidentais na água), uma vez que danos por oxidação ou líquidos não são cobertos pela garantia.\n" +
                "2. DOS CUIDADOS COM O CARREGAMENTO E ENERGIA\n" +
                "2.1. O(A) CLIENTE foi orientado(a) a utilizar exclusivamente carregadores originais ou devidamente certificados (homologados pela Anatel) de boa qualidade.\n" +
                "2.2. O uso de fontes de carregamento paralelas de baixa qualidade (\"paraguaias\", cabos danificados ou adaptadores inadequados de procedência duvidosa) pode causar oscilações de energia, queimar o conector de carga, danificar a placa principal ou estragar a bateria prematuramente, o que invalidará a garantia do componente afetado.\n" +
                "3. DA BATERIA E DESEMPENHO\n" +
                "3.1. O(A) CLIENTE compreende que a bateria de aparelhos seminovos sofre desgaste natural químico com o passar dos ciclos de carga. O rendimento da bateria pode variar conforme a intensidade de uso de aplicativos, redes móveis, brilho de tela e atualizações de sistema.\n" +
                "4. DO BACKUP E DADOS PESSOAIS\n" +
                "4.1. É de inteira e exclusiva responsabilidade do(a) CLIENTE a realização periódica de cópias de segurança (backup) de seus dados pessoais, fotos, contatos e arquivos importantes (em nuvem ou computador). A empresa vendedora não se responsabiliza por eventuais perdas de dados decorrentes de falhas de sistema, travamentos ou mau uso do aparelho.\n" +
                "5. ATUALIZAÇÕES DE SISTEMA (SOFTWARE)\n" +
                "5.1. O(A) CLIENTE está ciente de que atualizações de sistema operacional disponibilizadas pelos fabricantes (Android/iOS) em aparelhos seminovos ou mais antigos podem, eventualmente, alterar o consumo de bateria ou a velocidade de processamento, sendo escolhas de responsabilidade do usuário realizá-las.\n" +
                "Ao assinar abaixo, o(a) CLIENTE confirma que recebeu todas as orientações acima de forma clara, tirou suas dúvidas e concorda com as recomendações de uso para a preservação do seu aparelho.\n" +
                "{{cidade}}, {{data}}.\n" +
                "COMPRADOR(A): {{comprador_nome}}\n" +
                "Assinatura:_____________________________\n" +
                "CPF/CNPJ: {{comprador_cpf}}\n" +
                "VENDEDORA: {{vendedor_nome}}\n" +
                "Assinatura:____________________________\n" +
                "CNPJ: {{vendedor_cnpj}}",
        },
        new DocumentoModeloData
        {
            Codigo = "aviso-geral",
            Tipo = DocumentoTipos.Aviso,
            Titulo = "Aviso",
            Ordem = 4,
            Ativo = true,
            Variaveis = Vars("cidade", "data", "observacoes"),
            Corpo =
                "AVISO\n\n" +
                "{{observacoes}}\n\n" +
                "{{cidade}}, {{data}}.",
        },
    ];

    private static List<DocumentoVariavelDef> Vars(params string[] chaves)
    {
        var mapa = Variaveis.ToDictionary(v => v.Chave, StringComparer.OrdinalIgnoreCase);
        var lista = new List<DocumentoVariavelDef>();
        var ordem = 1;
        foreach (var chave in chaves)
        {
            if (!mapa.TryGetValue(chave, out var v)) continue;
            lista.Add(new DocumentoVariavelDef
            {
                Chave = v.Chave,
                Rotulo = v.Rotulo,
                Tipo = v.Tipo,
                Obrigatoria = chave is not "observacoes" and not "comprador_rg" and not "acessorios"
                    and not "garantia_clausula_6_meses",
                Oculta = chave is "compradora_razao_social" or "compradora_cnpj" or "compradora_endereco"
                    or "compradora_representante" or "compradora_representante_cargo" or "compradora_representante_cpf"
                    or "vendedor_nome" or "vendedor_cnpj" or "vendedor_endereco" or "vendedor_telefone"
                    or "cidade" or "foro" or "data",
                Ordem = ordem++,
            });
        }
        return lista;
    }
}
