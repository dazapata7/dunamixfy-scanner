// Script para analizar archivo Excel de Interrápidisimo
const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '..', 'reference', 'interrapidisimo-sample.xlsx');

try {
  console.log('📂 Leyendo archivo:', excelPath);

  const workbook = XLSX.readFile(excelPath);

  console.log('\n📋 Hojas disponibles:', workbook.SheetNames);

  // Analizar la primera hoja
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  console.log(`\n🔍 Analizando hoja: "${sheetName}"\n`);

  // Convertir a JSON para ver la estructura
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (jsonData.length === 0) {
    console.log('⚠️  La hoja está vacía');
    process.exit(1);
  }

  // Mostrar columnas
  const columns = Object.keys(jsonData[0]);
  console.log('📊 COLUMNAS ENCONTRADAS:');
  console.log('═'.repeat(60));
  columns.forEach((col, idx) => {
    console.log(`${idx + 1}. "${col}"`);
  });

  // Mostrar primeras 3 filas como ejemplo
  console.log('\n📄 PRIMERAS 3 FILAS (EJEMPLO):');
  console.log('═'.repeat(60));
  jsonData.slice(0, 3).forEach((row, idx) => {
    console.log(`\nFila ${idx + 1}:`);
    Object.entries(row).forEach(([key, value]) => {
      const displayValue = String(value).length > 50
        ? String(value).substring(0, 47) + '...'
        : value;
      console.log(`  ${key}: ${displayValue}`);
    });
  });

  console.log(`\n✅ Total de filas: ${jsonData.length}`);

  // Exportar a JSON para análisis
  const fs = require('fs');
  const jsonPath = path.join(__dirname, '..', 'reference', 'interrapidisimo-sample.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
  console.log(`\n💾 Datos exportados a: ${jsonPath}`);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
