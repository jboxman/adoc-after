#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const yaml = require ('js-yaml');
const dir = require('node-dir');
const entities = require('ent');
const asciidoctor = require(`asciidoctor`);

const repoDir = process.argv[2];

/*
:data-uri:
:icons:
:experimental:
:toc: macro
:toc-title:
:imagesdir: images
*/

const asciidocOptions = {
  doctype: 'book',
  // asciidoctor: WARNING: include file is outside of jail; recovering automatically
  //safe: 'server',
  safe: 'unsafe',
  sourcemap: true,
  base_dir: repoDir,
  attributes: {
    icons: 'font',
    toc: 'macro'
  }
}

// [-\(\)\="\ \w]+

const onlyLang = lang => node => node.getAttribute('language') == lang;
const makeCodeBlock = node => {
  const lang = node.getAttribute('language') || 'shell';
return `
[source,${lang}]
----
${entities.decode(node.getContent().replace(/<i.+b>/g, ''))}
----
`;
}

const output = {};
const ignoreRegex = /\s+(&lt;command&gt;|login|exec|project|logout|whoami|help|plugin|version|completion|status|get|describe|debug|rsh|rsync|wait|must-gather|cp|logs|node-logs)/;
// path.join(repoDir, '_topic_map.yml')
const data = fs.readFileSync(path.join(repoDir, '_topic_map.yml'), { encoding: 'utf8' });
const sections = data.split(/---\n/).slice(1);
const buckets = sections.map(section => yaml.load(section));

//fs.mkdirSync('build');

// TODO: Finds buckets from YAML, but does not descend YAML tree itself
for(const { Dir: bucketDir, Name: name } of buckets) {
  const src = path.join(repoDir, bucketDir);
  const assemblies = dir.files(src, { sync: true })
    .filter(file => /\.adoc/.test(file));

  output[name] = {};

  for(const assembly of assemblies) {
    const capturedBlocks = [];
    const assemblyName = `${assembly.replace(`${repoDir}/`, '')}`;
    const adoctor = asciidoctor();

    if(!output[name][assemblyName])
      output[name][assemblyName] = [];

    let doc;
    try {
      // For ifeval::[{release} >= 4.5]
      // >=: undefined method `>=' for nil
      doc = adoctor.loadFile(assembly, asciidocOptions);
      doc.convert();

      console.log(doc.getTitle());
      const blocks = doc.findBy({ context: 'listing' }, onlyLang('terminal'));
      if(blocks.length > 0) {
        if(/\$\s+oc/.test(content)) {
          if(!ignoreRegex.test(content)) {
            capturedBlocks.push(makeCodeBlock(node));
          }
        }
      }
    }
    catch(e) {}

    output[name][assemblyName].push(...capturedBlocks);
  }
}

console.log('toc::[]\n');
for(const [ bucketName, obj ] of Object.entries(output)) {
  if(!Object.values(obj).some(v => v.length > 0))
    continue;

  if(Object.keys(obj).length <= 0)
    continue;

  console.log(`# ${bucketName}`);
  for(const [ bucketItem, ary ] of Object.entries(obj)) {
    if(ary.length <= 0)
      continue;

      console.log(`## ${bucketItem}`);
    ary.forEach(block => console.log(block));
  }
}
