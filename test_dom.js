const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('admin/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });

dom.window.addEventListener('error', (event) => {
  console.error("DOM Error:", event.error);
});

// Since we can't easily mock fetch with JSDOM resources out of the box, we just wait a bit.
setTimeout(() => {
  console.log("Done checking DOM errors.");
}, 2000);
