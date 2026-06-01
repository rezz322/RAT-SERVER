const fs = require('fs');
let code = fs.readFileSync('src/app.service.ts', 'utf8');
code = code.replace(/const mojibakeStrings = \[[^\]]+\];/s, 'const mojibakeStrings = ["0x80070570", "ERR_INVALID_DATA", "FATAL_ERR_0xFF", "0x00000000", "NULL_PTR", "ERROR_110"];');
fs.writeFileSync('src/app.service.ts', code);
console.log('Fixed');
