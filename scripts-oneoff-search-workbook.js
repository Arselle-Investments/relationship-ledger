const ExcelJS = require("exceljs");

async function main() {
  const [path, pattern] = [process.argv[2], new RegExp(process.argv[3], "i")];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  let hits = 0;
  wb.worksheets.forEach((ws) =>
    ws.eachRow((row, r) =>
      row.eachCell((c) => {
        const v = typeof c.value === "string" ? c.value : (c.value && (c.value.text || (c.value.richText || []).map((x) => x.text).join(""))) || "";
        if (pattern.test(v)) {
          hits++;
          console.log(`${ws.name} R${r}: ${v.slice(0, 200)}`);
        }
      })
    )
  );
  console.log("hits:", hits);
}
main().catch((e) => { console.error(e); process.exit(1); });
