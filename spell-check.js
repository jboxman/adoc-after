#!/usr/bin/env node

const program = require('commander');
const fs = require('fs');
const fsPath = require('path');
const yaml = require('js-yaml');
const eol = require('eol');
const asciidoctor = require(`asciidoctor`)();
const { stripHtml } = require("string-strip-html");
const base = require.resolve('dictionary-en');
const Nodehun = require('bindings')({
  "bindings": "nodehun",
  // TODO - fix
  "module_root": process.cwd() + "/node_modules/nodehun"
});

const { walkTopics } = require('./lib');

const af = Buffer.from(fs.readFileSync(fsPath.join(fsPath.dirname(base), 'index.aff'), 'utf-8'));
const dict = Buffer.from(fs.readFileSync(fsPath.join(fsPath.dirname(base), 'index.dic'), 'utf-8'));

const hunspell = new Nodehun(af, dict);

const memoryLogger = asciidoctor.MemoryLogger.create();
asciidoctor.LoggerManager.setLogger(memoryLogger);

const asciidocOptions = {
  doctype: 'article',
  safe: 'unsafe',
  sourcemap: true
};
const stripHtmlOptions = {
  stripTogetherWithTheirContents: ['code']
};

program
  //.arguments('')
  .description('')
  .option('--topic <path>', 'Optional: Path to _topic_map.yml file')
  .action(main);

const getAllNodes = node => {
  const all = [];
  if(node.blocks.length > 0) {
    for(const block of node.blocks) {
      // backup_and_restore/disaster_recovery/about-disaster-recovery.adoc
      // Array.isArray(block) == true
      if(! block.getContent) {
        console.error('Cannot get content block!');
        continue;
      }
      if(typeof block.getContent() == 'object') {
        all.push(...getAllNodes(block));
      }
      // TODO - line counting doesn't work
      else {
        const { dir, file, path, lineno } = block.source_location;
        const content = block.getContent();
        const stripped = stripHtml(content, stripHtmlOptions).result;
        const lines = eol.split(stripped).reduce((a, line, idx) => {
          if(line) {
            const words = line.match(/[a-z]{2,}/gi);
            if(words) {
              const lcWords = words.map(v => v.toLocaleLowerCase());
              a.push({
                words: lcWords,
                idx
              });
            }
          }

          return a;
        }, []);

        for(const { words, idx } of lines) {
          for(const word of words) {
            const correct = hunspell.spellSync(word);
            //if(!correct) console.log(`[${path}:${lineno}] Mispelled: ${word}`);
            if(!correct) console.error(`${word}`);
          }  
        }

        //all.push(matches);
      }
    }
  }
  return all;
}

function main(options = {}, cmd = {}) {
  const localDictPath = fsPath.join(process.cwd(), 'local.dict');
  const topicPath = options.topic ? options.topic : fsPath.join(process.cwd(), '_topic_map.yml');

  if(fs.existsSync(topicPath)) {
    data = fs.readFileSync(topicPath, { encoding: 'utf8'} );
  }
  else {
    process.exit(1);
  }

  if(fs.existsSync(localDictPath)) {
    const dict = fs.readFileSync(localDictPath, { encoding: 'utf8' });
    const words = eol.split(dict);
    for(const word of words) {
      if(word) hunspell.add(word);
    }
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
      getAllNodes(doc);
    }
  }  
}

// TODO
// Add --quiet
// Add --incorrect-only
// Add CSV format
// Add --only for specific assembly?
// Add autodetect _topic_map; This matters for base_dir in particular
// Add custom logger to get rid of annoying warnings
// Need {product-version} for some conditionals passed in optionally

program.parse(process.argv);
