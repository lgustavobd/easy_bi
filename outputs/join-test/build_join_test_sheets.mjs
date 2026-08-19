import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = process.cwd();

const vendasRows = [
  ["cliente_id", "data_venda", "pedido_id", "produto", "categoria", "quantidade", "valor_unitario", "desconto_percentual", "canal", "vendedor"],
  ["C001", new Date("2026-01-05"), "P-1001", "Licenca BI", "Software", 2, 399.9, 0.05, "Online", "Ana"],
  ["C002", new Date("2026-01-08"), "P-1002", "Consultoria", "Servicos", 1, 1200, 0.1, "Parceiro", "Bruno"],
  ["C003", new Date("2026-01-12"), "P-1003", "Treinamento", "Servicos", 3, 250, 0, "Online", "Carla"],
  ["C004", new Date("2026-01-17"), "P-1004", "Licenca BI", "Software", 4, 399.9, 0.08, "Direto", "Diego"],
  ["C005", new Date("2026-01-24"), "P-1005", "Suporte premium", "Servicos", 1, 600, 0, "Direto", "Ana"],
  ["C006", new Date("2026-02-02"), "P-1006", "Licenca BI", "Software", 2, 399.9, 0.03, "Online", "Bruno"],
  ["C007", new Date("2026-02-07"), "P-1007", "Implantacao", "Servicos", 1, 1800, 0.12, "Parceiro", "Carla"],
  ["C008", new Date("2026-02-11"), "P-1008", "Treinamento", "Servicos", 5, 250, 0.05, "Direto", "Diego"],
  ["C009", new Date("2026-02-16"), "P-1009", "Licenca BI", "Software", 1, 399.9, 0, "Online", "Ana"],
  ["C010", new Date("2026-02-21"), "P-1010", "Consultoria", "Servicos", 2, 1200, 0.15, "Direto", "Bruno"],
  ["C001", new Date("2026-03-03"), "P-1011", "Suporte premium", "Servicos", 2, 600, 0.04, "Online", "Carla"],
  ["C003", new Date("2026-03-09"), "P-1012", "Licenca BI", "Software", 3, 399.9, 0.06, "Parceiro", "Diego"],
  ["C005", new Date("2026-03-14"), "P-1013", "Treinamento", "Servicos", 4, 250, 0, "Direto", "Ana"],
  ["C007", new Date("2026-03-20"), "P-1014", "Consultoria", "Servicos", 1, 1200, 0.05, "Online", "Bruno"],
  ["C999", new Date("2026-03-27"), "P-1015", "Licenca BI", "Software", 1, 399.9, 0, "Online", "Carla"],
  ["C002", new Date("2026-04-04"), "P-1016", "Implantacao", "Servicos", 1, 1800, 0.1, "Direto", "Diego"],
  ["C006", new Date("2026-04-10"), "P-1017", "Treinamento", "Servicos", 2, 250, 0, "Parceiro", "Ana"],
  ["C010", new Date("2026-04-18"), "P-1018", "Licenca BI", "Software", 5, 399.9, 0.07, "Online", "Bruno"],
];

const clientesRows = [
  ["cliente_id", "cliente_nome", "segmento", "cidade", "estado", "meta_mensal", "gerente_conta", "ativo"],
  ["C001", "Mercado Alfa", "Varejo", "Sao Paulo", "SP", 5000, "Mariana", true],
  ["C002", "Grupo Beta", "Industria", "Campinas", "SP", 8000, "Mariana", true],
  ["C003", "Clinica Celta", "Saude", "Rio de Janeiro", "RJ", 4500, "Rafael", true],
  ["C004", "Escola Delta", "Educacao", "Curitiba", "PR", 3500, "Rafael", true],
  ["C005", "Logistica Eixo", "Logistica", "Joinville", "SC", 6000, "Patricia", true],
  ["C006", "Fintech Fluxo", "Financeiro", "Belo Horizonte", "MG", 9000, "Patricia", true],
  ["C007", "Construtora Gama", "Construcao", "Goiania", "GO", 7000, "Mariana", true],
  ["C008", "Hotel Horizonte", "Turismo", "Salvador", "BA", 4200, "Rafael", false],
  ["C009", "Agro Iris", "Agro", "Ribeirao Preto", "SP", 5200, "Patricia", true],
  ["C010", "Tech Juno", "Tecnologia", "Florianopolis", "SC", 10000, "Mariana", true],
  ["C011", "Cliente sem venda", "Teste", "Recife", "PE", 2500, "Rafael", true],
];

