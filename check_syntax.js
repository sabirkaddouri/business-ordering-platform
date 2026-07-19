const fs = require('fs');

function checkScript(file) {
  try {
    const code = fs.readFileSync(file, 'utf8');
    // Using simple regex or syntax check by compiling it
    const vm = require('vm');
    const script = new vm.Script(code);
    console.log(`✅ ${file} parses correctly`);
  } catch (e) {
    console.error(`❌ ${file} syntax error:`, e.message);
  }
}

checkScript('public/js/cities.js');
checkScript('public/js/app.js');
checkScript('admin/js/admin.js');
