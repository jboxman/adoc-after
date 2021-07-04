const fsPath = require('path');
const asciidoctor = require(`asciidoctor`)();
const yaml = require('js-yaml');

const assemblyFile = process.argv[2];

const asciidocOptions = {
  doctype: 'article',
  safe: 'unsafe',
  sourcemap: true,
  base_dir: fsPath.dirname(assemblyFile)
}

const memoryLogger = asciidoctor.MemoryLogger.create();
asciidoctor.LoggerManager.setLogger(memoryLogger);

const onlyLang = lang => node => node.getAttribute('language') == lang;

console.log(`Scanning ${assemblyFile}`);

const doc = asciidoctor.loadFile(assemblyFile, asciidocOptions);
doc.convert();

const blocks = doc.findBy({ context: 'listing' }, onlyLang('yaml'));
if(blocks.length > 0) {
  for(const block of blocks.sort((a, b) => a.parent.getLineNumber() > b.parent.getLineNumber())) {
    let o = {};
    const yamlBlock = block.$source();
    const { dir, file, path, lineno } = block.parent.source_location;
    const clean = yamlBlock
      .replace(/\s?\<[\d\.]+\>\s?$/gm, '')
      .replace(/\.\.\.\.?/g, '');

    try {
      o = yaml.load(clean);
      console.log(`${path} [${lineno}]: OK`)
    }
    catch(e) {
      console.log(`${path} [${lineno}]: Invalid`)
      console.log(`${e.name} ${e.message}`);
    }
  }
}
