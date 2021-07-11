#!/usr/bin/env node

const path = require('path');
const entities = require('ent');
const asciidoctor = require(`asciidoctor`)();

const assemblyFile = process.argv[2];

const asciidocOptions = {
  doctype: 'article',
  // asciidoctor: WARNING: include file is outside of jail; recovering automatically
  //safe: 'server',
  safe: 'unsafe',
  sourcemap: true,
  base_dir: path.dirname(assemblyFile)
}

const notLang = lang => node => node.getAttribute('language') != lang;
const makeCodeBlock = node => {
  const lang = node.getAttribute('language') || 'shell';
return `
[source,${lang}]
----
${entities.decode(node.getContent())}
----
`;
}

class TemplateConverter {
  constructor() {
    this.baseConverter = asciidoctor.Html5Converter.$new();
  }

  convert(node, transform) {
    if(node.getNodeName() == 'listing' && (notLang('yaml')(node) && notLang('json')(node))) {
      //if(node.getContent().includes('v1beta1')
      //  && /(DaemonSet|Deployment|ReplicaSet|StatefulSet)/.test(node.getContent())) {
        //console.log(node.getContent());
        //console.log(path.resolve(process.cwd(), assemblyFile));
      //}
      console.log(makeCodeBlock(node));
    }
    return this.baseConverter.convert(node, transform);
  }
}

asciidoctor.ConverterFactory.register(new TemplateConverter(), ['html5']);

//console.log(`Scanning ${assemblyFile}`);

const doc = asciidoctor.loadFile(assemblyFile, asciidocOptions);
doc.convert();
