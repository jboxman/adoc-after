const program = require('commander');
const fs = require('fs');
const fsPath = require('path');
const asciidoctor = require(`asciidoctor`)();
const yaml = require('js-yaml');
//const entities = require('ent');
const { stripHtml } = require("string-strip-html");

const { walkTopics } = require('./lib');

const asciidocOptions = {
  doctype: 'article',
  safe: 'unsafe',
  sourcemap: true
}

const memoryLogger = asciidoctor.MemoryLogger.create();
asciidoctor.LoggerManager.setLogger(memoryLogger);

// This happens prior to include:: expansion, so is not useful.
asciidoctor.Extensions.register(function() {
  this.preprocessor(function() {
    var self = this;
    self.process(function(doc, reader) {
      const { lines } = reader;
      const lines_copy = [ ...lines ];
      let open = false;
      let found = false;

      if(lines.length <= 0) return reader;

      // Remove <\d> from every line in every listing block
      for(let i = 0; i < lines.length; i++) {
        if(lines[i].substr(0, 4) == '----') {
          console.log('Found');
          found = true;
          open = !open;
          continue;
        }
        if(open) {
          console.log('Open');
          console.log(lines_copy[i]);
          lines_copy[i].replace(/[ ]*\<[\d\.]+\>[ ]*/g, '');
          lines_copy[i].replace(/\.\.\.\.?/g, '');
          console.log(lines_copy[i]);
        }
      }

      // Missing at least one closing pair, abort.
      if(found && open) return reader;

      reader.lines = lines_copy;
      return reader;
    });
  });
});

const onlyLang = lang => node => node.getAttribute('language') == lang;

const stripHtmlOptions = {
  onlyStripTags: ['i', 'img'],
  trimOnlySpaces: true
};

program
  //.arguments('')
  .description('')
  .option('--topic <path>', 'Optional: Path to _topic_map.yml file')
  .action(main);

function main(options = {}, cmd = {}) {
  const topicPath = options.topic ? options.topic : fsPath.join(process.cwd(), '_topic_map.yml');

  if(fs.existsSync(topicPath)) {
    data = fs.readFileSync(topicPath, { encoding: 'utf8' } );
  }
  else {
    process.exit(1);
  }

  const sections = data.split(/---\n/).slice(1);
  const buckets = sections.map(section => yaml.load(section));

  for(const bucket of buckets) {
    let doc;
    if(bucket['Dir'] == 'rest_api') continue;
    const paths = walkTopics(bucket);

    for(const { path, title } of paths) {
      const inputPath = fsPath.join(fsPath.dirname(topicPath), `${path}.adoc`);
      console.log(`Scanning ${inputPath}`);

      try {
        doc = asciidoctor.loadFile(inputPath, { ...asciidocOptions, base_dir: fsPath.dirname(inputPath) });
      }
      catch(e) {
        console.error(e.message);
      }
      doc.convert();

      const blocks = doc.findBy({ context: 'listing' }, onlyLang('yaml'));

      if(blocks.length > 0) {
        for(const block of blocks.sort((a, b) => a.parent.getLineNumber() > b.parent.getLineNumber())) {
          let o = {};
          // TODO - $source does NOT resolve attributes, so these can be invalid YAML
          const yamlBlock = block.getContent();
          const { dir, file, path, lineno } = block.parent.source_location;
          const clean = yamlBlock;
            //.replace(/[ ]*\<[\d\.]+\>[ ]*/g, '')

          try {
            o = yaml.load(clean);
            console.log(`${path} [${lineno}]: OK`)
          }
          catch(e) {
            console.log(`${path} [${lineno}]: Invalid`)
            console.log(clean);
            console.log(`${e.name} ${e.message}`);
          }

        }
      }
    }
  }
}

program.parse(process.argv);
