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
  "module_root": __dirname + "/node_modules/nodehun"
});

const { walkTopics } = require('./lib');

const af = Buffer.from(fs.readFileSync(fsPath.join(fsPath.dirname(base), 'index.aff'), 'utf-8'));
const dict = Buffer.from(fs.readFileSync(fsPath.join(fsPath.dirname(base), 'index.dic'), 'utf-8'));

const hunspell = new Nodehun(af, dict);

// This silences all warnings and errors. Asciidoc assumed to be valid.
const memoryLogger = asciidoctor.MemoryLogger.create();
asciidoctor.LoggerManager.setLogger(memoryLogger);

const asciidocOptions = {
  doctype: 'article',
  safe: 'unsafe',
  sourcemap: true,
  attributes: {
    'openshift-enterprise': ''
  }
};
const stripHtmlOptions = {
  stripTogetherWithTheirContents: ['code', 'pre']
};

program
  //.arguments('')
  .description('Check US English spelling in Asciidoc files')
  .option('--topic <path>', 'Optional: Path to _topic_map.yml file')
  .action(main);

const getWords = content => {
  //console.log(content);
  const stripped = stripHtml(content, stripHtmlOptions).result;
  const lines = eol.split(stripped).reduce((a, line) => {
    if(line) {
      // Can't include ' for contractions because that leads to unhelpful splits
      const words = line.split(/\W+/);
      if(words) {
        // Skip acronyms
        const lcWords = words
          .filter(v => v.length > 1)
          .filter(v => v != v.toLocaleUpperCase())
          .map(v => v.toLocaleLowerCase());
        a.push(...lcWords);
      }
    }

    return a;
  }, []);
  return lines;
}

// getContent() is for blocks
// getText() is for list items (all list items?)

// Based on:
// https://github.com/seikichi/textlint-plugin-asciidoctor/blob/master/src/parse.js

const getAllNodes = node => {
  const { dir, file, path, lineno } = node.source_location;
  const all = [];
  const allowedContexts = [
    // 'listing',
    'document', 'preamble', 'paragraph', 'list_item', 'quote',
    'section', 'table', 'admonition'
  ];

  // Unique behavior
  if(node.context == 'dlist') {
    const text = node.$blocks().map(([terms, item]) => [...terms, item]).reduce((v, accum) => {accum.push(...v); return accum;}, []).map(v => v.getText ? v.getText() : '').join(' ');
    all.push({ path, lineno, words: getWords(text) });
    return all;
  }
  if(node.context == 'ulist' || node.context == 'olist') {
    for(const li of node.$blocks()) {
      all.push({ path, lineno, words: getWords(li.getText()) });
      return all;
    }
  }
  if(node.context == 'table') {
    for(const row of node.$rows().$body()) {
      for(const cell of row) {
        if(cell.style == 'asciidoc') {
          for(const block of cell.$inner_document().$blocks()) {
            all.push(...getAllNodes(block));
          }
        }
        else {
          // Temporary skip single word cells;
          // Many of these ought to be in code font, but are not.
          if(!/^\w+$/.test(cell.getText())) {
            all.push({ path, lineno, words: getWords(cell.getText()) });
          }
        }
      }
    }
  }

  if(!allowedContexts.includes(node.context)) return all;

  if(!['document', 'section', 'preamble'].includes(node.context)) {
    const words = getWords(node.getContent());
    all.push({ path, lineno, words });
  }

  for(const block of node.$blocks()) {
    all.push(...getAllNodes(block));
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
    for(const word of words.filter(v => !/^(#|\s)/.test(v))) {
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
      const wordGroups = getAllNodes(doc);

      for(const { path, lineno, words } of wordGroups) {
        for(const word of words) {
          const correct = hunspell.spellSync(word);
          if(!correct) console.log(`[${path}:${lineno}] Mispelled: ${word}`);
          //if(!correct) console.log(`${word}`);
        }
      }
    }
  }
}

// TODO
// Add --quiet
// Add --incorrect-only
// Add CSV format
// Add --only for specific assembly?
// Add skip single word table cell/definition list for testing
// Add specific context to exclude tables, or lists, or whatever
// Add pass in for necessary attributes, maybe with config
// Add exclude regex list for quantities, such as 8GB, 500m, ect.
// Need {product-version} for some conditionals passed in optionally
// Contractions (aren't, ect.) are currently stripped
// Are these words? x86_64, amd64, s390x, ppc64le

program.parse(process.argv);
