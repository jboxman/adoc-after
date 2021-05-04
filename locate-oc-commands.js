#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const yaml = require ('js-yaml');
const dir = require('node-dir');
const entities = require('ent');
const asciidoctor = require(`asciidoctor`);

const repoDir = process.argv[2];
const includeBuckets = [
  'authentication', 'builds', 'loggin', 'machine_management', 'monitoring',
  'nodes', 'web_console', 'networking'];

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

if(!fs.existsSync('build')) fs.mkdirSync('build');

// TODO: Finds buckets from YAML, but does not descend YAML tree itself
for(const { Dir: bucketDir, Name: name } of buckets) {
  if(!includeBuckets.includes(bucketDir)) continue;

  const src = path.join(repoDir, bucketDir);
  const assemblies = dir.files(src, { sync: true })
    .filter(file => !/\/modules/.test(file))
    .filter(file => /\.adoc/.test(file));

  output[name] = [];

  const targetFile = `build/${bucketDir}.adoc`;

  for(const assembly of assemblies) {
    const capturedBlocks = [];
    const adoctor = asciidoctor();
    const obj = {};

    let doc;
    try {
      console.log(`Processing ${assembly.replace(`${repoDir}/`, '')}`);
      // For ifeval::[{release} >= 4.5]
      // >=: undefined method `>=' for nil
      doc = adoctor.loadFile(assembly, asciidocOptions);
      doc.convert();

      obj['title'] = doc.getTitle();

      const blocks = doc.findBy({ context: 'listing' }, onlyLang('terminal'));
      if(blocks.length > 0) {
        for(const node of blocks) {
          if(/\$\s+oc/.test(node.getContent())) {
            if(!ignoreRegex.test(node.getContent())) {
              capturedBlocks.push(makeCodeBlock(node));
            }
          }  
        }
      }
    }
    catch(e) {
      console.log(e);
    }

    obj['data'] = capturedBlocks;
    output[name].push(obj);
  }

  for(const obj of output[name]) {
    if(obj['data'].length <= 0) continue;

    if(!fs.existsSync(targetFile)) {
      fs.writeFileSync(targetFile, `= ${name}\n\ntoc::[]\n\n`, { flag: 'w' });
    }

    fs.writeFileSync(
      targetFile,
      [`\n## ${obj['title']}`, ...obj['data']].join(`\n`),
      { flag: 'a' });
  }

}
