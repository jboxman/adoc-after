#!/usr/bin/env node

const path = require('path');
const asciidoctor = require(`asciidoctor`)();
const { stripHtml } = require("string-strip-html");

const assemblyFile = process.argv[2];

const asciidocOptions = {
  doctype: 'article',
  // asciidoctor: WARNING: include file is outside of jail; recovering automatically
  //safe: 'server',
  safe: 'unsafe',
  sourcemap: true,
  base_dir: path.dirname(assemblyFile)
}

const onlyLang = lang => node => node.getAttribute('language') == lang;

class TemplateConverter {
  constructor() {
    this.baseConverter = asciidoctor.Html5Converter.$new();
  }

  convert(node, transform) {
    console.log(node.getNodeName());
    //if(node.getNodeName() == 'listing' && (notLang('yaml')(node) && notLang('json')(node))) {
      //if(node.getContent().includes('v1beta1')
      //  && /(DaemonSet|Deployment|ReplicaSet|StatefulSet)/.test(node.getContent())) {
        //console.log(node.getContent());
        //console.log(path.resolve(process.cwd(), assemblyFile));
      //}
      //console.log(makeCodeBlock(node));
    //}
    return this.baseConverter.convert(node, transform);
  }
}
asciidoctor.ConverterFactory.register(new TemplateConverter(), ['html5']);

console.log(`Scanning ${assemblyFile}`);

const doc = asciidoctor.loadFile(assemblyFile, asciidocOptions);
doc.convert();

// Gets all top level, fully processed content blocks
// Would need to strip all HTML tags for to use this effectively
// doc.getBlocks()

/*
   1 Name: document
   1 Name: example
   1 Name: preamble
   1 Name: toc
   6 Name: dlist
   7 Name: floating_title
   8 Name: open
  10 Name: table
  16 Name: ulist
  20 Name: olist
  23 Name: colist
  24 Name: section
  61 Name: admonition
  86 Name: listing
 123 Name: paragraph
 344 Name: list_item
 522 Name: table_cell
*/

const validContexts = [
  'section'
  //'paragraph',
  //'list_item',
  //'table_cell',
  //'admonition'
];
const getAllNodes = node => {
  const all = [];
  const blocks = node.findBy({}, n => validContexts.includes(n.getContext()));
  if(blocks.length > 0) {
    for(const block of blocks) {
      if(block === node) continue;
      if(typeof block.getContent() == 'object') {
        all.push(...getAllNodes(block));
      }
      else {
        const data = stripHtml(block.getContent()).result;
        if(/The following Amazon Web Services (AWS) instance types are supported/gi.test(data)) {
          console.warn('BLAH');
        }
        if(!all.includes(data)) all.push(data);
      }
    }
  }
  return all;
}

/*
const things = getAllNodes(doc);
things.forEach(element => {
  console.log(`${element}`);  
});
*/
