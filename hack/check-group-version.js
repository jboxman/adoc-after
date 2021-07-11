#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
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

// TODO - can look at api-groups API call instead
// It provides preferred groups and allowed API groups
// So there is no need to even look at Kind, or Group and Version
const resources = yaml.safeLoad(fs.readFileSync('resources.yaml'));

const GROUP = /apiVersion: ?([_A-Za-z0-9\/.]+)/;
const KIND = /kind: ?([A-Za-z]+)/;

const selectLang = lang => node => node.getAttribute('language') == lang;
// Only test resources that are known to be in OCP, excluding aligned products
const exists = (kind, group) => {
  // Because extensions is deprecated, this is worth checking even if there are
  // false positives.
  if(group == 'extensions')
    return true;

  return resources.find(resource => resource.name == kind && resource.group == group) ? true : false;
}
const validate = ({ group, version, kind }) => {
  return resources.some(resource => {
    return (resource.group == group &&
      resource.version == version &&
      resource.name == kind)
  });
}

class TemplateConverter {
  constructor() {
    this.baseConverter = asciidoctor.Html5Converter.$new();
  }

  convert(node, transform) {
    let group;
    let version;
    let kind;

    if(node.getNodeName() == 'listing' && selectLang('yaml')) {
      if(node.getContent().includes('apiVersion:')) {

        // On some files:
        // TypeError: Cannot read property 'getFile' of undefined
        //let sourceFile = node.parent.getSourceLocation().getFile();

        if(GROUP.test(node.getContent()) && KIND.test(node.getContent())) {

          [ , group ] = GROUP.exec(node.getContent());
          [ , kind ] = KIND.exec(node.getContent());
          if(group.includes('/')) {
            [ group, version ] = group.split('/');
          }
          else {
            version = group;
            group = 'core';
          }

          if(exists(kind, group) && !validate({ group, version, kind })) {
            console.log(`${assemblyFile}: Old ${kind} ${group}/${version}`);
          }

        }
        //console.log(group);
        //console.log(kind);
        //console.log(version);

      }
    }

    return this.baseConverter.convert(node, transform);
  }
}

asciidoctor.ConverterFactory.register(new TemplateConverter(), ['html5']);

//console.log(`Scanning ${assemblyFile}`);

const doc = asciidoctor.loadFile(assemblyFile, asciidocOptions);
doc.convert();