function styleSheet(sheet, title, rangeAddress, tableName) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  const range = sheet.getRange(rangeAddress);
  range.values = title === "Vendas" ? vendasRows : clientesRows;
  range.format.font = { name: "Aptos", size: 11, color: "#0f172a" };
  range.format.borders = {
    insideHorizontal: { style: "thin", color: "#E2E8F0" },
    top: { style: "thin", color: "#CBD5E1" },
    bottom: { style: "thin", color: "#CBD5E1" },
  };
  const header = sheet.getRange(rangeAddress.replace(/\d+:.+/, "1:" + rangeAddress.split(":")[1].replace(/\d+$/, "1")));
  header.format = {
    fill: "#EA580C",
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
  };
  sheet.tables.add(rangeAddress, true, tableName);
}

function createVendasWorkbook() {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Vendas");
  styleSheet(sheet, "Vendas", "A1:J19", "TabelaVendasJoin");
  sheet.getRange("B2:B19").setNumberFormat("yyyy-mm-dd");
  sheet.getRange("F2:F19").setNumberFormat("#,##0");
  sheet.getRange("G2:G19").setNumberFormat('"R$"#,##0.00');
  sheet.getRange("H2:H19").setNumberFormat("0.0%");
  sheet.getRange("A:A").format.columnWidth = 13;
  sheet.getRange("B:B").format.columnWidth = 14;
  sheet.getRange("C:C").format.columnWidth = 13;
  sheet.getRange("D:D").format.columnWidth = 18;
  sheet.getRange("E:E").format.columnWidth = 14;
  sheet.getRange("F:H").format.columnWidth = 16;
  sheet.getRange("I:J").format.columnWidth = 14;
  return workbook;
}

function createClientesWorkbook() {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Clientes");
  styleSheet(sheet, "Clientes", "A1:H12", "TabelaClientesJoin");
  sheet.getRange("F2:F12").setNumberFormat('"R$"#,##0');
  sheet.getRange("A:A").format.columnWidth = 13;
  sheet.getRange("B:B").format.columnWidth = 22;
  sheet.getRange("C:C").format.columnWidth = 16;
  sheet.getRange("D:D").format.columnWidth = 18;
  sheet.getRange("E:E").format.columnWidth = 10;
  sheet.getRange("F:F").format.columnWidth = 16;
  sheet.getRange("G:G").format.columnWidth = 18;
  sheet.getRange("H:H").format.columnWidth = 10;
  return workbook;
}

async function verifyAndSave(workbook, sheetName, inspectRange, outputName) {
  const inspect = await workbook.inspect({
    kind: "table",
    sheetId: sheetName,
    range: inspectRange,
    include: "values",
    tableMaxRows: 6,
    tableMaxCols: 10,
    maxChars: 5000,
  });
  console.log(inspect.ndjson);
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 50 },
    summary: "final formula error scan",
  });
  console.log(errors.ndjson);
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(outputDir, outputName.replace(".xlsx", ".png")), new Uint8Array(await preview.arrayBuffer()));
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(path.join(outputDir, outputName));
}

await fs.mkdir(outputDir, { recursive: true });
await verifyAndSave(createVendasWorkbook(), "Vendas", "A1:J19", "base_vendas_join.xlsx");
await verifyAndSave(createClientesWorkbook(), "Clientes", "A1:H12", "base_clientes_join.xlsx");

console.log("Arquivos gerados para teste de join:");
console.log(path.join(outputDir, "base_vendas_join.xlsx"));
console.log(path.join(outputDir, "base_clientes_join.xlsx"));
